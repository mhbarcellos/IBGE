import { createSupabaseSeedClient } from '../../utils/supabaseSeedClient.mjs';
import { targetRole } from '../../../src/lib/targetRole.js';
import { classifyExamFileRelevance } from '../shared/fileValidation.mjs';

const supabase = await createSupabaseSeedClient();

function increment(map, key, amount = 1) {
  const label = key || 'sem valor';
  map.set(label, (map.get(label) || 0) + amount);
}

function printMap(title, map) {
  console.log(title);
  if (!map.size) {
    console.log('- nenhum registro');
    return;
  }
  for (const [key, value] of [...map.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0])))) {
    console.log(`- ${key}: ${value}`);
  }
}

async function count(label, table, build = (query) => query) {
  const { count: value, error } = await build(supabase.from(table).select('*', { count: 'exact', head: true }));
  if (error) {
    console.log(`${label}: indisponivel (${error.message})`);
    return 0;
  }
  console.log(`${label}: ${value ?? 0}`);
  return value ?? 0;
}

async function selectRows(label, table, columns, build = (query) => query) {
  const { data, error } = await build(supabase.from(table).select(columns));
  if (error) {
    console.log(`${label}: indisponivel (${error.message})`);
    return [];
  }
  return data ?? [];
}

console.log('Diagnostico do importador automatico IBGE');
await count('Provas totais', 'exams');
await count('Provas com arquivos', 'exam_files', (query) => query.not('exam_id', 'is', null));
await count('Arquivos de prova', 'exam_files', (query) => query.eq('file_type', 'prova'));
await count('Arquivos de gabarito', 'exam_files', (query) => query.eq('file_type', 'gabarito'));
await count('Arquivos baixados', 'exam_files', (query) => query.eq('status', 'downloaded'));
await count('Arquivos processaveis', 'exam_files', (query) => query.eq('is_processable', true));
await count('Arquivos nao suportados', 'exam_files', (query) => query.in('processing_status', ['unsupported', 'unsupported_zip']));
await count('Textos extraidos', 'exam_file_texts', (query) => query.eq('extraction_status', 'extracted'));
await count('Candidatas', 'question_parse_candidates');
await count('Questoes importadas', 'questions');
await count('Questoes disponiveis no questionario', 'questions', (query) => query.eq('needs_review', false).not('correct_answer', 'is', null));
await count('Questoes pendentes de revisao', 'questions', (query) => query.eq('needs_review', true));
console.log(`Foco de cargo (${targetRole}):`);
await count('Provas ACA', 'exams', (query) => query.eq('role_focus', 'target'));
await count('Provas relacionadas', 'exams', (query) => query.eq('role_focus', 'related'));
await count('Questoes ACA', 'questions', (query) => query.eq('role_focus', 'target'));
await count('Questoes relacionadas', 'questions', (query) => query.eq('role_focus', 'related'));
await count('Questoes outras', 'questions', (query) => query.eq('role_focus', 'other'));
await count('Questoes sem classificacao', 'questions', (query) => query.eq('role_focus', 'unknown'));

const exams = await selectRows('Provas por source_name', 'exams', 'id, title, source_name');
const files = await selectRows('Arquivos por source_name', 'exam_files', 'id, exam_id, source_name, file_type, title, url, file_extension, status, processing_status, is_processable');
const texts = await selectRows('Textos por tipo', 'exam_file_texts', 'exam_file_id, extraction_status');

const examsBySource = new Map();
for (const exam of exams) increment(examsBySource, exam.source_name);
printMap('Provas por source_name:', examsBySource);

const filesBySource = new Map();
const filesByExtension = new Map();
const downloadedByExtension = new Map();
const fileIdsBySource = new Map();
for (const file of files) {
  increment(filesBySource, file.source_name);
  increment(filesByExtension, file.file_extension);
  if (file.status === 'downloaded') increment(downloadedByExtension, file.file_extension);
  if (!fileIdsBySource.has(file.source_name || 'sem valor')) fileIdsBySource.set(file.source_name || 'sem valor', new Set());
  fileIdsBySource.get(file.source_name || 'sem valor').add(file.exam_id);
}
printMap('Arquivos por source_name:', filesBySource);

