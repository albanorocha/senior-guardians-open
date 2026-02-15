import { createContext, useContext, useState, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface ImpersonationContextType {
  impersonatedUserId: string | null;
  impersonatedUserName: string | null;
  setImpersonatedUser: (id: string | null, name?: string | null) => void;
  effectiveUserId: string | null;
  isImpersonating: boolean;
  stopImpersonating: () => void;
}

const ImpersonationContext = createContext<ImpersonationContextType>({
  impersonatedUserId: null,
  impersonatedUserName: null,
  setImpersonatedUser: () => {},
  effectiveUserId: null,
  isImpersonating: false,
  stopImpersonating: () => {},
});

export const ImpersonationProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [impersonatedUserId, setImpersonatedUserId] = useState<string | null>(null);
  const [impersonatedUserName, setImpersonatedUserName] = useState<string | null>(null);

  const setImpersonatedUser = (id: string | null, name?: string | null) => {
    setImpersonatedUserId(id);
    setImpersonatedUserName(name || null);
  };

  const stopImpersonating = () => {
    setImpersonatedUserId(null);
    setImpersonatedUserName(null);
  };

  const effectiveUserId = impersonatedUserId || user?.id || null;
  const isImpersonating = !!impersonatedUserId;

  return (
    <ImpersonationContext.Provider
      value={{ impersonatedUserId, impersonatedUserName, setImpersonatedUser, effectiveUserId, isImpersonating, stopImpersonating }}
    >
      {children}
    </ImpersonationContext.Provider>
  );
};

export const useImpersonation = () => useContext(ImpersonationContext);
