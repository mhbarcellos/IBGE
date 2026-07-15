import { isSupabaseConfigured, supabase } from '../lib/supabaseClient.js';
import { getDemoAttempts, isDemoMode, saveDemoAttempt } from './demoMode.js';

function summarizeAttempts(attempts) {
  const total = attempts.length;
  const correct = attempts.filter((attempt) => attempt.is_correct).length;
  const percent = total ? Math.round((correct / total) * 100) : 0;
  const byDiscipline = {};
  const bySubject = {};

  attempts.forEach((attempt) => {
    const question = attempt.questions ?? {};
    const discipline = question.discipline || 'Sem disciplina';
    const subject = question.subject || 'Sem assunto';

    byDiscipline[discipline] ??= { total: 0, correct: 0 };
    bySubject[subject] ??= { total: 0, correct: 0 };
    byDiscipline[discipline].total += 1;
    bySubject[subject].total += 1;
    if (attempt.is_correct) {
      byDiscipline[discipline].correct += 1;
      bySubject[subject].correct += 1;
    }
  });

  const subjectMostWrong =
    Object.entries(bySubject)
      .map(([name, value]) => ({ name, wrong: value.total - value.correct }))
      .sort((a, b) => b.wrong - a.wrong)[0]?.name ?? 'Sem dados';

  const bestDiscipline =
    Object.entries(byDiscipline)
      .map(([name, value]) => ({ name, percent: value.total ? Math.round((value.correct / value.total) * 100) : 0 }))
      .sort((a, b) => b.percent - a.percent)[0]?.name ?? 'Sem dados';

  return {
    total,
    correct,
    wrong: total - correct,
    percent,
    subjectMostWrong,
    bestDiscipline,
    byDiscipline,
    bySubject,
    recentWrong: attempts.filter((attempt) => !attempt.is_correct).slice(0, 5),
  };
}

export async function listAttempts(userId) {
  if (isDemoMode()) {
    return { data: getDemoAttempts(), error: null };
  }

  if (!isSupabaseConfigured || !userId) {
    return { data: [], error: null };
  }

  return supabase
    .from('question_attempts')
    .select('*, questions(id, discipline, subject, topic, statement, alternatives, correct_answer, explanation, explanation_status, exams(id, title, year, board, role, role_focus))')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
}

export async function listWrongAttempts(userId) {
  const { data, error } = await listAttempts(userId);
  if (error) return { data: [], error };
  return { data: (data ?? []).filter((attempt) => !attempt.is_correct), error: null };
}

export async function getPerformanceSummary(userId) {
  const { data, error } = await listAttempts(userId);
  if (error) {
    return { data: summarizeAttempts([]), error };
  }
  return { data: summarizeAttempts(data ?? []), error: null };
}

export async function saveAttempt(payload) {
  if (isDemoMode()) {
    return { data: saveDemoAttempt(payload), error: null };
  }

  if (!isSupabaseConfigured) {
    return { data: null, error: null };
  }
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user?.id) {
    return { data: null, error: userError || new Error('Usuario nao autenticado.') };
  }

  return supabase
    .from('question_attempts')
    .insert({ ...payload, user_id: payload.user_id || userData.user.id })
    .select()
    .single();
}
