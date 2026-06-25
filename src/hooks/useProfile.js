import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/useAuth.js';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient.js';
import { isDemoMode } from '../services/demoMode.js';

const demoProfile = {
  id: 'demo-user',
  email: 'demo@ibge-estudos.local',
  full_name: 'Usuario demonstracao',
  role: 'admin',
};

export function useProfile() {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadProfile = useCallback(async () => {
    if (authLoading) return;

    if (isDemoMode()) {
      setProfile(demoProfile);
      setError(null);
      setLoading(false);
      return;
    }

    if (!isSupabaseConfigured || !user?.id) {
      setProfile(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      setError(profileError);
      setProfile({ id: user.id, email: user.email, role: 'student' });
    } else {
      setError(null);
      setProfile(data || { id: user.id, email: user.email, role: 'student' });
    }
    setLoading(false);
  }, [authLoading, user?.email, user?.id]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const updateProfile = useCallback(async (payload) => {
    if (isDemoMode()) {
      setProfile((current) => ({ ...(current || demoProfile), full_name: payload.full_name }));
      return { data: { ...(profile || demoProfile), full_name: payload.full_name }, error: null };
    }

    if (!isSupabaseConfigured || !user?.id) {
      return { data: null, error: new Error('Usuario nao autenticado.') };
    }

    const { data, error: updateError } = await supabase
      .from('profiles')
      .update({ full_name: payload.full_name })
      .eq('id', user.id)
      .select()
      .single();

    if (!updateError) setProfile(data);
    return { data, error: updateError };
  }, [profile, user?.id]);

  return useMemo(() => {
    const role = profile?.role || 'student';
    return {
      profile,
      role,
      isAdmin: role === 'admin',
      loading: authLoading || loading,
      error,
      updateProfile,
      refreshProfile: loadProfile,
    };
  }, [authLoading, error, loadProfile, loading, profile, updateProfile]);
}
