import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useImpersonation } from '@/hooks/useImpersonation';
import AppNav from '@/components/AppNav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Phone, Pill, CheckCircle, Circle, XCircle, ChevronRight, AlertTriangle, Bell, Clock, Activity, User, LogOut, Flame } from 'lucide-react';
import { format, subDays, startOfDay } from 'date-fns';
import { motion } from 'framer-motion';
import { ResponsiveContainer, LineChart, Line, XAxis, Tooltip, YAxis } from 'recharts';
import NextDoseCard from '@/components/NextDoseCard';

const moodEmoji: Record<string, string> = {
  happy: '😊', neutral: '😐', confused: '😕', distressed: '😟',
};

const moodValues: Record<string, number> = {
  happy: 4, neutral: 3, confused: 2, distressed: 1,
};

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const { effectiveUserId } = useImpersonation();
  const [profile, setProfile] = useState<any>(null);
  const [medications, setMedications] = useState<any[]>([]);
  const [checkIns, setCheckIns] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [healthLogs, setHealthLogs] = useState<any[]>([]);
  const [adherencePercent, setAdherencePercent] = useState(0);
  const [streak, setStreak] = useState(0);
  const [weeklyStreak, setWeeklyStreak] = useState<{ date: Date; compliant: boolean | null; isFuture: boolean }[]>([]);
  const [todayMedStatus, setTodayMedStatus] = useState<Record<string, boolean | null>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!effectiveUserId) return;
    const uid = effectiveUserId;
    const fetchData = async () => {
      const [profileRes, medsRes, checkInsRes, alertsRes, remindersRes, healthRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', uid).single(),
        supabase.from('medications').select('*').eq('user_id', uid).eq('active', true).order('created_at'),
        supabase.from('check_ins').select('*').eq('user_id', uid).order('scheduled_at', { ascending: false }).limit(5),
        supabase.from('alerts').select('*').eq('user_id', uid).eq('acknowledged', false).order('created_at', { ascending: false }),
        supabase.from('scheduled_reminders').select('*').eq('user_id', uid).eq('status', 'pending').order('created_at', { ascending: false }),
        supabase.from('health_logs').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(5),
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
        .eq('user_id', uid)
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
      const { data: recentCheckIns } = await supabase.from('check_ins').select('id, scheduled_at').eq('user_id', uid).gte('scheduled_at', thirtyDaysAgo).eq('status', 'completed');
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

        // Calculate 7-day array and streak
        const dailyCompliance: Record<string, boolean> = {};
        recentCheckIns.forEach(ci => {
          const dateStr = format(new Date(ci.scheduled_at), 'yyyy-MM-dd');
          const resps = grouped[ci.id];
          const isCompliant = resps && resps.length > 0 ? resps.every(t => t) : false;
          if (dailyCompliance[dateStr] === undefined) {
            dailyCompliance[dateStr] = isCompliant;
          } else {
            dailyCompliance[dateStr] = dailyCompliance[dateStr] && isCompliant;
          }
        });

        const today = startOfDay(new Date());
        const streakArray = Array.from({ length: 7 }).map((_, i) => {
          const d = startOfDay(subDays(today, 6 - i));
          const dtStr = format(d, 'yyyy-MM-dd');
          return {
            date: d,
            compliant: dailyCompliance[dtStr] !== undefined ? dailyCompliance[dtStr] : null,
            isFuture: d > today
          };
        });
        setWeeklyStreak(streakArray);

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
  }, [effectiveUserId]);

  // Prepare Mood Chart Data from the last 5 check-ins
  const moodChartData = checkIns.slice().reverse().map(ci => ({
    name: format(new Date(ci.scheduled_at), 'MMM d'),
    mood: ci.mood_detected ? moodValues[ci.mood_detected] || 3 : 3,
    emoji: ci.mood_detected ? moodEmoji[ci.mood_detected] || '😐' : '😐',
    rawMood: ci.mood_detected || 'neutral'
  }));

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
      {/* pb-24 ensures content is not hidden behind the bottom navigation bar */}
      <main className="container max-w-2xl pt-6 pb-24 px-4 space-y-6">
        {/* Top App Header */}
        <motion.header initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center rounded-full hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2">
                  <Avatar className="h-12 w-12 border-2 border-white shadow-soft">
                    <AvatarImage src={profile?.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary font-bold">
                      {profile?.full_name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || '?'}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48 bg-popover z-50">
                <DropdownMenuItem onClick={() => window.location.href = '/profile'} className="gap-2 cursor-pointer">
                  <User className="h-4 w-4" />
                  My Profile
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="gap-2 cursor-pointer text-destructive">
                  <LogOut className="h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <div>
              <p className="text-sm font-semibold text-muted-foreground tracking-tight">{format(new Date(), 'EEEE, MMMM d')}</p>
              <h1 className="text-senior-xl font-bold text-foreground leading-none mt-1">
                {getGreeting()}, {profile?.full_name?.split(' ')[0] || 'there'}
              </h1>
            </div>
          </div>
          <Link to="/notifications" className="relative p-3 rounded-full bg-secondary/10 text-secondary hover:bg-secondary/20 transition-colors">
            <Bell className="h-5 w-5" />
            {alerts.length > 0 && (
              <span className="absolute top-1 right-1 w-3 h-3 rounded-full bg-destructive border-2 border-background animate-pulse" />
            )}
          </Link>
        </motion.header>

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

        {/* Unified Next Dose / Simulate Call Card */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}>
          <NextDoseCard medications={medications} todayMedStatus={todayMedStatus} />
        </motion.div>

        {/* Quick Actions Row */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="flex justify-between items-center px-2 py-2">
          <Link to="/log-symptom">
            <Button variant="ghost" className="flex flex-col gap-2 h-auto py-3 px-2 text-foreground hover:bg-transparent hover:opacity-80">
              <div className="w-14 h-14 rounded-full bg-blue-100/50 text-blue-600 flex items-center justify-center shadow-soft border border-blue-200">
                <Activity className="h-6 w-6" />
              </div>
              <span className="text-[11px] font-bold">Log Symptom</span>
            </Button>
          </Link>
          <Button variant="ghost" className="flex flex-col gap-2 h-auto py-3 px-2 text-foreground hover:bg-transparent hover:opacity-80">
            <div className="w-14 h-14 rounded-full bg-green-100/50 text-green-600 flex items-center justify-center shadow-soft border border-green-200">
              <Phone className="h-6 w-6" />
            </div>
            <span className="text-[11px] font-bold">Caregiver</span>
          </Button>
          <Link to="/medications">
            <Button variant="ghost" className="flex flex-col gap-2 h-auto py-3 px-2 text-foreground hover:bg-transparent hover:opacity-80">
              <div className="w-14 h-14 rounded-full bg-purple-100/50 text-purple-600 flex items-center justify-center shadow-soft border border-purple-200">
                <Pill className="h-6 w-6" />
              </div>
              <span className="text-[11px] font-bold">Add Med</span>
            </Button>
          </Link>
        </motion.div>


        {/* Duolingo-style Adherence Streak */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="shadow-soft border-0 bg-gradient-to-br from-white to-orange-50/30 backdrop-blur-md overflow-hidden relative">
            <div className="absolute -top-6 -right-6 p-4 opacity-5 rotate-12">
              <Flame className="w-48 h-48" />
            </div>
            <CardContent className="p-5 flex flex-col gap-5 relative z-10">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-2xl flex items-center justify-center shadow-inner ${streak > 0 ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-[0_0_20px_rgba(249,115,22,0.3)]' : 'bg-muted text-muted-foreground'}`}>
                  <Flame className="h-10 w-10" fill="currentColor" />
                </div>
                <div>
                  <h3 className="text-3xl font-black text-foreground tracking-tight">{streak} <span className="text-lg font-bold text-muted-foreground uppercase tracking-widest ml-1">Day Streak</span></h3>
                  <p className="text-[13px] font-bold text-orange-600 uppercase tracking-wide mt-1">{streak > 0 ? "You're on fire! Keep it up." : "Start your streak today"}</p>
                </div>
              </div>

              {/* 7-day visualizer */}
              <div className="flex justify-between items-center bg-white/60 rounded-2xl px-2 py-3 shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)] border border-white">
                {weeklyStreak.map((day, idx) => {
                  const isToday = format(day.date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                  return (
                    <div key={idx} className="flex flex-col items-center gap-2">
                      <span className={`text-[11px] font-black tracking-wider ${isToday ? 'text-orange-600' : 'text-muted-foreground/70'}`}>
                        {format(day.date, 'EEEEEE')}
                      </span>
                      <div className={`relative w-9 h-9 rounded-full flex items-center justify-center border-[2.5px] transition-all
                          ${day.compliant
                          ? 'bg-orange-500 border-orange-500 text-white shadow-[0_4px_10px_rgba(249,115,22,0.4)] scale-110'
                          : day.compliant === false
                            ? 'border-border bg-muted/30 text-muted-foreground/40'
                            : day.isFuture
                              ? 'border-dashed border-border/50 text-transparent'
                              : 'border-border/50 bg-background/50 text-muted-foreground/30'}`}>
                        {day.compliant ? (
                          <Flame className="h-5 w-5" fill="currentColor" />
                        ) : day.compliant === false ? (
                          <XCircle className="h-4 w-4 opacity-50" />
                        ) : !day.isFuture && (
                          <Circle className="h-2 w-2 opacity-50 fill-current" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Mood Trend Chart */}
        {checkIns.some(c => c.mood_detected) && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
            <Card className="shadow-soft border-0 bg-white/50 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-senior-base text-foreground">Mood Trend</CardTitle>
                  <span className="text-2xl">{moodChartData[moodChartData.length - 1]?.emoji}</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-[120px] w-full mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={moodChartData}>
                      <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} tickMargin={10} />
                      <YAxis hide domain={[0, 5]} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-popover text-popover-foreground border shadow-sm rounded-lg p-2 text-xs font-bold flex items-center gap-2">
                                <span className="text-lg">{payload[0].payload.emoji}</span>
                                <span className="capitalize">{payload[0].payload.rawMood}</span>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="mood"
                        stroke="hsl(var(--primary))"
                        strokeWidth={3}
                        dot={{ fill: "hsl(var(--primary))", strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, fill: "hsl(var(--primary))" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-1 flex justify-center w-full text-[11px] text-muted-foreground">
                  <Link to="/history" className="hover:underline flex items-center gap-1">
                    View full history <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

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

        {/* Today's Medications - Horizontal Scroll */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-lg font-bold text-foreground">
              Today's Schedule
            </h2>
            <Link to="/medications" className="text-sm font-medium text-primary hover:underline">Manage All</Link>
          </div>

          {medications.length === 0 ? (
            <Card className="shadow-soft border-0"><CardContent className="p-4 text-center text-sm text-muted-foreground">No medications scheduled.</CardContent></Card>
          ) : (
            <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-2 -mx-4 px-4 scrollbar-hide">
              {medications.map((med) => (
                <Card key={med.id} className="shadow-soft min-w-[170px] snap-center shrink-0 border-0 bg-white/50 backdrop-blur-sm">
                  <CardContent className="p-4 flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Pill className="h-5 w-5 text-primary" />
                      </div>
                      {todayMedStatus[med.id] === true
                        ? <CheckCircle className="h-6 w-6 text-green-500" />
                        : todayMedStatus[med.id] === false
                          ? <XCircle className="h-6 w-6 text-red-500" />
                          : <Circle className="h-6 w-6 text-muted-foreground stroke-1" />}
                    </div>
                    <div className="mt-1">
                      <p className="text-[15px] font-bold truncate leading-tight">{med.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">{med.dosage} · {med.time_slots?.[0]}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </motion.div>
      </main>
    </>
  );
};

export default Dashboard;
