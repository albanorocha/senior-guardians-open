import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { LayoutDashboard, Pill, History, LogOut, Phone, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ImpersonationBanner from '@/components/ImpersonationBanner';

const AppNav = () => {
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const location = useLocation();
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    supabase.from('alerts').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('acknowledged', false).then(({ count }) => {
      setAlertCount(count || 0);
    });
  }, [user, location.pathname]);

  const links = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/medications', label: 'Medications', icon: Pill },
    { to: '/check-in', label: 'Check-in', icon: Phone },
    { to: '/history', label: 'History', icon: History },
  ];

  return (
    <>
      <ImpersonationBanner />
      <nav className="border-b border-border bg-card shadow-soft">
        <div className="container flex items-center justify-between h-16 px-4">
          <Link to="/dashboard" className="text-senior-xl font-bold text-primary">
            Guard<span className="text-secondary">IA</span>ns
          </Link>
          <div className="flex items-center gap-1">
            {isAdmin && (
              <Link to="/admin">
                <Button
                  variant={location.pathname === '/admin' ? 'default' : 'ghost'}
                  size="sm"
                  className="gap-2 text-senior-sm"
                >
                  <ShieldCheck className="h-4 w-4" />
                  <span className="hidden sm:inline">Admin</span>
                </Button>
              </Link>
            )}
            {links.map(({ to, label, icon: Icon }) => (
              <Link key={to} to={to}>
                <Button
                  variant={location.pathname === to ? 'default' : 'ghost'}
                  size="sm"
                  className="gap-2 text-senior-sm relative"
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{label}</span>
                  {to === '/dashboard' && alertCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-bold">
                      {alertCount > 9 ? '9+' : alertCount}
                    </span>
                  )}
                </Button>
              </Link>
            ))}
            <Button variant="ghost" size="sm" onClick={signOut} className="gap-2 text-senior-sm ml-2">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </nav>
    </>
  );
};

export default AppNav;
