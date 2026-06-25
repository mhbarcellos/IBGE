import { createSupabaseSeedClient, isMissingSchemaError } from './utils/supabaseSeedClient.mjs';

const tables = ['exams', 'questions', 'study_materials', 'import_sources', 'exam_files', 'question_attempts'];
const supabase = await createSupabaseSeedClient();

console.log('Diagnostico Supabase');

for (const table of tables) {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });

  if (error) {
    if (isMissingSchemaError(error)) {
      console.log(`${table}: ausente ou schema cache desatualizado - execute supabase/phase2_import_tables.sql se for tabela da Fase 2`);
      continue;
    }

    console.log(`${table}: erro - ${error.message}`);
    process.exitCode = 1;
    continue;
  }

  console.log(`${table}: ${count ?? 0} registro(s)`);
}
