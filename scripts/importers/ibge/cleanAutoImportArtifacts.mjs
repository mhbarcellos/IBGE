import { createSupabaseSeedClient } from '../../utils/supabaseSeedClient.mjs';
import { isIgnoredAdministrativeFile, isAllowedExamFile } from '../shared/fileValidation.mjs';

const apply = process.argv.includes('--apply');
const officialSources = ['FGV IBGE', 'IBFC IBGE', 'Cebraspe IBGE', 'IBGE Trabalhe Conosco'];

const supabase = await createSupabaseSeedClient();

async function fetchAll(table, query) {
  const { data, error } = await query;
  if (error) {
    console.log(`${table}: indisponivel (${error.message})`);
    return [];
  }
  return data ?? [];
}

async function deleteByIds(table, ids) {
  if (!ids.length || !apply) return null;
  const { error } = await supabase.from(table).delete().in('id', ids);
  return error;
}

console.log(`Limpeza de artefatos automaticos IBGE (${apply ? 'apply' : 'dry-run'})`);

const reports = await fetchAll(
  'import_run_reports',
  supabase
    .from('import_run_reports')
    .select('id, source_name, run_type, created_at')
    .in('source_name', officialSources)
    .order('created_at', { ascending: false }),
);

const latestReportByKey = new Set();
const duplicateReportIds = [];
for (const report of reports) {
  const key = `${report.source_name}:${report.run_type}`;
  if (latestReportByKey.has(key)) duplicateReportIds.push(report.id);
  latestReportByKey.add(key);
}

const examFiles = await fetchAll(
  'exam_files',
  supabase
    .from('exam_files')
    .select('id, exam_id, title, url, source_name, file_extension, mime_type, status')
    .in('source_name', officialSources),
);

const invalidFileIds = examFiles
  .filter((file) => isIgnoredAdministrativeFile({ url: file.url, title: file.title }) || !isAllowedExamFile({ url: file.url, contentType: file.mime_type || '' }))
  .map((file) => file.id);

const exams = await fetchAll(
  'exams',
  supabase
    .from('exams')
    .select('id, title, source_name, source_page_url, imported_at')
    .in('source_name', officialSources),
);

const fileExamIds = new Set(examFiles.filter((file) => !invalidFileIds.includes(file.id)).map((file) => file.exam_id).filter(Boolean));
const questionRows = await fetchAll(
  'questions',
  supabase
    .from('questions')
    .select('exam_id')
    .in('source_name', officialSources),
);
const questionExamIds = new Set(questionRows.map((row) => row.exam_id).filter(Boolean));

const invalidExamIds = exams
  .filter((exam) => exam.source_page_url && exam.imported_at && !fileExamIds.has(exam.id) && !questionExamIds.has(exam.id))
  .map((exam) => exam.id);

const reportDeleteError = await deleteByIds('import_run_reports', duplicateReportIds);
const fileDeleteError = await deleteByIds('exam_files', invalidFileIds);
const examDeleteError = await deleteByIds('exams', invalidExamIds);

if (reportDeleteError) console.log(`Erro ao remover relatorios: ${reportDeleteError.message}`);
if (fileDeleteError) console.log(`Erro ao remover exam_files: ${fileDeleteError.message}`);
if (examDeleteError) console.log(`Erro ao remover exams: ${examDeleteError.message}`);

console.log(`Relatorios duplicados antigos: ${duplicateReportIds.length}`);
console.log(`exam_files invalidos automaticos: ${invalidFileIds.length}`);
console.log(`exams oficiais sem arquivo e sem questoes: ${invalidExamIds.length}`);
if (!apply) console.log('Dry-run concluido. Use npm run ibge:clean-auto -- --apply para remover.');
console.log('Finalizado.');
