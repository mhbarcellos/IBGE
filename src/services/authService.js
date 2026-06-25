import { isSupabaseConfigured, supabase, supabaseConfigMessage } from '../lib/supabaseClient.js';

export async function signInWithPassword(email, password) {
  if (!isSupabaseConfigured) {
    return { data: null, error: new Error(supabaseConfigMessage) };
  }
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUp(email, password) {
  if (!isSupabaseConfigured) {
    return { data: null, error: new Error(supabaseConfigMessage) };
  }
  return supabase.auth.signUp({ email, password });
}

export async function resetPassword(email) {
  if (!isSupabaseConfigured) {
    return { data: null, error: new Error(supabaseConfigMessage) };
  }

  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
}

export async function updatePassword(newPassword) {
  if (!isSupabaseConfigured) {
    return { data: null, error: new Error(supabaseConfigMessage) };
  }

  return supabase.auth.updateUser({
    password: newPassword,
  });
}

export async function signOut() {
  if (!isSupabaseConfigured) {
    return { error: null };
  }
  return supabase.auth.signOut();
}

export async function getSession() {
  if (!isSupabaseConfigured) {
    return { session: null, error: null };
  }
  const { data, error } = await supabase.auth.getSession();
  return { session: data?.session ?? null, error };
}

export function onAuthStateChange(callback) {
  if (!isSupabaseConfigured) {
    return () => {};
  }

  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });

  return () => data.subscription.unsubscribe();
}
