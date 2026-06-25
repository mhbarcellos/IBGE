import { useEffect, useMemo, useState } from 'react';
import { demoSession, disableDemoMode, enableDemoMode, isDemoMode } from '../services/demoMode.js';
import { getSession, onAuthStateChange, signOut } from '../services/authService.js';
import { AuthContext } from './AuthContextValue.js';

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let unsubscribe = null;

    if (isDemoMode()) {
      setSession(demoSession);
      setLoading(false);
      return () => {
        mounted = false;
      };
    }

    getSession().then(({ session: currentSession }) => {
      if (mounted) {
        setSession(currentSession);
        setLoading(false);
      }
    });

    unsubscribe = onAuthStateChange((nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      enterDemoMode: () => {
        enableDemoMode();
        setSession(demoSession);
      },
      signOut: async () => {
        disableDemoMode();
        await signOut();
        setSession(null);
      },
    }),
    [loading, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
