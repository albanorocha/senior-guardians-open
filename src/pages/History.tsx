import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppNav from '@/components/AppNav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { History as HistoryIcon, ChevronDown, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';

const moodEmoji: Record<string, string> = {
  happy: '😊', neutral: '😐', confused: '😕', distressed: '😟',
};

const History = () => {
  const { user } = useAuth();
  const [checkIns, setCheckIns] = useState<any[]>([]);
  const [responses, setResponses] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data: cis } = await supabase.from('check_ins').select('*').eq('user_id', user.id).order('scheduled_at', { ascending: false });
      setCheckIns(cis || []);

      if (cis && cis.length > 0) {
        const ciIds = cis.map(c => c.id);
        const { data: resps } = await supabase.from('check_in_responses').select('*, medications(name, dosage)').in('check_in_id', ciIds);
        const grouped: Record<string, any[]> = {};
        resps?.forEach(r => {
          if (!grouped[r.check_in_id]) grouped[r.check_in_id] = [];
          grouped[r.check_in_id].push(r);
        });
        setResponses(grouped);
      }
      setLoading(false);
    };
    fetch();
  }, [user]);

  const formatDuration = (s: number | null) => {
    if (!s) return '-';
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}m ${sec}s`;
  };

  if (loading) {
    return (<><AppNav /><main className="container max-w-2xl py-8 px-4 space-y-4"><Skeleton className="h-10 w-48" /><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></main></>);
  }

  return (
    <>
      <AppNav />
      <main className="container max-w-2xl py-8 px-4 space-y-6">
        <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-senior-2xl font-bold flex items-center gap-2">
          <HistoryIcon className="h-7 w-7 text-primary" /> Check-in History
        </motion.h1>

        {checkIns.length === 0 ? (
          <Card className="shadow-soft">
            <CardContent className="py-12 text-center">
              <HistoryIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-senior-base text-muted-foreground">No check-ins yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {checkIns.map((ci, i) => (
              <motion.div key={ci.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Collapsible>
                  <Card className="shadow-soft">
                    <CollapsibleTrigger className="w-full text-left">
                      <CardContent className="flex items-center gap-3 py-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-senior-sm font-semibold">{format(new Date(ci.scheduled_at), 'EEEE, MMM d · h:mm a')}</p>
                          {ci.summary && <p className="text-sm text-muted-foreground truncate mt-1">{ci.summary}</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {ci.mood_detected && <span className="text-lg">{moodEmoji[ci.mood_detected] || '😐'}</span>}
                          {ci.duration_seconds && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />{formatDuration(ci.duration_seconds)}
                            </span>
                          )}
                          <Badge variant={ci.status === 'completed' ? 'default' : ci.status === 'missed' ? 'destructive' : 'secondary'}>
                            {ci.status}
                          </Badge>
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </CardContent>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-6 pb-4 border-t border-border pt-3 space-y-2">
                        {ci.summary && <p className="text-sm text-muted-foreground">{ci.summary}</p>}
                        {responses[ci.id]?.map((r: any) => (
                          <div key={r.id} className="flex items-center justify-between text-sm py-1">
                            <span>{r.medications?.name} ({r.medications?.dosage})</span>
                            <div className="flex items-center gap-2">
                              <Badge variant={r.taken ? 'default' : 'destructive'} className="text-xs">
                                {r.taken ? 'Taken ✓' : 'Not taken'}
                              </Badge>
                              {r.reported_issues && <span className="text-muted-foreground text-xs">— {r.reported_issues}</span>}
                            </div>
                          </div>
                        ))}
                        {(!responses[ci.id] || responses[ci.id].length === 0) && (
                          <p className="text-sm text-muted-foreground">No medication responses recorded.</p>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </>
  );
};

export default History;
