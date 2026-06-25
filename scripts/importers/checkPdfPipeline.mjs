import { createSupabaseSeedClient } from '../utils/supabaseSeedClient.mjs';

console.log('Iniciando diagnóstico do pipeline de PDFs...');
console.log('Autenticando usuário de seed...');
const supabase = await createSupabaseSeedClient();
console.log('Usuário autenticado.');

function isMissingSchemaError(error) {
  return (
    error?.code === 'PGRST205' ||
    error?.code === '42703' ||
    error?.message?.includes('Could not find the table') ||
    (error?.message?.includes('column') && error?.message?.includes('does not exist'))
  );
}

async function count(table, label, buildQuery = (query) => query) {
  const query = buildQuery(supabase.from(table).select('*', { count: 'exact', head: true }));
  const { count: total, error } = await query;

  if (error) {
    if (isMissingSchemaError(error)) {
      console.log(`${label}: tabela ausente ou schema cache desatualizado - execute supabase/phase3_pdf_pipeline.sql`);
      process.exitCode = 1;
      return;
    }

    console.log(`${label}: erro - ${error.message}`);
    process.exitCode = 1;
    return;
  }

  console.log(`${label}: ${total ?? 0}`);
}

console.log('Diagnostico do pipeline de PDFs');
await count('import_sources', 'Fontes');
await count('import_discovered_files', 'Arquivos descobertos');
await count('exam_files', 'Arquivos de prova');
await count('exam_files', 'Arquivos baixados', (query) => query.eq('status', 'downloaded'));
await count('exam_file_texts', 'Textos registrados');
await count('exam_file_texts', 'Textos extraidos', (query) => query.eq('extraction_status', 'extracted'));
await count('exam_file_texts', 'Textos com erro', (query) => query.eq('extraction_status', 'error'));
console.log('Finalizado.');
