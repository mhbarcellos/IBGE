import { isSupabaseConfigured, supabase } from '../lib/supabaseClient.js';
import { getRoleFocusLevel, roleFocusMatches, targetRole } from '../lib/targetRole.js';
import { isDemoMode } from './demoMode.js';
import { mockQuestions } from './mockData.js';

export const allDisciplinesValue = '__all_disciplines__';
export const allTopicsValue = '__all_topics__';
export const allRoleFocusValue = 'all';
export const targetRoleFocusValue = 'target';
export const targetRelatedRoleFocusValue = 'target_related';
export const unclassifiedDiscipline = 'Nao classificada';
export const unclassifiedTopic = 'Nao classificado';
const optionKeys = ['A', 'B', 'C', 'D', 'E'];
const validAnswers = optionKeys;

function normalizeText(value) {
  return `${value ?? ''}`.trim();
}

function normalizedDiscipline(question) {
  return normalizeText(question.discipline) || unclassifiedDiscipline;
}

function normalizedTopic(question) {
  return normalizeText(question.topic) || normalizeText(question.subject) || unclassifiedTopic;
}

function hasValidatedAnswer(question) {
  return validAnswers.includes(question.correct_answer);
}

export function normalizeAlternatives(alternatives) {
  if (!alternatives) return { options: {}, error: 'Alternativas nao foram reconhecidas corretamente. Envie para revisao.' };

  if (Array.isArray(alternatives)) {
    const options = {};
    alternatives.slice(0, optionKeys.length).forEach((value, index) => {
      if (value) options[optionKeys[index]] = String(value);
    });
    return { options, error: Object.keys(options).length ? '' : 'Alternativas nao foram reconhecidas corretamente. Envie para revisao.' };
  }

  if (typeof alternatives === 'object') {
    const options = {};
    optionKeys.forEach((key) => {
      const value = alternatives[key] ?? alternatives[key.toLowerCase()];
      if (value) options[key] = String(value);
    });
    return { options, error: Object.keys(options).length ? '' : 'Alternativas nao foram reconhecidas corretamente. Envie para revisao.' };
  }

  if (typeof alternatives === 'string') {
    const options = {};
    const matches = [...alternatives.matchAll(/(?:^|\n)\s*([A-Ea-e])[).]\s*([\s\S]*?)(?=(?:\n\s*[A-Ea-e][).]\s*)|$)/g)];
    matches.forEach((match) => {
      if (match?.[1] && match?.[2]) options[match[1].toUpperCase()] = match[2].trim();
    });
    return { options, error: Object.keys(options).length ? '' : 'Alternativas nao foram reconhecidas corretamente. Envie para revisao.' };
  }

  return { options: {}, error: 'Alternativas nao foram reconhecidas corretamente. Envie para revisao.' };
}

function normalizeQuestion(question) {
  const { options, error } = normalizeAlternatives(question.alternatives);
  const inferredFocus = getRoleFocusLevel([
    question.role,
    question.source_exam_title,
    question.source_page_url,
    question.metadata ? JSON.stringify(question.metadata) : '',
    question.exams?.title,
    question.exams?.role,
    question.exams?.source_page_url,
  ].filter(Boolean).join(' '));
  const roleFocus = question.role_focus || question.exams?.role_focus || inferredFocus;
  return {
    ...question,
    discipline: normalizedDiscipline(question),
    topic: normalizedTopic(question),
    subject: normalizeText(question.subject) || normalizedTopic(question),
    role_focus: roleFocus || 'unknown',
    target_role: question.target_role || question.exams?.target_role || (roleFocus === 'target' ? targetRole : null),
    alternatives: options,
    alternativesError: error,
    explanation_status: question.explanation_status || (question.explanation ? 'reviewed' : 'missing'),
    optionExplanations: question.optionExplanations || {},
  };
}

function matchesSelect(value, selected, allValue) {
  return !selected || selected === allValue || value === selected;
}

