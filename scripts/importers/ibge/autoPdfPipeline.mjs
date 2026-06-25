import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';
import { fetchWithTimeout } from '../shared/fetchWithTimeout.mjs';
import { detectFileExtensionFromUrl, detectFileTypeFromContentType, isAllowedExamFile, isProcessableForText } from '../shared/fileValidation.mjs';
import { extractTextFromExamFile } from '../shared/extractTextFromExamFile.mjs';
import { inferDiscipline, inferSubject } from '../pci/pciUtils.mjs';
import { parseAnswersFromText } from '../pci/utils/parseAnswerKeyText.mjs';
import { parseQuestionsFromExamText } from '../pci/utils/parseExamText.mjs';

const letters = ['A', 'B', 'C', 'D', 'E'];

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

function readExtractedText(textRow) {
  if (textRow?.text_content) return textRow.text_content;
  if (textRow?.local_text_path) {
    const path = resolve(process.cwd(), textRow.local_text_path);
    if (existsSync(path)) return readFileSync(path, 'utf8');
  }
  return '';
}

export async function downloadApprovedPdfs({ supabase, sourceNames, logger = console, limit = 20 }) {
  const { data: files, error } = await supabase
    .from('exam_files')
    .select('*')
    .in('source_name', sourceNames)
    .in('status', ['approved', 'download_error', 'pending'])
    .in('file_type', ['prova', 'gabarito'])
    .limit(limit);
  if (error) throw error;

  let downloaded = 0;
  let blocked = 0;
  mkdirSync(resolve(process.cwd(), 'data/imported/files'), { recursive: true });

  for (const file of files ?? []) {
    logger.log(`Baixando/validando arquivo: ${file.title || file.url}`);
    const urlExtension = detectFileExtensionFromUrl(file.url);
    let finalUrl = file.url;
    let mimeType = file.mime_type || null;
    let fileExtension = (file.file_extension || urlExtension || '').toLowerCase();

    try {
      const validationResponse = await fetchWithTimeout(file.url, { method: 'HEAD', headers: { Accept: '*/*' } }, 10000);
      mimeType = mimeType || validationResponse.headers.get('content-type') || null;
      fileExtension = fileExtension || detectFileTypeFromContentType(mimeType || '');
      finalUrl = validationResponse.url || file.url;
    } catch {
      // Some official servers reject HEAD. The GET below still validates content-type.
    }

    if (!fileExtension || !isAllowedExamFile({ url: finalUrl, contentType: mimeType || '' })) {
      blocked += 1;
      await supabase
        .from('exam_files')
        .update({
          status: 'download_error',
          processing_status: 'download_error',
          processing_error: 'Arquivo nao permitido ou content-type desconhecido.',
        })
        .eq('id', file.id);
      logger.log('Arquivo ignorado: formato nao permitido.');
      continue;
    }

    const localPath = `data/imported/files/${fileExtension}/${file.id}.${fileExtension}`;
    const absolutePath = resolve(process.cwd(), localPath);
    if (existsSync(absolutePath)) {
      await supabase
        .from('exam_files')
        .update({
          local_path: localPath,
          status: 'downloaded',
          file_extension: fileExtension,
          mime_type: mimeType,
          processing_status: 'pending',
          processing_error: null,
          is_processable: isProcessableForText(fileExtension),
        })
        .eq('id', file.id);
      continue;
    }

    try {
      const response = await fetchWithTimeout(finalUrl, { headers: { Accept: '*/*' } }, 30000);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const responseType = response.headers.get('content-type') || mimeType || '';
      if (/text\/html/i.test(responseType)) throw new Error('URL retornou HTML, nao arquivo direto.');
      fileExtension = fileExtension || detectFileTypeFromContentType(responseType);
      if (!fileExtension || !isAllowedExamFile({ url: response.url || finalUrl, contentType: responseType })) {
        throw new Error(`Content-type nao permitido: ${responseType || 'desconhecido'}`);
      }
      mkdirSync(dirname(absolutePath), { recursive: true });
      await finished(Readable.fromWeb(response.body).pipe(createWriteStream(absolutePath)));
      await supabase
        .from('exam_files')
        .update({
          local_path: localPath,
          status: 'downloaded',
          file_extension: fileExtension,
          mime_type: responseType || mimeType,
          processing_status: 'pending',
          processing_error: null,
          is_processable: isProcessableForText(fileExtension),
        })
        .eq('id', file.id);
      downloaded += 1;
    } catch (error) {
      blocked += 1;
      await supabase
        .from('exam_files')
        .update({ status: 'download_error', processing_status: 'download_error', processing_error: error.message })
        .eq('id', file.id);
      logger.log(`Erro ao baixar arquivo: ${error.message}`);
    }
  }

  return { downloaded, blocked };
}

