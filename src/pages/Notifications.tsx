import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useImpersonation } from '@/hooks/useImpersonation';
import AppNav from '@/components/AppNav';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Bell, AlertTriangle, Info, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

const Notifications = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { effectiveUserId } = useImpersonation();
    const [alerts, setAlerts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!effectiveUserId) return;

        const fetchAlerts = async () => {
            const { data, error } = await supabase
                .from('alerts')
                .select('*')
                .eq('user_id', effectiveUserId)
                .order('created_at', { ascending: false });

            if (!error && data) {
                setAlerts(data);
            }
            setLoading(false);
        };

        fetchAlerts();
    }, [effectiveUserId]);

    const handleAcknowledge = async (id: string) => {
        await supabase.from('alerts').update({ acknowledged: true }).eq('id', id);
        setAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true } : a));
    };

    const handleAcknowledgeAll = async () => {
        const unreadIds = alerts.filter(a => !a.acknowledged).map(a => a.id);
        if (unreadIds.length === 0) return;

        await supabase.from('alerts').update({ acknowledged: true }).in('id', unreadIds);
        setAlerts(prev => prev.map(a => ({ ...a, acknowledged: true })));
    };

    const unreadAlerts = alerts.filter(a => !a.acknowledged);
    const historyAlerts = alerts.filter(a => a.acknowledged);

    const getAlertIcon = (type: string, severity: string) => {
        if (type === 'emergency') return <AlertTriangle className="h-6 w-6 text-destructive" />;
        if (type === 'caregiver') return <ShieldCheck className="h-6 w-6 text-blue-500" />;
        if (severity === 'high') return <AlertTriangle className="h-6 w-6 text-orange-500" />;
        return <Info className="h-6 w-6 text-primary" />;
    };

    const getAlertColor = (type: string, severity: string) => {
        if (type === 'emergency') return 'border-destructive bg-destructive/5';
        if (type === 'caregiver') return 'border-blue-500 bg-blue-500/5';
        if (severity === 'high') return 'border-orange-500 bg-orange-500/5';
        return 'border-border bg-card';
    };

    return (
        <>
            <AppNav />
            <main className="container max-w-2xl py-6 pb-24 px-4 bg-background min-h-screen">
                {/* Header */}
                <header className="flex items-center gap-3 mb-6">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full h-10 w-10 shrink-0">
                        <ArrowLeft className="h-6 w-6 text-foreground" />
                    </Button>
                    <div className="flex-1">
                        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                            <Bell className="h-6 w-6 text-primary" />
                            Notifications
                        </h1>
                    </div>
                </header>

                {loading ? (
                    <div className="space-y-4">
                        <Skeleton className="h-24 w-full rounded-xl" />
                        <Skeleton className="h-24 w-full rounded-xl" />
                        <Skeleton className="h-24 w-full rounded-xl" />
                    </div>
                ) : (
                    <Tabs defaultValue="new" className="w-full">
                        <TabsList className="w-full grid w-full grid-cols-2 mb-6 bg-muted/50 p-1 rounded-xl">
                            <TabsTrigger value="new" className="rounded-lg text-senior-base font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm">
                                New ({unreadAlerts.length})
                            </TabsTrigger>
                            <TabsTrigger value="history" className="rounded-lg text-senior-base font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm">
                                History
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="new" className="space-y-4 mt-0">
                            {unreadAlerts.length > 0 && (
                                <div className="flex justify-end mb-2">
                                    <Button variant="ghost" size="sm" onClick={handleAcknowledgeAll} className="text-primary font-semibold text-sm h-8">
                                        <CheckCircle2 className="mr-2 h-4 w-4" /> Mark all as read
                                    </Button>
                                </div>
                            )}

                            <AnimatePresence>
                                {unreadAlerts.length === 0 ? (
                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                                        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                                            <CheckCircle2 className="h-8 w-8 text-primary" />
                                        </div>
                                        <p className="text-lg font-medium text-foreground">All caught up!</p>
                                        <p className="text-sm">You have no new notifications.</p>
                                    </motion.div>
                                ) : (
                                    unreadAlerts.map((alert) => (
                                        <motion.div key={alert.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} layout>
                                            <Card className={`border-2 shadow-sm ${getAlertColor(alert.type, alert.severity)}`}>
                                                <CardContent className="p-4 flex gap-4 items-start">
                                                    <div className="mt-1 bg-background rounded-full p-2 shadow-sm border">
                                                        {getAlertIcon(alert.type, alert.severity)}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex justify-between items-start gap-2 mb-1">
                                                            <h3 className="font-bold text-foreground text-senior-base leading-tight">
                                                                {alert.reason}
                                                            </h3>
                                                        </div>
                                                        <p className="text-sm text-muted-foreground mb-3 font-medium">
                                                            {format(new Date(alert.created_at), 'EEEE, MMM d · h:mm a')}
                                                        </p>

                                                        <div className="flex flex-wrap gap-2 items-center">
                                                            {alert.type === 'caregiver' && (
                                                                <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-0 text-xs">Caregiver Notified</Badge>
                                                            )}
                                                            {alert.tag && (
                                                                <Badge variant="outline" className="text-xs">{alert.tag}</Badge>
                                                            )}
                                                            <div className="flex-1" />
                                                            <Button size="sm" onClick={() => handleAcknowledge(alert.id)} className="rounded-full px-5 shadow-sm font-semibold">
                                                                Dismiss
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </motion.div>
                                    ))
                                )}
                            </AnimatePresence>
                        </TabsContent>

                        <TabsContent value="history" className="space-y-4 mt-0">
                            {historyAlerts.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                                        <Bell className="h-8 w-8 opacity-50" />
                                    </div>
                                    <p className="text-sm">No notification history.</p>
                                </div>
                            ) : (
                                historyAlerts.map((alert) => (
                                    <Card key={alert.id} className="border border-border bg-muted/20 shadow-none opacity-80">
                                        <CardContent className="p-4 flex gap-4 items-center">
                                            <div className="opacity-50 grayscale">
                                                {getAlertIcon(alert.type, alert.severity)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-medium text-foreground text-sm line-through decoration-muted-foreground/30">
                                                    {alert.reason}
                                                </h3>
                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                    {format(new Date(alert.created_at), 'MMM d, yyyy · h:mm a')}
                                                </p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))
                            )}
                        </TabsContent>
                    </Tabs>
                )}
            </main>
        </>
    );
};

export default Notifications;
