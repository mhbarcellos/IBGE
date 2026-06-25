import { isSupabaseConfigured, supabase } from '../lib/supabaseClient.js';
import { isDemoMode } from './demoMode.js';
import { mockExams } from './mockData.js';

export async function listExams() {
  if (!isSupabaseConfigured || isDemoMode()) {
    return { data: mockExams, error: null, usingMock: true };
  }

  const { data, error } = await supabase.from('exams').select('*').order('year', { ascending: false });
  return { data: data?.length ? data : [], error, usingMock: false };
}

export async function createExam(payload) {
  if (isDemoMode()) {
    return {
      data: {
        ...payload,
        id: `demo-exam-${Date.now()}`,
        created_at: new Date().toISOString(),
      },
      error: null,
    };
  }

  if (!isSupabaseConfigured) {
    return { data: null, error: new Error('Configure o Supabase para cadastrar provas.') };
  }
  return supabase.from('exams').insert(payload).select().single();
}
