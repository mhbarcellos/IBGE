import { isSupabaseConfigured, supabase } from '../lib/supabaseClient.js';
import { getDemoSimulatedExams, isDemoMode, saveDemoSimulatedExam } from './demoMode.js';

export async function createSimulatedExam(payload) {
  if (isDemoMode()) {
    return { data: saveDemoSimulatedExam(payload), error: null, skippedPersistence: false };
  }

  if (!isSupabaseConfigured) {
    return { data: null, error: null, skippedPersistence: true };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user?.id) {
    return { data: null, error: userError || new Error('Usuário não autenticado.'), skippedPersistence: true };
  }

  const { data, error } = await supabase
    .from('simulated_exams')
    .insert({ ...payload, user_id: userData.user.id })
    .select()
    .single();

  if (error) return { data: null, error, skippedPersistence: true };
  return { data, error: null, skippedPersistence: false };
}

export async function saveSimulatedExamQuestion(payload) {
  if (isDemoMode() || !isSupabaseConfigured || !payload.simulated_exam_id) {
    return { data: null, error: null, skippedPersistence: true };
  }

  const { data, error } = await supabase.from('simulated_exam_questions').insert(payload).select().single();
  if (error) return { data: null, error, skippedPersistence: true };
  return { data, error, skippedPersistence: false };
}

export async function finishSimulatedExam(id, payload) {
  if (isDemoMode() || !isSupabaseConfigured || !id) {
    return { data: null, error: null, skippedPersistence: true };
  }

  const { data, error } = await supabase
    .from('simulated_exams')
    .update({ ...payload, finished_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) return { data: null, error, skippedPersistence: true };
  return { data, error, skippedPersistence: false };
}

export async function listSimulatedExams() {
  if (isDemoMode()) {
    return { data: getDemoSimulatedExams(), error: null };
  }

  if (!isSupabaseConfigured) return { data: [], error: null };

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user?.id) return { data: [], error: userError };

  return supabase
    .from('simulated_exams')
    .select('*')
    .eq('user_id', userData.user.id)
    .order('created_at', { ascending: false });
}