const examsWithFilesBySource = new Map();
for (const [sourceName, examIds] of fileIdsBySource.entries()) {
  examsWithFilesBySource.set(sourceName, [...examIds].filter(Boolean).length);
}
printMap('Provas com arquivos por source_name:', examsWithFilesBySource);
const examIdsWithFiles = new Set(files.map((file) => file.exam_id).filter(Boolean));
const examsWithoutFiles = exams.filter((exam) => !examIdsWithFiles.has(exam.id));
console.log(`Provas sem arquivo: ${examsWithoutFiles.length}`);
if (examsWithoutFiles.length) {
  console.log('Exemplos de provas sem arquivo:');
  for (const exam of examsWithoutFiles.slice(0, 10)) {
    console.log(`- [${exam.source_name || 'sem fonte'}] ${exam.title || exam.id}`);
  }
}
printMap('Arquivos por extensao:', filesByExtension);
printMap('Arquivos baixados por extensao:', downloadedByExtension);

const relevanceResults = files.map((file) => ({
  file,
  relevance: classifyExamFileRelevance({
    title: file.title,
    url: file.url,
    sourceName: file.source_name,
  }),
}));
const likelyRealFiles = relevanceResults.filter((item) => item.relevance.isRelevant);
const likelyIrrelevantFiles = relevanceResults.filter((item) => !item.relevance.isRelevant);
console.log(`Total de arquivos reais provaveis: ${likelyRealFiles.length}`);
console.log(`Total de gabaritos: ${likelyRealFiles.filter((item) => item.relevance.fileType === 'gabarito').length}`);
console.log(`Total de provas: ${likelyRealFiles.filter((item) => item.relevance.fileType === 'prova').length}`);
console.log(`Arquivos possivelmente irrelevantes ainda cadastrados: ${likelyIrrelevantFiles.length}`);
console.log('Exemplos de arquivos mantidos:');
for (const { file, relevance } of likelyRealFiles.slice(0, 5)) {
  console.log(`- ${relevance.fileType}: ${file.title || file.url} (${relevance.reason})`);
}
console.log('Exemplos de arquivos removiveis:');
for (const { file, relevance } of likelyIrrelevantFiles.slice(0, 10)) {
  console.log(`- ${file.title || file.url} (${relevance.reason})`);
}

const textStatusByType = new Map();
const fileById = new Map(files.map((file) => [file.id, file]));
for (const text of texts) {
  const file = fileById.get(text.exam_file_id);
  increment(textStatusByType, `${file?.file_extension || 'sem extensao'} / ${text.extraction_status}`);
}
printMap('Textos extraidos por tipo:', textStatusByType);

const { data: latestFiles, error: latestFilesError } = await supabase
  .from('exam_files')
  .select('file_type, file_extension, title, url, status, processing_status, source_name, created_at')
  .order('created_at', { ascending: false })
  .limit(20);

if (latestFilesError) {
  console.log(`Ultimos arquivos cadastrados: indisponivel (${latestFilesError.message})`);
} else {
  console.log('Ultimos 20 arquivos cadastrados:');
  for (const file of latestFiles ?? []) {
    console.log(`- [${file.source_name}] ${file.file_type}/${file.file_extension || '?'} ${file.status}/${file.processing_status || '?'} - ${file.title || 'sem titulo'} - ${file.url}`);
  }
}

const { data: reports, error } = await supabase
  .from('import_run_reports')
  .select('source_name, run_type, status, exams_found, exams_imported, pdfs_found, pdfs_downloaded, pdfs_blocked, questions_candidates, questions_imported, questions_needing_review, message, created_at')
  .order('created_at', { ascending: false })
  .limit(20);

if (error) {
  console.log(`Relatorios por fonte: indisponivel (${error.message})`);
} else {
  console.log('Ultimos relatorios por fonte:');
  const sourcesWithoutFiles = (reports ?? [])
    .filter((report) => Number(report.pdfs_found || 0) === 0)
    .map((report) => report.source_name || 'sem fonte');
  if (sourcesWithoutFiles.length) {
    console.log('Fontes que nao retornaram arquivo nos ultimos relatorios:');
    for (const sourceName of [...new Set(sourcesWithoutFiles)]) console.log(`- ${sourceName}`);
  }
  for (const report of reports ?? []) {
    console.log(`- ${report.source_name} [${report.run_type}/${report.status}] provas=${report.exams_found}/${report.exams_imported} arquivos=${report.pdfs_found} baixados=${report.pdfs_downloaded} ignorados=${report.pdfs_blocked} candidatas=${report.questions_candidates} importadas=${report.questions_imported} revisao=${report.questions_needing_review}${report.message ? ` erro=${report.message}` : ''}`);
  }
}

console.log('Finalizado.');