export async function extractDownloadedTexts({ supabase, sourceNames, logger = console, limit = 20 }) {
  const { data: files, error } = await supabase
    .from('exam_files')
    .select('*')
    .in('source_name', sourceNames)
    .eq('status', 'downloaded')
    .not('local_path', 'is', null)
    .limit(limit);
  if (error) throw error;

  let extracted = 0;
  mkdirSync(resolve(process.cwd(), 'data/imported/texts'), { recursive: true });

  for (const file of files ?? []) {
    logger.log(`Extraindo texto: ${file.local_path}`);
    const filePath = resolve(process.cwd(), file.local_path);
    const localTextPath = `data/imported/texts/${file.id}.txt`;
    const absoluteTextPath = resolve(process.cwd(), localTextPath);

    try {
      const parsed = await extractTextFromExamFile(file, filePath);
      writeFileSync(absoluteTextPath, parsed.text, 'utf8');
      const { error: upsertError } = await supabase.from('exam_file_texts').upsert(
        {
          exam_file_id: file.id,
          text_content: parsed.text,
          page_count: parsed.pageCount,
          extraction_status: 'extracted',
          extraction_error: null,
          local_text_path: localTextPath,
          extracted_at: new Date().toISOString(),
        },
        { onConflict: 'exam_file_id' },
      );
      if (upsertError) throw upsertError;
      await supabase.from('exam_files').update({ processing_status: 'text_extracted', processing_error: null }).eq('id', file.id);
      extracted += 1;
    } catch (error) {
      const processingStatus = error.processingStatus || 'extract_error';
      await supabase.from('exam_file_texts').upsert(
        { exam_file_id: file.id, extraction_status: 'error', extraction_error: error.message },
        { onConflict: 'exam_file_id' },
      );
      await supabase.from('exam_files').update({ processing_status: processingStatus, processing_error: error.message }).eq('id', file.id);
      logger.log(`Erro ao extrair texto: ${error.message}`);
    }
  }

  return { extracted };
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
  if (existing.data) return supabase.from('question_parse_candidates').update(payload).eq('id', existing.data.id);
  return supabase.from('question_parse_candidates').insert(payload);
}

async function upsertQuestion(supabase, payload) {
  const existing = await supabase
    .from('questions')
    .select('id')
    .eq('source_name', payload.source_name)
    .eq('source_question_id', payload.source_question_id)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return supabase.from('questions').update(payload).eq('id', existing.data.id);
  return supabase.from('questions').insert(payload);
}

export async function parseExtractedQuestions({ supabase, sourceNames, logger = console, limit = 10 }) {
  const { data: exams, error } = await supabase
    .from('exams')
    .select('id, title, source_name, source_page_url')
    .in('source_name', sourceNames)
    .limit(limit);
  if (error) throw error;

  let candidatesCount = 0;
  let imported = 0;
  let review = 0;

  for (const exam of exams ?? []) {
    const { data: files, error: filesError } = await supabase
      .from('exam_files')
      .select('id, file_type, source_name')
      .eq('exam_id', exam.id)
      .in('source_name', sourceNames)
      .in('file_type', ['prova', 'gabarito']);
    if (filesError) throw filesError;

    const fileIds = (files ?? []).map((file) => file.id);
    if (!fileIds.length) continue;

    const { data: texts, error: textsError } = await supabase
      .from('exam_file_texts')
      .select('exam_file_id, text_content, local_text_path, extraction_status')
      .in('exam_file_id', fileIds)
      .eq('extraction_status', 'extracted');
    if (textsError) throw textsError;

    const textByFileId = new Map((texts ?? []).map((row) => [row.exam_file_id, row]));
    const proofFile = (files ?? []).find((file) => file.file_type === 'prova' && textByFileId.has(file.id));
    const answerFile = (files ?? []).find((file) => file.file_type === 'gabarito' && textByFileId.has(file.id));
    if (!proofFile) continue;

    logger.log(`Parseando questoes: ${exam.title}`);
    let parsedQuestions = [];
    let answers = {};
    try {
      parsedQuestions = parseQuestionsFromExamText(readExtractedText(textByFileId.get(proofFile.id)));
      answers = answerFile ? parseAnswersFromText(readExtractedText(textByFileId.get(answerFile.id))) : {};
    } catch (error) {
      logger.log(`Parse ignorado para ${exam.title}: ${error.message}`);
      continue;
    }

    if (!parsedQuestions.length) {
      logger.log(`Nenhuma questao detectada em ${exam.title}.`);
      continue;
    }

    if (!Object.keys(answers).length) {
      logger.log(`Gabarito nao detectado para ${exam.title}; candidatas ficarao sem resposta.`);
    }
    candidatesCount += parsedQuestions.length;

    for (const candidate of parsedQuestions) {
      const correctAnswer = answers[candidate.number] || null;
      const discipline = inferDiscipline(`${candidate.statement} ${Object.values(alternativesFromCandidate(candidate)).join(' ')}`);
      const subject = inferSubject(discipline);
      const hasEnoughData = candidate.parseConfidence >= 0.7 && optionCount(candidate) >= 4;
      const sourceQuestionId = `auto:${exam.id}:${candidate.number}`;
      const notes = [candidate.parseNotes, correctAnswer ? null : 'Gabarito nao encontrado.'].filter(Boolean).join(' ');

      const candidateResult = await upsertCandidate(supabase, {
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
      if (candidateResult.error) throw candidateResult.error;

      if (!correctAnswer || !hasEnoughData) {
        review += 1;
        continue;
      }

      const questionResult = await upsertQuestion(supabase, {
        exam_id: exam.id,
        number: candidate.number,
        discipline,
        subject,
        statement: candidate.statement,
        alternatives: alternativesFromCandidate(candidate),
        correct_answer: correctAnswer,
        explanation: null,
        difficulty: 'media',
        source_name: exam.source_name,
        source_page_url: exam.source_page_url,
        source_question_id: sourceQuestionId,
        import_status: candidate.parseConfidence >= 0.9 ? 'imported' : 'needs_review',
        import_notes: notes || null,
        needs_review: candidate.parseConfidence < 0.9,
      });
      if (questionResult.error) throw questionResult.error;
      imported += 1;
      if (candidate.parseConfidence < 0.9) review += 1;
    }
  }

  return { candidatesCount, imported, review };
}
