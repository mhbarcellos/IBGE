export function normalizeWhitespace(value = '') {
  return value.replace(/\s+/g, ' ').trim();
}

export function parseYear(text = '') {
  const match = text.match(/\b(20\d{2}|19\d{2})\b/);
  return match ? Number(match[1]) : null;
}

export function parseBoard(text = '') {
  return text.match(/\b(FGV|IBFC|Cebraspe|Cesgranrio|AOCP|Consulplan|Vunesp|IADES|SELECON|IBADE|NCE\/UFRJ)\b/i)?.[1] ?? null;
}

export function classifyPdf(label = '', url = '') {
  const value = `${label} ${url}`.toLowerCase();
  const hasFileSignal = /\.pdf(?:$|\?|#|\s)/i.test(value) || /download|baixar|arquivo/i.test(value);
  if (!hasFileSignal) return null;
  if (/gabarito|resposta|answer/.test(value)) return 'gabarito';
  if (/prova|caderno|quest(?:a|ã|o)es|questoes|questões/.test(value)) return 'prova';
  return null;
}

export function isAdministrativeDocument(text = '') {
  return /edital|comunicado|resultado|convoca[cç][aã]o|cronograma|inscri[cç][aã]o|homologa[cç][aã]o|retifica[cç][aã]o|recurso|isencao|isen[cç][aã]o|termos de uso|aviso de cookies|aviso de privacidade|privacidade|cookies|lgpd/i.test(text);
}

export async function upsertExam(supabase, payload) {
  const existing = await supabase
    .from('exams')
    .select('*')
    .eq('source_page_url', payload.source_page_url)
    .maybeSingle();
  if (existing.error) throw existing.error;

  if (existing.data) {
    const { data, error } = await supabase.from('exams').update(payload).eq('id', existing.data.id).select().single();
    if (error) throw error;
    return { data, created: false };
  }

  const { data, error } = await supabase.from('exams').insert(payload).select().single();
  if (error) throw error;
  return { data, created: true };
}

export async function upsertExamFile(supabase, examId, payload) {
  const existing = await supabase
    .from('exam_files')
    .select('id')
    .eq('exam_id', examId)
    .eq('url', payload.url)
    .maybeSingle();
  if (existing.error) throw existing.error;

  if (existing.data) {
    const { error } = await supabase.from('exam_files').update(payload).eq('id', existing.data.id);
    if (error) throw error;
    return 'updated';
  }

  const { error } = await supabase.from('exam_files').insert({ ...payload, exam_id: examId });
  if (error) throw error;
  return 'inserted';
}