function applyFilters(items, filters = {}) {
  return items.map(normalizeQuestion).filter((item) => {
    const matchesDiscipline = matchesSelect(item.discipline, filters.discipline, allDisciplinesValue);
    const matchesTopic = matchesSelect(item.topic, filters.topic || filters.subject, allTopicsValue);
    const matchesBoard = !filters.board || item.exams?.board?.toLowerCase().includes(filters.board.toLowerCase());
    const matchesYear = !filters.year || String(item.exams?.year || '') === String(filters.year);
    const matchesRole = !filters.role || item.exams?.role?.toLowerCase().includes(filters.role.toLowerCase()) || item.exams?.title?.toLowerCase().includes(filters.role.toLowerCase());
    const matchesRoleFocus = roleFocusMatches(item, filters.focusMode || filters.roleFocus || allRoleFocusValue);
    const matchesReviewStatus = filters.includePendingReview || (!item.needs_review && hasValidatedAnswer(item));
    return matchesDiscipline && matchesTopic && matchesBoard && matchesYear && matchesRole && matchesRoleFocus && matchesReviewStatus;
  });
}

async function attachOptionExplanations(questions) {
  if (!isSupabaseConfigured || isDemoMode() || !questions.length) return questions.map(normalizeQuestion);
  const ids = questions.map((question) => question.id);
  const { data, error } = await supabase
    .from('question_option_explanations')
    .select('question_id, option_key, explanation, explanation_status')
    .in('question_id', ids);

  if (error) return questions.map(normalizeQuestion);

  const byQuestion = {};
  for (const row of data ?? []) {
    byQuestion[row.question_id] ??= {};
    byQuestion[row.question_id][row.option_key] = row;
  }

  return questions.map((question) => normalizeQuestion({ ...question, optionExplanations: byQuestion[question.id] || {} }));
}

export async function listQuestions(filters = {}) {
  if (!isSupabaseConfigured || isDemoMode()) {
    return { data: applyFilters(mockQuestions, filters), error: null, usingMock: true };
  }

  let query = supabase.from('questions').select('*, exams(title, year, board, role, source_url, source_page_url, role_focus, target_role)').order('created_at', {
    ascending: false,
  });

  if (!filters.includePendingReview) {
    query = query.eq('needs_review', false).not('correct_answer', 'is', null).neq('correct_answer', 'PENDING');
  }

  const { data, error } = await query;
  let filtered = applyFilters(await attachOptionExplanations(data ?? []), filters);

  if (filters.board) {
    filtered = filtered.filter((item) => item.exams?.board?.toLowerCase().includes(filters.board.toLowerCase()));
  }
  if (filters.year) {
    filtered = filtered.filter((item) => String(item.exams?.year || '') === String(filters.year));
  }
  if (filters.role) {
    filtered = filtered.filter((item) => item.exams?.role?.toLowerCase().includes(filters.role.toLowerCase()) || item.exams?.title?.toLowerCase().includes(filters.role.toLowerCase()));
  }

  return { data: filtered, error, usingMock: false };
}

export async function getQuestionFilterOptions(baseFilters = {}) {
  const { data, error, usingMock } = await listQuestions({
    ...baseFilters,
    includePendingReview: baseFilters.includePendingReview ?? false,
  });
  const valid = data.filter((question) => (baseFilters.includePendingReview || (!question.needs_review && hasValidatedAnswer(question))));
  const disciplineSet = new Set(valid.map((question) => question.discipline || unclassifiedDiscipline));
  const selectedDiscipline = baseFilters.discipline || allDisciplinesValue;
  const topicSource = selectedDiscipline === allDisciplinesValue
    ? valid
    : valid.filter((question) => question.discipline === selectedDiscipline);
  const topicSet = new Set(topicSource.map((question) => question.topic || unclassifiedTopic));

  return {
    data: {
      disciplines: [allDisciplinesValue, ...[...disciplineSet].sort()],
      topics: [allTopicsValue, ...[...topicSet].sort()],
      count: applyFilters(valid, baseFilters).length,
    },
    error,
    usingMock,
  };
}

export async function getTrainingQuestions(filters = {}) {
  const { data, error, usingMock } = await listQuestions({ ...filters, includePendingReview: filters.includePendingReview ?? false });
  const limit = Number(filters.limit || 5);
  return { data: data.filter(hasValidatedAnswer).slice(0, limit), error, usingMock };
}

export async function createQuestion(payload) {
  if (isDemoMode()) {
    return {
      data: {
        ...payload,
        id: `demo-question-${Date.now()}`,
        created_at: new Date().toISOString(),
      },
      error: null,
    };
  }

  if (!isSupabaseConfigured) {
    return { data: null, error: new Error('Configure o Supabase para cadastrar questoes.') };
  }
  return supabase.from('questions').insert(payload).select().single();
}
