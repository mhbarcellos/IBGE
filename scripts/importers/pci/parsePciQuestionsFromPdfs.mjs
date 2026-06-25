import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createSupabaseSeedClient } from '../../utils/supabaseSeedClient.mjs';
import { getEnvNumber, inferDiscipline, inferSubject, pciSourceName } from './pciUtils.mjs';
import { parseAnswersFromText } from './utils/parseAnswerKeyText.mjs';
import { parseQuestionsFromExamText } from './utils/parseExamText.mjs';

const letters = ['A', 'B', 'C', 'D', 'E'];

function readExtractedText(textRow) {
  if (textRow?.text_content) return textRow.text_content;
  if (textRow?.local_text_path) {
    const path = resolve(process.cwd(), textRow.local_text_path);
    if (existsSync(path)) return readFileSync(path, 'utf8');
  }
  return '';
}

function alternativesFromCandidate(candidate) {
  return {
    A: candidate.option_a,
    B: candidate.option_b,
    C: candidate.option_c,
    D: candidate.option_d,
    E: candidate.option_e,
  };
}

function optionCount(candidate) {
  return letters.filter((letter) => candidate[`option_${letter.toLowerCase()}`]).length;
}

async function upsertCandidate(supabase, payload) {
  const existing = await supabase
    .from('question_parse_candidates')
    .select('id')
    .eq('exam_id', payload.exam_id)
    .eq('number', payload.number)
    .eq('statement', payload.statement)
    .maybeSingle();
  if (existing.error) throw existing.error;

  if (existing.data) {
    const { error } = await supabase.from('question_parse_candidates').update(payload).eq('id', existing.data.id);
    if (error) throw error;
    return existing.data.id;
  }

  const { data, error } = await supabase.from('question_parse_candidates').insert(payload).select('id').single();
  if (error) throw error;
  return data.id;
}

async function upsertQuestion(supabase, payload) {
  const bySource = await supabase
    .from('questions')
    .select('id')
    .eq('source_name', pciSourceName)
    .eq('source_question_id', payload.source_question_id)
    .maybeSingle();
  if (bySource.error) throw bySource.error;

  if (bySource.data) {
    const { error } = await supabase.from('questions').update(payload).eq('id', bySource.data.id);
    if (error) throw error;
    return 'updated';
  }

  const fallback = await supabase
    .from('questions')
    .select('id')
    .eq('exam_id', payload.exam_id)
    .eq('number', payload.number)
    .eq('statement', payload.statement)
    .maybeSingle();
  if (fallback.error) throw fallback.error;

  if (fallback.data) {
    const { error } = await supabase.from('questions').update(payload).eq('id', fallback.data.id);
    if (error) throw error;
    return 'updated';
  }

  const { error } = await supabase.from('questions').insert(payload);
  if (error) throw error;
  return 'inserted';
}

console.log('Parseando questoes a partir dos PDFs PCI...');
const supabase = await createSupabaseSeedClient();
const maxExams = getEnvNumber('PCI_MAX_EXAMS', 3);

const { data: exams, error: examsError } = await supabase
  .from('exams')
  .select('id, title, source_page_url')
  .eq('source_name', pciSourceName)
  .limit(maxExams);
if (examsError) throw examsError;

let processed = 0;
let candidatesCount = 0;
let answersFound = 0;
let inserted = 0;
let pendingReview = 0;
let errors = 0;

