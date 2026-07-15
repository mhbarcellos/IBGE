import { createSupabaseSeedClient } from '../../utils/supabaseSeedClient.mjs';
import { getMatchedRoleAlias, getRoleFocusLevel, targetRole } from '../../../src/lib/targetRole.js';
import { getEnvValue, getManualSourceName, loadEnvFile, requireManualEnv } from './manualUtils.mjs';

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

async function findOrCreateExam(supabase, payload) {
  let query = supabase.from('exams').select('*').eq('title', payload.title);
  query = payload.year ? query.eq('year', payload.year) : query.is('year', null);
  query = payload.board ? query.eq('board', payload.board) : query.is('board', null);
  query = payload.role ? query.eq('role', payload.role) : query.is('role', null);

  const existing = await query.maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) {
    const { data, error } = await supabase.from('exams').update(payload).eq('id', existing.data.id).select().single();
    if (error) throw error;
    return { exam: data, created: false };
  }

  const { data, error } = await supabase.from('exams').insert(payload).select().single();
  if (error) throw error;
  return { exam: data, created: true };
}

async function upsertExamFile(supabase, examId, file) {
  const existing = await supabase
    .from('exam_files')
    .select('id')
    .eq('exam_id', examId)
    .eq('url', file.url)
    .maybeSingle();
  if (existing.error) throw existing.error;

  if (existing.data) {
    const { error } = await supabase.from('exam_files').update(file).eq('id', existing.data.id);
    if (error) throw error;
    return 'updated';
  }

  const { error } = await supabase.from('exam_files').insert({ ...file, exam_id: examId });
  if (error) throw error;
  return 'inserted';
}

console.log('Importando par manual de PDFs...');
const env = loadEnvFile();
requireManualEnv(env, ['MANUAL_EXAM_TITLE', 'MANUAL_PROVA_PDF_URL']);
const supabase = await createSupabaseSeedClient();
const sourceName = getManualSourceName(env);
const roleText = [
  getEnvValue(env, 'MANUAL_EXAM_TITLE'),
  getEnvValue(env, 'MANUAL_EXAM_ROLE'),
  getEnvValue(env, 'MANUAL_SOURCE_PAGE_URL'),
  getEnvValue(env, 'MANUAL_PROVA_PDF_URL'),
].filter(Boolean).join(' ');

const examPayload = {
  title: getEnvValue(env, 'MANUAL_EXAM_TITLE'),
  year: numberOrNull(getEnvValue(env, 'MANUAL_EXAM_YEAR')),
  board: getEnvValue(env, 'MANUAL_EXAM_BOARD') || null,
  role: getEnvValue(env, 'MANUAL_EXAM_ROLE') || null,
  organization: getEnvValue(env, 'MANUAL_EXAM_ORGANIZATION') || null,
  role_focus: getRoleFocusLevel(roleText),
  target_role: targetRole,
  role_alias_matched: getMatchedRoleAlias(roleText) || null,
  source_name: sourceName,
  source_page_url: getEnvValue(env, 'MANUAL_SOURCE_PAGE_URL') || null,
  source_url: getEnvValue(env, 'MANUAL_SOURCE_PAGE_URL') || getEnvValue(env, 'MANUAL_PROVA_PDF_URL'),
  imported_at: new Date().toISOString(),
};

const { exam, created } = await findOrCreateExam(supabase, examPayload);
let inserted = 0;
let updated = 0;

const files = [
  {
    file_type: 'prova',
    title: `${exam.title} - prova`,
    url: getEnvValue(env, 'MANUAL_PROVA_PDF_URL'),
    source_name: sourceName,
    status: 'approved',
  },
];

const answerUrl = getEnvValue(env, 'MANUAL_GABARITO_PDF_URL');
if (answerUrl) {
  files.push({
    file_type: 'gabarito',
    title: `${exam.title} - gabarito`,
    url: answerUrl,
    source_name: sourceName,
    status: 'approved',
  });
}

for (const file of files) {
  const result = await upsertExamFile(supabase, exam.id, file);
  if (result === 'inserted') inserted += 1;
  if (result === 'updated') updated += 1;
}

console.log(`Prova: ${created ? 'criada' : 'atualizada/encontrada'} (${exam.id})`);
console.log(`Arquivos inseridos: ${inserted}`);
console.log(`Arquivos atualizados: ${updated}`);
console.log(`Fonte: ${sourceName}`);
console.log('Finalizado.');
