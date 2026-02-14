import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppNav from '@/components/AppNav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Phone, Pill, CheckCircle, Circle, XCircle, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';

const moodEmoji: Record<string, string> = {
  happy: '😊',
  neutral: '😐',
  confused: '😕',
  distressed: '😟',
};

const Dashboard = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [medications, setMedications] = useState<any[]>([]);
  const [checkIns, setCheckIns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const [profileRes, medsRes, checkInsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('medications').select('*').eq('user_id', user.id).eq('active', true).order('created_at'),
        supabase.from('check_ins').select('*').eq('user_id', user.id).order('scheduled_at', { ascending: false }).limit(5),
      ]);
      setProfile(profileRes.data);
      setMedications(medsRes.data || []);
      setCheckIns(checkInsRes.data || []);
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-5 w-5 text-success" />;
      case 'missed': return <XCircle className="h-5 w-5 text-destructive" />;
      default: return <Circle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  if (loading) {
    return (
      <>
        <AppNav />
        <main className="container max-w-2xl py-8 px-4 space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full" />
        </main>
      </>
    );
  }

  return (
    <>
      <AppNav />
      <main className="container max-w-2xl py-8 px-4 space-y-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-senior-2xl font-bold text-foreground">
            {getGreeting()}, {profile?.full_name?.split(' ')[0] || 'there'} 👋
          </h1>
          <p className="text-senior-base text-muted-foreground">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </motion.div>

        {/* Talk to Clara CTA */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}>
          <Link to="/check-in">
            <Card className="bg-primary text-primary-foreground shadow-soft-lg hover:shadow-lg transition-shadow cursor-pointer border-0">
              <CardContent className="flex items-center gap-5 py-8 px-6">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                    <Phone className="h-8 w-8" />
                  </div>
                  <div className="absolute inset-0 w-16 h-16 rounded-full bg-primary-foreground/10 animate-pulse-ring" />
                </div>
                <div className="flex-1">
                  <h2 className="text-senior-xl font-bold">Talk to Clara</h2>
                  <p className="text-senior-base opacity-90">Your daily medication check-in</p>
                </div>
                <ChevronRight className="h-6 w-6 opacity-70" />
              </CardContent>
            </Card>
          </Link>
        </motion.div>

        {/* Today's Medications */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-senior-lg flex items-center gap-2">
                <Pill className="h-5 w-5 text-primary" /> Today's Medications
              </CardTitle>
              <Link to="/medications">
                <Button variant="ghost" size="sm" className="text-primary">Manage</Button>
              </Link>
            </CardHeader>
            <CardContent>
              {medications.length === 0 ? (
                <p className="text-senior-base text-muted-foreground py-4 text-center">
                  No medications added yet.{' '}
                  <Link to="/medications" className="text-primary font-semibold hover:underline">Add one</Link>
                </p>
              ) : (
                <div className="space-y-3">
                  {medications.map((med) => (
                    <div key={med.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div>
                        <p className="text-senior-base font-semibold">{med.name}</p>
                        <p className="text-senior-sm text-muted-foreground">{med.dosage} · {med.time_slots?.join(', ')}</p>
                      </div>
                      <Circle className="h-5 w-5 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Check-ins */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-senior-lg">Recent Check-ins</CardTitle>
              <Link to="/history">
                <Button variant="ghost" size="sm" className="text-primary">View all</Button>
              </Link>
            </CardHeader>
            <CardContent>
              {checkIns.length === 0 ? (
                <p className="text-senior-base text-muted-foreground py-4 text-center">
                  No check-ins yet. Talk to Clara to get started!
                </p>
              ) : (
                <div className="space-y-3">
                  {checkIns.map((ci) => (
                    <div key={ci.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                      {statusIcon(ci.status)}
                      <div className="flex-1 min-w-0">
                        <p className="text-senior-sm font-medium">{format(new Date(ci.scheduled_at), 'MMM d, h:mm a')}</p>
                        {ci.summary && <p className="text-sm text-muted-foreground truncate">{ci.summary}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        {ci.mood_detected && <span className="text-lg">{moodEmoji[ci.mood_detected] || '😐'}</span>}
                        <Badge variant={ci.status === 'completed' ? 'default' : ci.status === 'missed' ? 'destructive' : 'secondary'}>
                          {ci.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </>
  );
};

export default Dashboard;
