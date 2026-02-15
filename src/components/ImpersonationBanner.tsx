import { useNavigate } from 'react-router-dom';
import { useImpersonation } from '@/hooks/useImpersonation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Eye } from 'lucide-react';

const ImpersonationBanner = () => {
  const { isImpersonating, impersonatedUserName, stopImpersonating } = useImpersonation();
  const navigate = useNavigate();

  if (!isImpersonating) return null;

  return (
    <div className="bg-primary text-primary-foreground py-2 px-4 flex items-center justify-center gap-3 text-sm font-medium">
      <Eye className="h-4 w-4" />
      <span>Viewing as <strong>{impersonatedUserName || 'Patient'}</strong></span>
      <Button
        size="sm"
        variant="secondary"
        className="h-7 gap-1 text-xs"
        onClick={() => {
          stopImpersonating();
          navigate('/admin');
        }}
      >
        <ArrowLeft className="h-3 w-3" /> Back to Admin
      </Button>
    </div>
  );
};

export default ImpersonationBanner;
