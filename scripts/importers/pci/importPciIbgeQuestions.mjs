import * as cheerio from 'cheerio';
import { createSupabaseSeedClient } from '../../utils/supabaseSeedClient.mjs';
import { delay, fetchWithTimeout, getEnvNumber, inferDiscipline, inferSubject, normalizeWhitespace, pciSourceName } from './pciUtils.mjs';

const letters = ['A', 'B', 'C', 'D', 'E'];

function parseQuestions(html, exam) {
  const $ = cheerio.load(html);
  const bodyText = normalizeWhitespace($('body').text());
  const chunks = bodyText.split(/(?=(?:Quest[aÃ£]o|QUEST[AÃƒ]O)\s*(?:n[Âºo.]?\s*)?\d{1,3})/g);
  const parsed = [];

  for (const chunk of chunks) {
    const numberMatch = chunk.match(/(?:Quest[aÃ£]o|QUEST[AÃƒ]O)\s*(?:n[Âºo.]?\s*)?(\d{1,3})/);
    if (!numberMatch) continue;
    const number = Number(numberMatch[1]);
    const sourceQuestionId = chunk.match(/\bQ\d{3,}\b/i)?.[0]?.toUpperCase() || `${exam.id}-${number}`;
    const alternatives = {};

    for (const letter of letters) {
      const nextLetters = letters.filter((item) => item > letter).join('|');
      const pattern = new RegExp(`(?:^|\\s)${letter}[\\).\\-]\\s*(.*?)(?=\\s(?:${nextLetters})[\\).\\-]|\\sGabarito\\b|$)`, 'is');
      const match = chunk.match(pattern);
      if (match) alternatives[letter] = normalizeWhitespace(match[1]);
    }

    const firstAltIndex = letters
      .map((letter) => chunk.search(new RegExp(`\\s${letter}[\\).\\-]\\s`, 'i')))
      .filter((index) => index > -1)
      .sort((a, b) => a - b)[0];
    const statement = normalizeWhitespace(chunk.slice(0, firstAltIndex > -1 ? firstAltIndex : 900).replace(numberMatch[0], ''));
    const answerMatch = chunk.match(/Gabarito\s*[:-]?\s*([A-E])/i) || bodyText.match(new RegExp(`${number}\\s*[-â€“:]\\s*([A-E])`, 'i'));
    const correctAnswer = answerMatch?.[1]?.toUpperCase() || null;
    const discipline = inferDiscipline(`${statement} ${Object.values(alternatives).join(' ')}`);
    const needsReview = !correctAnswer || Object.keys(alternatives).length < 4 || statement.length < 20;

    parsed.push({
      exam_id: exam.id,
      number,
      discipline,
      subject: inferSubject(discipline),
      statement: statement || `QuestÃ£o ${number}`,
      alternatives,
      correct_answer: correctAnswer,
      explanation: null,
      difficulty: 'media',
      source_name: pciSourceName,
      source_page_url: exam.source_page_url,
      source_question_id: sourceQuestionId,
      import_status: needsReview ? 'needs_review' : 'imported',
      import_notes: correctAnswer ? (needsReview ? 'Alternativas ou enunciado exigem revisÃ£o.' : null) : 'Gabarito nÃ£o encontrado na pÃ¡gina de origem.',
      needs_review: needsReview,
    });
  }

  return parsed;
}

console.log('Importando questÃµes PCI IBGE...');
const supabase = await createSupabaseSeedClient();
const maxExams = getEnvNumber('PCI_MAX_EXAMS', 100);
const { data: exams, error: examsError } = await supabase
  .from('exams')
  .select('*')
  .eq('source_name', pciSourceName)
  .not('source_page_url', 'is', null)
  .limit(maxExams);
if (examsError) throw examsError;

let processed = 0;
let found = 0;
let imported = 0;
let updated = 0;
let skipped = 0;
let needsReview = 0;

const logInsert = await supabase
  .from('question_import_logs')
  .insert({ source_name: pciSourceName, status: 'running', started_at: new Date().toISOString() })
  .select()
  .single();
const logId = logInsert.data?.id;

for (const exam of exams ?? []) {
  console.log(`Lendo prova ${processed + 1}/${exams.length}: ${exam.title}`);
  processed += 1;
  const response = await fetchWithTimeout(exam.source_page_url);
  if (!response.ok) {
    skipped += 1;
    console.log(`Falha HTTP ${response.status}`);
    continue;
  }

  const questions = parseQuestions(await response.text(), exam);
  found += questions.length;

  for (const question of questions) {
    if (question.needs_review) needsReview += 1;
    let current = await supabase
      .from('questions')
      .select('id')
      .eq('source_name', pciSourceName)
      .eq('source_question_id', question.source_question_id)
      .maybeSingle();
    if (current.error) throw current.error;

    if (!current.data) {
      current = await supabase
        .from('questions')
        .select('id')
        .eq('exam_id', exam.id)
        .eq('number', question.number)
        .eq('statement', question.statement)
        .maybeSingle();
      if (current.error) throw current.error;
    }

    if (current.data) {
      const { error } = await supabase.from('questions').update(question).eq('id', current.data.id);
      if (error) throw error;
      updated += 1;
    } else {
      const { error } = await supabase.from('questions').insert(question);
      if (error) throw error;
      imported += 1;
    }
  }

  if (processed < (exams?.length ?? 0)) {
    console.log('Aguardando 1 segundo antes da proxima prova...');
    await delay(1000);
  }
}

if (logId) {
  await supabase
    .from('question_import_logs')
    .update({
      status: 'finished',
      questions_found: found,
      questions_imported: imported,
      questions_updated: updated,
      questions_skipped: skipped,
      questions_needing_review: needsReview,
      finished_at: new Date().toISOString(),
    })
    .eq('id', logId);
}

console.log(`Provas processadas: ${processed}`);
console.log(`QuestÃµes encontradas: ${found}`);
console.log(`QuestÃµes importadas: ${imported}`);
console.log(`QuestÃµes atualizadas: ${updated}`);
console.log(`QuestÃµes puladas: ${skipped}`);
console.log(`Pendentes de revisÃ£o: ${needsReview}`);
console.log('Finalizado.');
