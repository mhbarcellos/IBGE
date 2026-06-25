import { isSupabaseConfigured, supabase } from '../lib/supabaseClient.js';
import { isDemoMode } from './demoMode.js';
import { mockMaterials } from './mockData.js';

export async function listMaterials() {
  if (!isSupabaseConfigured || isDemoMode()) {
    return { data: mockMaterials, error: null, usingMock: true };
  }
  const { data, error } = await supabase.from('study_materials').select('*').order('created_at', { ascending: false });
  return { data: data ?? [], error, usingMock: false };
}
