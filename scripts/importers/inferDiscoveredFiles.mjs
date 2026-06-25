import { createSupabaseSeedClient } from '../utils/supabaseSeedClient.mjs';
import { inferFileMetadata } from './utils/fileInference.mjs';

function isMissingInferenceSchemaError(error) {
  return (
    error?.code === 'PGRST204' ||
    error?.code === '42703' ||
    error?.message?.includes('inference_confidence') ||
    error?.message?.includes('normalized_title') ||
    error?.message?.includes('is_exam_relevant') ||
    error?.message?.includes('relevance_category') ||
    error?.message?.includes('Could not find')
  );
}

console.log('Iniciando inferência de metadados dos arquivos descobertos...');
console.log('Autenticando usuário de seed...');
const supabase = await createSupabaseSeedClient();
console.log('Usuário autenticado.');

console.log('Verificando colunas de inferência...');
const preflight = await supabase
  .from('import_discovered_files')
  .select('id, normalized_title, inferred_notice_number, inferred_exam_id, inference_confidence, inference_notes, is_exam_relevant, relevance_category, relevance_reason')
  .limit(1);

if (preflight.error) {
  if (isMissingInferenceSchemaError(preflight.error)) {
    console.log('Colunas de inferência não encontradas. Rode supabase/phase3_file_metadata_inference.sql no Supabase.');
  } else {
    console.log(`Erro ao verificar colunas de inferência: ${preflight.error.message}`);
  }
  console.log('Finalizado.');
  process.exit(1);
}

console.log('Buscando arquivos descobertos...');
const { data: files, error: filesError } = await supabase
  .from('import_discovered_files')
  .select('*, import_sources(name, url)')
  .order('created_at', { ascending: false });

if (filesError) throw filesError;

console.log('Buscando provas cadastradas...');
const { data: exams, error: examsError } = await supabase.from('exams').select('*');
if (examsError) throw examsError;

console.log(`${files?.length ?? 0} arquivo(s) encontrado(s).`);
console.log(`${exams?.length ?? 0} prova(s) carregada(s).`);

let analyzed = 0;
let changedTypes = 0;
let suggestedExams = 0;
let withoutInference = 0;
let confidenceSum = 0;
let relevantCount = 0;

for (const file of files ?? []) {
  analyzed += 1;
  const metadata = inferFileMetadata({
    title: file.title,
    url: file.url,
    sourceName: file.import_sources?.name,
    sourceUrl: file.import_sources?.url,
    exams,
  });

  if (metadata.fileType && metadata.fileType !== file.file_type) changedTypes += 1;
  if (metadata.inferredExamId) suggestedExams += 1;
  if (!metadata.confidence) withoutInference += 1;
  if (metadata.isExamRelevant) relevantCount += 1;
  confidenceSum += metadata.confidence;

  const payload = {
    file_type: metadata.fileType,
    guessed_year: metadata.inferredYear,
    guessed_board: metadata.inferredBoard,
    guessed_role: metadata.inferredRole,
    normalized_title: metadata.normalizedTitle,
    inferred_notice_number: metadata.inferredNoticeNumber,
    inferred_exam_title: metadata.inferredExamTitle,
    inferred_exam_id: metadata.inferredExamId,
    inference_confidence: metadata.confidence,
    inference_notes: metadata.notes,
    is_exam_relevant: metadata.isExamRelevant,
    relevance_category: metadata.relevanceCategory,
    relevance_reason: metadata.relevanceReason,
  };

  if (!file.title || ['arquivo', 'comunicado', 'edital', 'prova', 'gabarito'].includes(file.title.toLowerCase().trim())) {
    payload.title = metadata.normalizedTitle;
  }

  const { error: updateError } = await supabase.from('import_discovered_files').update(payload).eq('id', file.id);
  if (updateError) {
    if (isMissingInferenceSchemaError(updateError)) {
      console.log('Colunas de inferência não encontradas. Rode supabase/phase3_file_metadata_inference.sql no Supabase.');
      console.log('Finalizado.');
      process.exit(1);
    }

    throw updateError;
  }
}

const averageConfidence = analyzed ? confidenceSum / analyzed : 0;

console.log('Resumo da inferência');
console.log(`Arquivos analisados: ${analyzed}`);
console.log(`Tipos alterados: ${changedTypes}`);
console.log(`Provas sugeridas: ${suggestedExams}`);
console.log(`Confiança média: ${Math.round(averageConfidence * 100)}%`);
console.log(`Relevantes para estudo: ${relevantCount}`);
console.log(`Sem inferência: ${withoutInference}`);
console.log('Finalizado.');
