import { isSupabaseConfigured, supabase } from '../lib/supabaseClient.js';
import { isDemoMode } from './demoMode.js';

const defaultSourceName = 'Importação manual';

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

async function findOrCreateExam(payload) {
  let query = supabase.from('exams').select('*').eq('title', payload.title);
  query = payload.year ? query.eq('year', payload.year) : query.is('year', null);
  query = payload.board ? query.eq('board', payload.board) : query.is('board', null);
  query = payload.role ? query.eq('role', payload.role) : query.is('role', null);

  const existing = await query.maybeSingle();
  if (existing.error) return existing;
  if (existing.data) {
    return supabase.from('exams').update(payload).eq('id', existing.data.id).select().single();
  }

  return supabase.from('exams').insert(payload).select().single();
}

async function upsertExamFile(examId, file) {
  const existing = await supabase
    .from('exam_files')
    .select('id')
    .eq('exam_id', examId)
    .eq('url', file.url)
    .maybeSingle();
  if (existing.error) return existing;

  if (existing.data) {
    return supabase.from('exam_files').update(file).eq('id', existing.data.id).select().single();
  }

  return supabase.from('exam_files').insert({ ...file, exam_id: examId }).select().single();
}

export async function registerManualPdfPair(form) {
  if (isDemoMode()) {
    return {
      data: {
        exam: { id: `demo-exam-${Date.now()}`, title: form.title },
        files: [],
      },
      error: null,
    };
  }

  if (!isSupabaseConfigured) {
    return { data: null, error: new Error('Configure o Supabase para cadastrar PDFs.') };
  }

  const sourceName = form.sourceName || defaultSourceName;
  const examPayload = {
    title: form.title,
    year: numberOrNull(form.year),
    board: form.board || null,
    role: form.role || null,
    organization: form.organization || null,
    source_name: sourceName,
    source_page_url: form.sourcePageUrl || null,
    source_url: form.sourcePageUrl || form.proofPdfUrl,
    imported_at: new Date().toISOString(),
  };

  const examResult = await findOrCreateExam(examPayload);
  if (examResult.error) return { data: null, error: examResult.error };

  const files = [
    {
      file_type: 'prova',
      title: `${examResult.data.title} - prova`,
      url: form.proofPdfUrl,
      source_name: sourceName,
      status: 'approved',
    },
  ];

  if (form.answerPdfUrl) {
    files.push({
      file_type: 'gabarito',
      title: `${examResult.data.title} - gabarito`,
      url: form.answerPdfUrl,
      source_name: sourceName,
      status: 'approved',
    });
  }

  const savedFiles = [];
  for (const file of files) {
    const fileResult = await upsertExamFile(examResult.data.id, file);
    if (fileResult.error) return { data: null, error: fileResult.error };
    savedFiles.push(fileResult.data);
  }

  return { data: { exam: examResult.data, files: savedFiles }, error: null };
}
