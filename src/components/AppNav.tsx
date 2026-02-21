import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { LayoutDashboard, Pill, History, LogOut, Phone, ShieldCheck, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import ImpersonationBanner from '@/components/ImpersonationBanner';

const AppNav = () => {
  const { user } = useAuth();
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
    { to: '/dashboard', label: 'Home', icon: LayoutDashboard },
    { to: '/medications', label: 'Meds', icon: Pill },
    { to: '/check-in', label: 'Check-in', icon: Phone },
    { to: '/history', label: 'History', icon: History },
  ];

  return (
    <>
      <ImpersonationBanner />
      <nav className="fixed bottom-0 left-0 right-0 border-t border-border bg-card/90 backdrop-blur-lg shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)] z-50 pb-safe">
        <div className="container max-w-2xl px-2 h-16 flex items-center justify-around">
          {links.map(({ to, label, icon: Icon }) => {
            const isActive = location.pathname === to;
            return (
              <Link key={to} to={to} className="flex-1">
                <Button
                  variant="ghost"
                  className={`w-full flex-col h-14 gap-1 rounded-xl ${isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-transparent'}`}
                >
                  <div className="relative">
                    <Icon className={`h-6 w-6 transition-transform ${isActive ? 'scale-110' : ''}`} strokeWidth={isActive ? 2.5 : 2} />
                    {to === '/dashboard' && alertCount > 0 && (
                      <span className="absolute -top-1 -right-2 w-3 h-3 rounded-full bg-destructive border-2 border-card" />
                    )}
                  </div>
                  <span className="text-[10px] font-semibold">{label}</span>
                </Button>
              </Link>
            )
          })}
          {isAdmin && (
            <Link to="/admin" className="flex-1">
              <Button
                variant="ghost"
                className={`w-full flex-col h-14 gap-1 rounded-xl ${location.pathname === '/admin' ? 'text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-transparent'}`}
              >
                <ShieldCheck className={`h-6 w-6 ${location.pathname === '/admin' ? 'scale-110' : ''}`} strokeWidth={location.pathname === '/admin' ? 2.5 : 2} />
                <span className="text-[10px] font-semibold">Admin</span>
              </Button>
            </Link>
          )}
        </div>
      </nav>
    </>
  );
};

export default AppNav;
