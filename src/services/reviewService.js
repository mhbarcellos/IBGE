import { isSupabaseConfigured, supabase } from '../lib/supabaseClient.js';
import { isDemoMode } from './demoMode.js';
import { mockQuestions } from './mockData.js';

const fallbackSourceName = 'Importação manual';

function candidateToReviewItem(candidate, sourceByFileId) {
  const sourceName = sourceByFileId.get(candidate.source_exam_file_id) || sourceByFileId.get(candidate.source_gabarito_file_id) || fallbackSourceName;
  return {
    ...candidate,
    reviewType: 'candidate',
    discipline: candidate.subject || '',
    subject: candidate.topic || '',
    alternatives: {
      A: candidate.option_a,
      B: candidate.option_b,
      C: candidate.option_c,
      D: candidate.option_d,
      E: candidate.option_e,
    },
    import_notes: candidate.parse_notes,
    source_name: sourceName,
  };
}

async function loadCandidateSources(candidates) {
  const ids = [...new Set(
    (candidates ?? [])
      .flatMap((candidate) => [candidate.source_exam_file_id, candidate.source_gabarito_file_id])
      .filter(Boolean),
  )];

  if (!ids.length) return new Map();

  const { data, error } = await supabase.from('exam_files').select('id, source_name').in('id', ids);
  if (error) return new Map();
  return new Map((data ?? []).map((file) => [file.id, file.source_name]));
}

export async function listReviewQuestions(filters = {}) {
  if (!isSupabaseConfigured || isDemoMode()) {
    return {
      data: mockQuestions.slice(0, 1).map((question) => ({
        ...question,
        reviewType: 'question',
        needs_review: true,
        import_notes: 'Exemplo demonstrativo de revisao.',
        source_name: fallbackSourceName,
      })),
      error: null,
    };
  }

  let questionsQuery = supabase
    .from('questions')
    .select('*, exams(id, title, year, board, role, source_page_url)')
    .eq('needs_review', true)
    .order('created_at', { ascending: false });

  if (filters.discipline) questionsQuery = questionsQuery.ilike('discipline', `%${filters.discipline}%`);
  if (filters.sourceName) questionsQuery = questionsQuery.ilike('source_name', `%${filters.sourceName}%`);
  if (filters.noAnswer) questionsQuery = questionsQuery.is('correct_answer', null);

  let candidatesQuery = supabase
    .from('question_parse_candidates')
    .select('*, exams(id, title, year, board, role, source_page_url)')
    .neq('parse_status', 'approved')
    .order('created_at', { ascending: false });

  if (filters.noAnswer) candidatesQuery = candidatesQuery.is('correct_answer', null);

  const [questionsResult, candidatesResult] = await Promise.all([questionsQuery, candidatesQuery]);
  const sourceByFileId = await loadCandidateSources(candidatesResult.data ?? []);
  const error = questionsResult.error || candidatesResult.error;
  let filtered = [
    ...(questionsResult.data ?? []).map((item) => ({ ...item, reviewType: 'question' })),
    ...(candidatesResult.data ?? []).map((candidate) => candidateToReviewItem(candidate, sourceByFileId)),
  ];

  if (filters.examId) filtered = filtered.filter((item) => item.exam_id === filters.examId);
  if (filters.year) filtered = filtered.filter((item) => String(item.exams?.year || '') === String(filters.year));
  if (filters.board) filtered = filtered.filter((item) => item.exams?.board?.toLowerCase().includes(filters.board.toLowerCase()));
  if (filters.discipline) filtered = filtered.filter((item) => item.discipline?.toLowerCase().includes(filters.discipline.toLowerCase()));
  if (filters.sourceName) filtered = filtered.filter((item) => item.source_name?.toLowerCase().includes(filters.sourceName.toLowerCase()));

  return { data: filtered, error };
}

export async function updateReviewQuestion(id, payload) {
  if (isDemoMode()) return { data: { id, ...payload }, error: null };
  if (!isSupabaseConfigured) return { data: null, error: new Error('Configure o Supabase para revisar questoes.') };
  return supabase.from('questions').update(payload).eq('id', id).select().single();
}

export async function approveParseCandidate(candidate, draft) {
  if (isDemoMode()) return { data: { id: `demo-approved-${candidate.id}` }, error: null };
  if (!isSupabaseConfigured) return { data: null, error: new Error('Configure o Supabase para aprovar candidatas.') };

  const sourceName = candidate.source_name || fallbackSourceName;
  const sourceQuestionId = candidate.source_question_id || `manual:${candidate.exam_id}:${candidate.number}`;
  const payload = {
    exam_id: candidate.exam_id,
    number: candidate.number,
    discipline: draft.discipline || candidate.subject || 'Geral',
    subject: draft.subject || candidate.topic || 'Conhecimentos gerais',
    statement: draft.statement,
    alternatives: draft.alternatives,
    correct_answer: draft.correct_answer || null,
    explanation: draft.explanation || null,
    difficulty: 'media',
    source_name: sourceName,
    source_page_url: candidate.exams?.source_page_url || null,
    source_question_id: sourceQuestionId,
    import_status: 'reviewed',
    import_notes: candidate.parse_notes || null,
    needs_review: false,
  };

  const existing = await supabase
    .from('questions')
    .select('id')
    .eq('source_name', sourceName)
    .eq('source_question_id', sourceQuestionId)
    .maybeSingle();
  if (existing.error) return { data: null, error: existing.error };

  const result = existing.data
    ? await supabase.from('questions').update(payload).eq('id', existing.data.id).select().single()
    : await supabase.from('questions').insert(payload).select().single();

  if (result.error) return result;

  const updateCandidate = await supabase.from('question_parse_candidates').update({ parse_status: 'approved' }).eq('id', candidate.id);
  if (updateCandidate.error) return { data: result.data, error: updateCandidate.error };

  return result;
}
