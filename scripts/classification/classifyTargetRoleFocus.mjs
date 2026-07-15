import { createSupabaseSeedClient, isMissingSchemaError } from '../utils/supabaseSeedClient.mjs';
import { getMatchedRoleAlias, getRoleFocusLevel, targetRole } from '../../src/lib/targetRole.js';

const focusKeys = ['target', 'related', 'other', 'unknown'];

function emptySummary() {
  return Object.fromEntries(focusKeys.map((key) => [key, 0]));
}

function increment(summary, focus) {
  const key = focusKeys.includes(focus) ? focus : 'unknown';
  summary[key] += 1;
}

function metadataText(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

function examText(exam = {}) {
  return [
    exam.title,
    exam.role,
    exam.source_url,
    exam.source_page_url,
    exam.source_name,
    exam.board,
    exam.year,
  ].filter(Boolean).join(' ');
}

function questionText(question = {}, exam = {}) {
  return [
    question.source_exam_title,
    question.source_page_url,
    question.source_name,
    question.import_notes,
    metadataText(question.metadata),
    examText(exam),
  ].filter(Boolean).join(' ');
}

async function updateRow(supabase, table, id, payload) {
  const { error } = await supabase.from(table).update(payload).eq('id', id);
  if (error) throw error;
}

console.log('Classificando foco de cargo das provas e questões...');
console.log(`Cargo-alvo: ${targetRole}`);

const supabase = await createSupabaseSeedClient();

const examsResult = await supabase.from('exams').select('*');
if (examsResult.error) throw examsResult.error;

const questionsResult = await supabase.from('questions').select('*');
if (questionsResult.error) throw questionsResult.error;

const exams = examsResult.data ?? [];
const questions = questionsResult.data ?? [];
const examById = new Map(exams.map((exam) => [exam.id, exam]));

const examSummary = emptySummary();
const questionSummary = emptySummary();
const examFocusById = new Map();

try {
  for (const exam of exams) {
    const text = examText(exam);
    const focus = getRoleFocusLevel(text);
    const alias = getMatchedRoleAlias(text);
    examFocusById.set(exam.id, focus);
    increment(examSummary, focus);
    await updateRow(supabase, 'exams', exam.id, {
      role_focus: focus,
      target_role: targetRole,
      role_alias_matched: alias || null,
    });
  }

  for (const question of questions) {
    const exam = question.exam_id ? examById.get(question.exam_id) : null;
    const questionFocus = getRoleFocusLevel(questionText(question, exam));
    const propagatedFocus = questionFocus === 'unknown' && question.exam_id
      ? examFocusById.get(question.exam_id) || 'unknown'
      : questionFocus;
    increment(questionSummary, propagatedFocus);
    await updateRow(supabase, 'questions', question.id, {
      role_focus: propagatedFocus,
      target_role: targetRole,
    });
  }
} catch (error) {
  if (isMissingSchemaError(error)) {
    console.log('Colunas de foco de cargo não encontradas. Rode supabase/phase8_target_role_focus.sql no Supabase.');
    process.exit(1);
  }
  throw error;
}

console.log('Resumo de provas:');
console.log(`- target: ${examSummary.target}`);
console.log(`- related: ${examSummary.related}`);
console.log(`- other: ${examSummary.other}`);
console.log(`- unknown: ${examSummary.unknown}`);
console.log('Resumo de questões:');
console.log(`- target: ${questionSummary.target}`);
console.log(`- related: ${questionSummary.related}`);
console.log(`- other: ${questionSummary.other}`);
console.log(`- unknown: ${questionSummary.unknown}`);
console.log('Finalizado.');