for (const exam of exams ?? []) {
  processed += 1;
  console.log(`Processando prova ${processed}/${exams.length}: ${exam.title}`);

  try {
    const { data: files, error: filesError } = await supabase
      .from('exam_files')
      .select('id, file_type, title')
      .eq('exam_id', exam.id)
      .eq('source_name', pciSourceName)
      .in('file_type', ['prova', 'gabarito']);
    if (filesError) throw filesError;

    const fileIds = (files ?? []).map((file) => file.id);
    if (!fileIds.length) {
      console.log('Nenhum PDF de prova/gabarito encontrado para esta prova.');
      continue;
    }

    const { data: texts, error: textsError } = await supabase
      .from('exam_file_texts')
      .select('exam_file_id, text_content, local_text_path, extraction_status')
      .in('exam_file_id', fileIds)
      .eq('extraction_status', 'extracted');
    if (textsError) throw textsError;

    const textByFileId = new Map((texts ?? []).map((row) => [row.exam_file_id, row]));
    const proofFile = (files ?? []).find((file) => file.file_type === 'prova' && textByFileId.has(file.id));
    const answerFile = (files ?? []).find((file) => file.file_type === 'gabarito' && textByFileId.has(file.id));

    if (!proofFile) {
      console.log('Nenhum texto de prova extraido encontrado.');
      continue;
    }

    const proofText = readExtractedText(textByFileId.get(proofFile.id));
    const answerText = answerFile ? readExtractedText(textByFileId.get(answerFile.id)) : '';
    let parsedQuestions = [];
    let answers = {};
    try {
      parsedQuestions = parseQuestionsFromExamText(proofText);
      answers = answerText ? parseAnswersFromText(answerText) : {};
    } catch (error) {
      console.log(`Parse ignorado para ${exam.title}: ${error.message}`);
      continue;
    }
    if (!parsedQuestions.length) {
      console.log(`Nenhuma questao detectada em ${exam.title}.`);
      continue;
    }
    answersFound += Object.keys(answers).length;
    candidatesCount += parsedQuestions.length;

    for (const candidate of parsedQuestions) {
      const correctAnswer = answers[candidate.number] || null;
      const discipline = inferDiscipline(`${candidate.statement} ${Object.values(alternativesFromCandidate(candidate)).join(' ')}`);
      const subject = inferSubject(discipline);
      const hasEnoughData = candidate.parseConfidence >= 0.7 && optionCount(candidate) >= 4;
      const sourceQuestionId = `pci:${exam.id}:${candidate.number}`;
      const notes = [
        candidate.parseNotes,
        correctAnswer ? null : 'Gabarito nao encontrado no arquivo de gabarito.',
      ].filter(Boolean).join(' ');

      await upsertCandidate(supabase, {
        exam_id: exam.id,
        source_exam_file_id: proofFile.id,
        source_gabarito_file_id: answerFile?.id ?? null,
        number: candidate.number,
        source_question_id: sourceQuestionId,
        statement: candidate.statement,
        option_a: candidate.option_a,
        option_b: candidate.option_b,
        option_c: candidate.option_c,
        option_d: candidate.option_d,
        option_e: candidate.option_e,
        correct_answer: correctAnswer,
        subject: discipline,
        topic: subject,
        parse_status: correctAnswer && hasEnoughData ? 'imported' : 'candidate',
        parse_confidence: candidate.parseConfidence,
        parse_notes: notes || null,
      });

      if (!correctAnswer || !hasEnoughData) {
        pendingReview += 1;
        continue;
      }

      const result = await upsertQuestion(supabase, {
        exam_id: exam.id,
        number: candidate.number,
        discipline,
        subject,
        statement: candidate.statement,
        alternatives: alternativesFromCandidate(candidate),
        correct_answer: correctAnswer,
        explanation: null,
        difficulty: 'media',
        source_name: pciSourceName,
        source_page_url: exam.source_page_url,
        source_question_id: sourceQuestionId,
        import_status: candidate.parseConfidence >= 0.9 ? 'imported' : 'needs_review',
        import_notes: notes || null,
        needs_review: candidate.parseConfidence < 0.9,
      });

      if (result === 'inserted') inserted += 1;
      if (candidate.parseConfidence < 0.9) pendingReview += 1;
    }
  } catch (error) {
    errors += 1;
    console.log(`Erro ao processar prova ${exam.title}: ${error.message}`);
  }
}

console.log(`Provas processadas: ${processed}`);
console.log(`Questoes candidatas: ${candidatesCount}`);
console.log(`Respostas encontradas no gabarito: ${answersFound}`);
console.log(`Questoes inseridas: ${inserted}`);
console.log(`Pendentes de revisao: ${pendingReview}`);
console.log(`Erros: ${errors}`);
console.log('Finalizado.');
