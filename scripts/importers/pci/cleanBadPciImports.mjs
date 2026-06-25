import { createSupabaseSeedClient } from '../../utils/supabaseSeedClient.mjs';
import { isPciNavigationUrl, looksLikePdfUrl, pciSourceName } from './pciUtils.mjs';

const apply = process.argv.includes('--apply');
const invalidExamUrls = new Set([
  'https://www.pciconcursos.com.br/provas/ibge',
  'https://www.pciconcursos.com.br/provas/',
  'https://www.pciconcursos.com.br/provas',
  'https://www.pciconcursos.com.br/provas/top',
]);

function isGenericExam(exam) {
  return invalidExamUrls.has(exam.source_page_url)
    || isPciNavigationUrl(exam.source_page_url)
    || /^IBGE\s*-\s*\d+$/i.test(exam.title || '')
    || /^IBGE\s*-\s*\d+$/i.test(exam.role || '');
}

function isBadExamFile(file) {
  return file.source_name === pciSourceName
    && (
      !file.local_path
      || ['download_error', 'approved', 'pending'].includes(file.status)
      || isPciNavigationUrl(file.url)
      || (!looksLikePdfUrl(file.url) && /pciconcursos\.com\.br\/(?:provas|colaborar|busca)/i.test(file.url || ''))
    );
}

async function safeSelect(label, query) {
  const { data, error } = await query;
  if (error) {
    if (['42P01', '42703'].includes(error.code)) {
      console.log(`${label}: tabela/coluna ausente, ignorando.`);
      return [];
    }
    throw error;
  }
  return data ?? [];
}

async function deleteByIds(table, ids) {
  if (!apply || !ids.length) return null;
  return (await supabase.from(table).delete().in('id', ids)).error;
}

console.log(`Limpando importacoes PCI ruins em modo ${apply ? 'APLICAR' : 'DRY-RUN'}...`);
const supabase = await createSupabaseSeedClient();

const pciExams = await safeSelect(
  'exams PCI',
  supabase.from('exams').select('id, title, role, source_page_url').eq('source_name', pciSourceName),
);
const pciExamIds = pciExams.map((exam) => exam.id);
const invalidExamIds = pciExams.filter(isGenericExam).map((exam) => exam.id);

const allPciFiles = await safeSelect(
  'exam_files PCI',
  supabase.from('exam_files').select('id, exam_id, url, local_path, status, source_name').eq('source_name', pciSourceName),
);
const badFileIds = allPciFiles
  .filter((file) => isBadExamFile(file) || invalidExamIds.includes(file.exam_id))
  .map((file) => file.id);

const textRows = badFileIds.length
  ? await safeSelect('exam_file_texts ligados aos arquivos ruins', supabase.from('exam_file_texts').select('id, exam_file_id').in('exam_file_id', badFileIds))
  : [];
const textIds = textRows.map((row) => row.id);

const candidates = pciExamIds.length
  ? await safeSelect('question_parse_candidates PCI', supabase.from('question_parse_candidates').select('id, exam_id').in('exam_id', pciExamIds))
  : [];
const candidateIds = candidates.map((candidate) => candidate.id);

const questions = await safeSelect(
  'questions PCI',
  supabase.from('questions').select('id').eq('source_name', pciSourceName),
);
const questionIds = questions.map((question) => question.id);

const textDeleteError = await deleteByIds('exam_file_texts', textIds);
if (textDeleteError) throw textDeleteError;

const candidateDeleteError = await deleteByIds('question_parse_candidates', candidateIds);
if (candidateDeleteError) throw candidateDeleteError;

const questionDeleteError = await deleteByIds('questions', questionIds);
if (questionDeleteError) throw questionDeleteError;

const fileDeleteError = await deleteByIds('exam_files', badFileIds);
if (fileDeleteError) throw fileDeleteError;

const examDeleteError = await deleteByIds('exams', invalidExamIds);
if (examDeleteError) throw examDeleteError;

console.log(`exam_files removidos: ${badFileIds.length}`);
console.log(`textos removidos: ${textIds.length}`);
console.log(`candidates removidos: ${candidateIds.length}`);
console.log(`questions removidas: ${questionIds.length}`);
console.log(`exams invalidos removidos: ${invalidExamIds.length}`);
if (!apply) console.log('Dry-run concluido. Use npm run pci:clean-bad -- --apply para remover.');
console.log('Finalizado.');
