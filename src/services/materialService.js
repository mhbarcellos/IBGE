import { isSupabaseConfigured, supabase } from '../lib/supabaseClient.js';
import { getRoleFocusLevel } from '../lib/targetRole.js';
import { isDemoMode } from './demoMode.js';
import { mockMaterials } from './mockData.js';

const focusOrder = { target: 0, related: 1, unknown: 2, other: 3 };

function normalizeMaterial(material) {
  const roleFocus = material.role_focus || getRoleFocusLevel(`${material.title} ${material.subject || ''} ${material.topic || ''}`);
  return { ...material, role_focus: roleFocus || 'unknown' };
}

function sortByFocus(materials) {
  return materials
    .map(normalizeMaterial)
    .sort((a, b) => (focusOrder[a.role_focus] ?? 9) - (focusOrder[b.role_focus] ?? 9) || String(a.title).localeCompare(String(b.title)));
}

export async function listMaterials() {
  if (!isSupabaseConfigured || isDemoMode()) {
    return { data: sortByFocus(mockMaterials), error: null, usingMock: true };
  }
  const { data, error } = await supabase.from('study_materials').select('*').order('created_at', { ascending: false });
  return { data: sortByFocus(data ?? []), error, usingMock: false };
}
