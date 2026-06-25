import { createSupabaseSeedClient } from '../utils/supabaseSeedClient.mjs';
import { inferFileMetadata } from './utils/fileInference.mjs';

console.log('Iniciando reclassificação exam-only dos arquivos descobertos...');
console.log('Autenticando usuário de seed...');
const supabase = await createSupabaseSeedClient();
console.log('Usuário autenticado.');

const { data: files, error: filesError } = await supabase
  .from('import_discovered_files')
  .select('*, import_sources(name, url)')
  .order('created_at', { ascending: false });
if (filesError) throw filesError;

const { data: exams, error: examsError } = await supabase.from('exams').select('*');
if (examsError) throw examsError;

const counters = {
  prova: 0,
  gabarito: 0,
  prova_e_gabarito: 0,
  irrelevante: 0,
  desconhecido: 0,
  arquivados: 0,
};

for (const file of files ?? []) {
  const metadata = inferFileMetadata({
    title: file.title,
    normalizedTitle: file.normalized_title,
    url: file.url,
    sourceName: file.import_sources?.name,
    sourceUrl: file.import_sources?.url,
    fileType: file.file_type,
    notes: file.notes,
    exams,
  });

  counters[metadata.relevanceCategory] += 1;
  const shouldArchive = file.status !== 'approved' && !metadata.isExamRelevant;
  if (shouldArchive) counters.arquivados += 1;

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
    archived_at: shouldArchive ? file.archived_at || new Date().toISOString() : null,
    status: shouldArchive ? 'archived' : file.status,
  };

  const { error: updateError } = await supabase.from('import_discovered_files').update(payload).eq('id', file.id);
  if (updateError) throw updateError;
}

console.log('Resumo da limpeza exam-only');
console.log(`Provas: ${counters.prova}`);
console.log(`Gabaritos: ${counters.gabarito}`);
console.log(`Prova e gabarito: ${counters.prova_e_gabarito}`);
console.log(`Irrelevantes: ${counters.irrelevante}`);
console.log(`Desconhecidos: ${counters.desconhecido}`);
console.log(`Arquivados: ${counters.arquivados}`);
console.log('Finalizado.');
