import { mockQuestions } from './mockData.js';

export const demoModeKey = 'ibge_demo_mode';
const demoAttemptsKey = 'ibge_demo_attempts';

export const demoUser = {
  id: 'demo-user',
  email: 'demo@ibge-estudos.local',
};

export const demoSession = {
  user: demoUser,
  access_token: 'demo-session',
};

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function isDemoMode() {
  return canUseStorage() && window.localStorage.getItem(demoModeKey) === 'true';
}

export function enableDemoMode() {
  if (canUseStorage()) {
    window.localStorage.setItem(demoModeKey, 'true');
  }
}

export function disableDemoMode() {
  if (canUseStorage()) {
    window.localStorage.removeItem(demoModeKey);
    window.localStorage.removeItem(demoAttemptsKey);
  }
}

export function getDemoAttempts() {
  if (!canUseStorage()) return [];

  const stored = window.localStorage.getItem(demoAttemptsKey);
  if (!stored) return [];

  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

export function saveDemoAttempt(payload) {
  if (!canUseStorage()) return null;

  const question = mockQuestions.find((item) => item.id === payload.question_id);
  const attempt = {
    id: crypto.randomUUID(),
    user_id: demoUser.id,
    question_id: payload.question_id,
    selected_answer: payload.selected_answer,
    is_correct: payload.is_correct,
    created_at: new Date().toISOString(),
    questions: question
      ? {
          id: question.id,
          discipline: question.discipline,
          subject: question.subject,
          statement: question.statement,
          correct_answer: question.correct_answer,
        }
      : null,
  };

  const attempts = [attempt, ...getDemoAttempts()];
  window.localStorage.setItem(demoAttemptsKey, JSON.stringify(attempts));
  return attempt;
}
