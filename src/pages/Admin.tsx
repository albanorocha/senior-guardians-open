import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { useImpersonation } from '@/hooks/useImpersonation';
import AppNav from '@/components/AppNav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, Activity, AlertTriangle, Calendar, Eye, Search, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';

interface Patient {
  id: string;
  full_name: string;
  age: number | null;
  role: string | null;
  phone: string | null;
  created_at: string;
  total_check_ins: number;
  completed_check_ins: number;
  adherence: number;
  last_check_in: string | null;
  active_alerts: number;
  total_alerts: number;
  active_medications: number;
}

interface Metrics {
  total: number;
  checkInsToday: number;
  activeAlerts: number;
}

const Admin = () => {
  const { session } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { setImpersonatedUser } = useImpersonation();
  const navigate = useNavigate();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({ total: 0, checkInsToday: 0, activeAlerts: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (adminLoading) return;
    if (!isAdmin) {
      navigate('/dashboard');
      return;
    }

    const fetchData = async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-data?action=list_patients`,
          {
            headers: {
              Authorization: `Bearer ${session?.access_token}`,
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
          }
        );
        if (res.ok) {
          const data = await res.json();
          setPatients(data.patients || []);
          setMetrics(data.metrics || { total: 0, checkInsToday: 0, activeAlerts: 0 });
        }
      } catch (err) {
        console.error('Failed to fetch admin data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isAdmin, adminLoading, session]);

  const handleImpersonate = (patient: Patient) => {
    setImpersonatedUser(patient.id, patient.full_name);
    navigate('/dashboard');
  };

  const filtered = patients.filter(p =>
    p.full_name.toLowerCase().includes(search.toLowerCase())
  );

  if (adminLoading || loading) {
    return (
      <>
        <AppNav />
        <main className="container max-w-5xl py-8 px-4 space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-3 gap-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
          <Skeleton className="h-64 w-full" />
        </main>
      </>
    );
  }

  return (
    <>
      <AppNav />
      <main className="container max-w-5xl py-8 px-4 space-y-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-senior-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-7 w-7 text-primary" /> Admin Dashboard
          </h1>
          <p className="text-muted-foreground text-sm">Manage patients and monitor health metrics</p>
        </motion.div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="shadow-soft">
            <CardContent className="flex items-center gap-4 py-5">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{metrics.total}</p>
                <p className="text-sm text-muted-foreground">Total Patients</p>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-soft">
            <CardContent className="flex items-center gap-4 py-5">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{metrics.checkInsToday}</p>
                <p className="text-sm text-muted-foreground">Check-ins Today</p>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-soft">
            <CardContent className="flex items-center gap-4 py-5">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{metrics.activeAlerts}</p>
                <p className="text-sm text-muted-foreground">Active Alerts</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Patients Table */}
        <Card className="shadow-soft">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-senior-lg">Patients</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search patients..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filtered.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No patients found.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Age</TableHead>
                      <TableHead>Check-ins</TableHead>
                      <TableHead>Adherence</TableHead>
                      <TableHead>Alerts</TableHead>
                      <TableHead>Meds</TableHead>
                      <TableHead>Last Check-in</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(patient => (
                      <TableRow key={patient.id}>
                        <TableCell className="font-medium">{patient.full_name}</TableCell>
                        <TableCell>{patient.age || '-'}</TableCell>
                        <TableCell>{patient.completed_check_ins}/{patient.total_check_ins}</TableCell>
                        <TableCell>
                          <Badge variant={patient.adherence >= 80 ? 'default' : patient.adherence >= 50 ? 'secondary' : 'destructive'}>
                            {patient.adherence}%
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {patient.active_alerts > 0 ? (
                            <Badge variant="destructive">{patient.active_alerts}</Badge>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell>{patient.active_medications}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {patient.last_check_in
                            ? format(new Date(patient.last_check_in), 'MMM d, h:mm a')
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            onClick={() => handleImpersonate(patient)}
                          >
                            <Eye className="h-3 w-3" /> View as
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
};

export default Admin;
