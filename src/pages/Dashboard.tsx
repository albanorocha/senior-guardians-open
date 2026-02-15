import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppNav from '@/components/AppNav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Phone, Pill, CheckCircle, Circle, XCircle, ChevronRight, AlertTriangle, Bell, Clock, Activity } from 'lucide-react';
import { format, subDays, startOfDay } from 'date-fns';
import { motion } from 'framer-motion';

const moodEmoji: Record<string, string> = {
  happy: '😊', neutral: '😐', confused: '😕', distressed: '😟',
};

const Dashboard = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [medications, setMedications] = useState<any[]>([]);
  const [checkIns, setCheckIns] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [healthLogs, setHealthLogs] = useState<any[]>([]);
  const [adherencePercent, setAdherencePercent] = useState(0);
  const [streak, setStreak] = useState(0);
  const [todayMedStatus, setTodayMedStatus] = useState<Record<string, boolean | null>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const [profileRes, medsRes, checkInsRes, alertsRes, remindersRes, healthRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('medications').select('*').eq('user_id', user.id).eq('active', true).order('created_at'),
        supabase.from('check_ins').select('*').eq('user_id', user.id).order('scheduled_at', { ascending: false }).limit(5),
        supabase.from('alerts').select('*').eq('user_id', user.id).eq('acknowledged', false).order('created_at', { ascending: false }),
        supabase.from('scheduled_reminders').select('*').eq('user_id', user.id).eq('status', 'pending').order('created_at', { ascending: false }),
        supabase.from('health_logs').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
      ]);
      setProfile(profileRes.data);
      setMedications(medsRes.data || []);
      setCheckIns(checkInsRes.data || []);
      setAlerts(alertsRes.data || []);
      setReminders(remindersRes.data || []);
      setHealthLogs(healthRes.data || []);

      // Fetch today's medication status
      const todayStart = startOfDay(new Date()).toISOString();
      const { data: todayCheckIns } = await supabase
        .from('check_ins')
        .select('id')
        .eq('user_id', user.id)
        .gte('scheduled_at', todayStart);
      if (todayCheckIns && todayCheckIns.length > 0) {
        const todayCiIds = todayCheckIns.map(c => c.id);
        const { data: todayResponses } = await supabase
          .from('check_in_responses')
          .select('medication_id, taken')
          .in('check_in_id', todayCiIds);
        const statusMap: Record<string, boolean | null> = {};
        todayResponses?.forEach(r => {
          statusMap[r.medication_id] = r.taken;
        });
        setTodayMedStatus(statusMap);
      }

      // Calculate adherence from last 30 days
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
      const { data: recentCheckIns } = await supabase.from('check_ins').select('id, scheduled_at').eq('user_id', user.id).gte('scheduled_at', thirtyDaysAgo).eq('status', 'completed');
      if (recentCheckIns && recentCheckIns.length > 0) {
        const ciIds = recentCheckIns.map(c => c.id);
        const { data: allResponses } = await supabase.from('check_in_responses').select('check_in_id, taken').in('check_in_id', ciIds);
        
        // Group by check_in_id, count compliant days
        const grouped: Record<string, boolean[]> = {};
        allResponses?.forEach(r => {
          if (!grouped[r.check_in_id]) grouped[r.check_in_id] = [];
          grouped[r.check_in_id].push(r.taken || false);
        });
        const totalDays = Object.keys(grouped).length;
        const compliantDays = Object.values(grouped).filter(arr => arr.every(t => t)).length;
        setAdherencePercent(totalDays > 0 ? Math.round((compliantDays / totalDays) * 100) : 0);

        // Calculate streak (consecutive compliant from most recent)
        const sortedCheckIns = recentCheckIns.sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());
        let s = 0;
        for (const ci of sortedCheckIns) {
          const resps = grouped[ci.id];
          if (resps && resps.every(t => t)) s++;
          else break;
        }
        setStreak(s);
      }

      setLoading(false);
    };
    fetchData();
  }, [user]);

  const acknowledgeAlert = async (alertId: string) => {
    await supabase.from('alerts').update({ acknowledged: true }).eq('id', alertId);
    setAlerts(prev => prev.filter(a => a.id !== alertId));
  };

  const updateReminder = async (id: string, status: string) => {
    await supabase.from('scheduled_reminders').update({ status }).eq('id', id);
    setReminders(prev => prev.filter(r => r.id !== id));
  };

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

        {/* Active Alerts Banner */}
        {alerts.length > 0 && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-2">
            {alerts.map(alert => {
              const isEmergency = alert.type === 'emergency';
              const isCaregiver = alert.type === 'caregiver';
              const borderClass = isEmergency ? 'border-destructive bg-destructive/5' : isCaregiver ? 'border-blue-500 bg-blue-500/5' : 'border-yellow-500 bg-yellow-500/5';
              const iconClass = isEmergency ? 'text-destructive' : isCaregiver ? 'text-blue-600' : 'text-yellow-600';
              return (
                <Card key={alert.id} className={`border-2 ${borderClass}`}>
                  <CardContent className="flex items-center gap-3 py-3 px-4">
                    {isCaregiver ? (
                      <Bell className={`h-5 w-5 shrink-0 ${iconClass}`} />
                    ) : (
                      <AlertTriangle className={`h-5 w-5 shrink-0 ${iconClass}`} />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-senior-sm font-semibold">{alert.reason}</p>
                      <p className="text-xs text-muted-foreground">
                        {isCaregiver && <span className="text-blue-600 font-medium mr-2">Caregiver was notified</span>}
                        {alert.tag && <Badge variant="outline" className="mr-2 text-xs">{alert.tag}</Badge>}
                        {format(new Date(alert.created_at), 'MMM d, h:mm a')}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => acknowledgeAlert(alert.id)}>
                      Dismiss
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </motion.div>
        )}

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

        {/* Adherence Stats */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="shadow-soft">
            <CardHeader className="pb-3">
              <CardTitle className="text-senior-lg flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" /> Adherence
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-senior-sm text-muted-foreground">Last 30 days</span>
                <span className="text-senior-lg font-bold text-primary">{adherencePercent}%</span>
              </div>
              <Progress value={adherencePercent} className="h-3" />
              <p className="text-senior-sm text-muted-foreground">
                🔥 Current streak: <span className="font-semibold text-foreground">{streak} day{streak !== 1 ? 's' : ''}</span>
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Upcoming Reminders */}
        {reminders.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="shadow-soft">
              <CardHeader className="pb-3">
                <CardTitle className="text-senior-lg flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" /> Reminders
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {reminders.map(r => (
                  <div key={r.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                    <Bell className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-senior-sm">{r.reason}</p>
                      <p className="text-xs text-muted-foreground">{r.scheduled_time}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => updateReminder(r.id, 'completed')}>✓</Button>
                      <Button size="sm" variant="ghost" onClick={() => updateReminder(r.id, 'cancelled')}>✕</Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Health Snapshot */}
        {(checkIns.some(c => c.mood_detected) || healthLogs.length > 0) && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <Card className="shadow-soft">
              <CardHeader className="pb-3">
                <CardTitle className="text-senior-lg flex items-center gap-2">
                  📊 Health Snapshot
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Mood trend */}
                {checkIns.some(c => c.mood_detected) && (
                  <div>
                    <p className="text-senior-sm text-muted-foreground mb-1">Recent moods</p>
                    <div className="flex gap-2">
                      {checkIns.filter(c => c.mood_detected).slice(0, 5).map((c, i) => (
                        <span key={i} className="text-xl" title={format(new Date(c.scheduled_at), 'MMM d')}>
                          {moodEmoji[c.mood_detected] || '😐'}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {/* Recent health logs */}
                {healthLogs.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-senior-sm text-muted-foreground">Recent logs</p>
                    {healthLogs.slice(0, 3).map(h => (
                      <div key={h.id} className="flex items-center gap-2 text-sm">
                        <Badge variant="secondary" className="text-xs">{h.category}</Badge>
                        <span className="truncate">{h.details}</span>
                      </div>
                    ))}
                  </div>
                )}
                <Link to="/history" className="text-primary text-sm font-medium hover:underline">View all →</Link>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Today's Medications */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
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
                      {todayMedStatus[med.id] === true
                        ? <CheckCircle className="h-5 w-5 text-green-500" />
                        : todayMedStatus[med.id] === false
                          ? <XCircle className="h-5 w-5 text-red-500" />
                          : <Circle className="h-5 w-5 text-muted-foreground" />}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Check-ins */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
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
