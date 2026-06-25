import { existsSync, unlinkSync } from 'node:fs';
import { isAbsolute, resolve, relative } from 'node:path';
import { createSupabaseSeedClient } from '../../utils/supabaseSeedClient.mjs';
import { classifyExamFileRelevance } from '../shared/fileValidation.mjs';

const apply = process.argv.includes('--apply');
const sourceNames = ['FGV IBGE', 'IBFC IBGE', 'Cebraspe IBGE', 'IBGE Trabalhe Conosco'];
const importedRoot = resolve(process.cwd(), 'data/imported');
const supabase = await createSupabaseSeedClient();

function isInsideImported(path) {
  const relativePath = relative(importedRoot, path);
  return Boolean(relativePath) && !relativePath.startsWith('..') && !isAbsolute(relativePath);
}

async function deleteByIds(table, ids) {
  if (!ids.length || !apply) return null;
  const { error } = await supabase.from(table).delete().in('id', ids);
  return error;
}

console.log(`Limpeza de exam_files irrelevantes (${apply ? 'apply' : 'dry-run'})`);

const { data: files, error } = await supabase
  .from('exam_files')
  .select('id, exam_id, file_type, title, url, source_name, file_extension, local_path, status')
  .in('source_name', sourceNames);

if (error) {
  console.error(`Nao foi possivel listar exam_files: ${error.message}`);
  process.exitCode = 1;
} else {
  const examIds = [...new Set((files ?? []).map((file) => file.exam_id).filter(Boolean))];
  const examsById = new Map();
  if (examIds.length) {
    const { data: exams, error: examsError } = await supabase
      .from('exams')
      .select('id, source_page_url, board, role')
      .in('id', examIds);
    if (examsError) {
      console.log(`Nao foi possivel carregar provas relacionadas: ${examsError.message}`);
    } else {
      for (const exam of exams ?? []) examsById.set(exam.id, exam);
    }
  }

  const keep = [];
  const remove = [];
  for (const file of files ?? []) {
    const exam = examsById.get(file.exam_id);
    const relevance = classifyExamFileRelevance({
      title: file.title,
      url: file.url,
      sourcePageUrl: exam?.source_page_url,
      sourceName: file.source_name,
      board: exam?.board,
      roleHint: exam?.role,
    });

    if (relevance.isRelevant) keep.push({ file, relevance });
    else remove.push({ file, relevance });
  }

  const removeFileIds = remove.map(({ file }) => file.id);
  const { data: texts } = removeFileIds.length
    ? await supabase.from('exam_file_texts').select('id, exam_file_id').in('exam_file_id', removeFileIds)
    : { data: [] };
  const { data: examCandidates } = removeFileIds.length
    ? await supabase.from('question_parse_candidates').select('id').in('source_exam_file_id', removeFileIds)
    : { data: [] };
  const { data: answerCandidates } = removeFileIds.length
    ? await supabase.from('question_parse_candidates').select('id').in('source_gabarito_file_id', removeFileIds)
    : { data: [] };

  const textIds = (texts ?? []).map((row) => row.id);
  const candidateIds = [...new Set([...(examCandidates ?? []), ...(answerCandidates ?? [])].map((row) => row.id))];

  const candidateDeleteError = await deleteByIds('question_parse_candidates', candidateIds);
  const textDeleteError = await deleteByIds('exam_file_texts', textIds);
  const fileDeleteError = await deleteByIds('exam_files', removeFileIds);

  let localFilesRemoved = 0;
  if (apply) {
    for (const { file } of remove) {
      if (!file.local_path) continue;
      const absolutePath = resolve(process.cwd(), file.local_path);
      if (!isInsideImported(absolutePath) || !existsSync(absolutePath)) continue;
      unlinkSync(absolutePath);
      localFilesRemoved += 1;
    }
  }

  if (candidateDeleteError) console.log(`Erro ao remover candidatas: ${candidateDeleteError.message}`);
  if (textDeleteError) console.log(`Erro ao remover textos: ${textDeleteError.message}`);
  if (fileDeleteError) console.log(`Erro ao remover exam_files: ${fileDeleteError.message}`);

  console.log(`Analisados: ${(files ?? []).length}`);
  console.log(`Manter: ${keep.length}`);
  console.log(`Remover: ${remove.length}`);
  console.log(`Removidos: ${apply && !fileDeleteError ? remove.length : 0}`);
  console.log(`Textos vinculados: ${textIds.length}`);
  console.log(`Candidatas vinculadas: ${candidateIds.length}`);
  console.log(`Arquivos locais removidos: ${localFilesRemoved}`);
  console.log('Exemplos removiveis:');
  for (const { file, relevance } of remove.slice(0, 10)) {
    console.log(`- ${file.title || file.url} (${relevance.reason})`);
  }
  if (!apply) console.log('Dry-run concluido. Use npm run ibge:clean-irrelevant-files -- --apply para remover.');
}

console.log('Finalizado.');
