import { createSupabaseSeedClient } from '../../utils/supabaseSeedClient.mjs';
import { pciSourceName } from './pciUtils.mjs';

const supabase = await createSupabaseSeedClient();

const { count: examsCount } = await supabase.from('exams').select('*', { count: 'exact', head: true }).eq('source_name', pciSourceName);
const { count: questionsCount } = await supabase.from('questions').select('*', { count: 'exact', head: true }).eq('source_name', pciSourceName);
const { count: withAnswer } = await supabase.from('questions').select('*', { count: 'exact', head: true }).eq('source_name', pciSourceName).not('correct_answer', 'is', null);
const { count: pending } = await supabase.from('questions').select('*', { count: 'exact', head: true }).eq('source_name', pciSourceName).eq('needs_review', true);
const { count: pdfCount } = await supabase.from('exam_files').select('*', { count: 'exact', head: true }).eq('source_name', pciSourceName);
const { count: downloadedPdfCount } = await supabase.from('exam_files').select('*', { count: 'exact', head: true }).eq('source_name', pciSourceName).eq('status', 'downloaded');
const { count: extractedTextCount } = await supabase.from('exam_file_texts').select('*, exam_files!inner(source_name)', { count: 'exact', head: true }).eq('exam_files.source_name', pciSourceName).eq('extraction_status', 'extracted');
const { count: candidatesCount } = await supabase.from('question_parse_candidates').select('*', { count: 'exact', head: true });
const { count: approvedCandidatesCount } = await supabase.from('question_parse_candidates').select('*', { count: 'exact', head: true }).eq('parse_status', 'approved');
const { data: exams } = await supabase.from('exams').select('year, board').eq('source_name', pciSourceName);
const { data: questions } = await supabase.from('questions').select('discipline').eq('source_name', pciSourceName);

function countBy(items, key) {
  return (items ?? []).reduce((acc, item) => {
    const value = item[key] || 'Sem dado';
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

console.log(`Provas PCI importadas: ${examsCount ?? 0}`);
console.log(`PDFs PCI cadastrados: ${pdfCount ?? 0}`);
console.log(`PDFs PCI baixados: ${downloadedPdfCount ?? 0}`);
console.log(`Textos PCI extraidos: ${extractedTextCount ?? 0}`);
console.log(`Candidatos de questoes: ${candidatesCount ?? 0}`);
console.log(`Candidatos aprovados: ${approvedCandidatesCount ?? 0}`);
console.log(`Questões PCI importadas: ${questionsCount ?? 0}`);
console.log(`Questões com gabarito: ${withAnswer ?? 0}`);
console.log(`Questões sem gabarito: ${(questionsCount ?? 0) - (withAnswer ?? 0)}`);
console.log(`Questões pendentes de revisão: ${pending ?? 0}`);
console.log('Quantidade por ano:', countBy(exams, 'year'));
console.log('Quantidade por banca:', countBy(exams, 'board'));
console.log('Quantidade por disciplina:', countBy(questions, 'discipline'));
