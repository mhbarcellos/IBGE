import { createSupabaseSeedClient } from '../utils/supabaseSeedClient.mjs';

const apply = process.argv.includes('--apply');
const supabase = await createSupabaseSeedClient();

function isImportedRecord(record) {
  return Boolean(record.source_page_url || record.source_name === 'PCI Concursos' || record.source_name?.toLowerCase().includes('import'));
}

async function listImportedIds(table) {
  const result = await supabase.from(table).select('id, source_name, source_page_url');
  if (result.error) {
    if (result.error.code === '42703') {
      console.log(`${table}: colunas source_name/source_page_url ausentes; pulei limpeza por metadados de importacao.`);
      return [];
    }
    throw result.error;
  }

  return result.data?.filter(isImportedRecord).map((item) => item.id) ?? [];
}

async function maybeDelete(table, queryBuilder, label) {
  const selectQuery = queryBuilder(supabase.from(table).select('id'));
  const { data, error } = await selectQuery;
  if (error) {
    if (error.message?.includes('Could not find')) return { label, count: 0, skipped: true };
    throw error;
  }

  if (apply && data?.length) {
    const { error: deleteError } = await supabase.from(table).delete().in('id', data.map((item) => item.id));
    if (deleteError) throw deleteError;
  }

  return { label, count: data?.length ?? 0, skipped: false };
}

console.log(`Reset de importações em modo ${apply ? 'APLICAR' : 'DRY-RUN'}`);

const importedQuestionIds = await listImportedIds('questions');
const summaries = [];

if (importedQuestionIds.length) {
  summaries.push(await maybeDelete('question_attempts', (query) => query.in('question_id', importedQuestionIds), 'tentativas ligadas a questões importadas'));
}

for (const table of ['question_import_reviews', 'exam_file_texts', 'exam_files', 'import_discovered_files', 'import_jobs', 'import_sources', 'question_import_logs']) {
  summaries.push(await maybeDelete(table, (query) => query.not('id', 'is', null), table));
}

if (importedQuestionIds.length) {
  if (apply) {
    const { error } = await supabase.from('questions').delete().in('id', importedQuestionIds);
    if (error) throw error;
  }
  summaries.push({ label: 'questions importadas', count: importedQuestionIds.length });
}

const importedExamIds = await listImportedIds('exams');

if (apply && importedExamIds.length) {
  const { error } = await supabase.from('exams').delete().in('id', importedExamIds);
  if (error) throw error;
}
summaries.push({ label: 'exams importadas', count: importedExamIds.length });

summaries.forEach((item) => {
  console.log(`${item.label}: ${item.count}${item.skipped ? ' (tabela ausente)' : ''}`);
});

if (!apply) console.log('Dry-run concluído. Use npm run reset:imports -- --apply para apagar.');
console.log('Finalizado.');
