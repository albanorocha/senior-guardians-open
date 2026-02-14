import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { LayoutDashboard, Pill, History, LogOut, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';

const AppNav = () => {
  const { signOut } = useAuth();
  const location = useLocation();

  const links = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/medications', label: 'Medications', icon: Pill },
    { to: '/check-in', label: 'Check-in', icon: Phone },
    { to: '/history', label: 'History', icon: History },
  ];

  return (
    <nav className="border-b border-border bg-card shadow-soft">
      <div className="container flex items-center justify-between h-16 px-4">
        <Link to="/dashboard" className="text-senior-xl font-bold text-primary">
          Guard<span className="text-secondary">IA</span>ns
        </Link>
        <div className="flex items-center gap-1">
          {links.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to}>
              <Button
                variant={location.pathname === to ? 'default' : 'ghost'}
                size="sm"
                className="gap-2 text-senior-sm"
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
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
  );
};

export default AppNav;
