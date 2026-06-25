import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pdfParse from 'pdf-parse';
import { createSupabaseSeedClient } from '../utils/supabaseSeedClient.mjs';

console.log('Iniciando extração de textos de PDFs...');
console.log('Autenticando usuário de seed...');
const supabase = await createSupabaseSeedClient();
console.log('Usuário autenticado.');

const textDir = resolve(process.cwd(), 'data/imported/texts');
mkdirSync(textDir, { recursive: true });

console.log('Buscando PDFs baixados...');
const { data: files, error } = await supabase
  .from('exam_files')
  .select('*')
  .eq('status', 'downloaded')
  .not('local_path', 'is', null);

if (error) throw error;
console.log(`${files?.length ?? 0} PDF(s) encontrado(s) para extração.`);

let processed = 0;
let extracted = 0;
let failed = 0;
let skipped = 0;

for (const [index, file] of (files ?? []).entries()) {
  console.log(`Processando PDF ${index + 1}/${files.length}: ${file.local_path}`);
  processed += 1;
  const pdfPath = resolve(process.cwd(), file.local_path);
  const localTextPath = `data/imported/texts/${file.id}.txt`;
  const absoluteTextPath = resolve(process.cwd(), localTextPath);

  if (!existsSync(pdfPath)) {
    skipped += 1;
    await supabase.from('exam_file_texts').upsert(
      {
        exam_file_id: file.id,
        extraction_status: 'error',
        extraction_error: `PDF local nao encontrado: ${file.local_path}`,
      },
      { onConflict: 'exam_file_id' },
    );
    console.log(`PDF local nao encontrado: ${file.local_path}`);
    continue;
  }

  try {
    const parsed = await pdfParse(readFileSync(pdfPath));
    writeFileSync(absoluteTextPath, parsed.text, 'utf8');

    const { error: upsertError } = await supabase.from('exam_file_texts').upsert(
      {
        exam_file_id: file.id,
        text_content: parsed.text,
        page_count: parsed.numpages,
        extraction_status: 'extracted',
        extraction_error: null,
        local_text_path: localTextPath,
        extracted_at: new Date().toISOString(),
      },
      { onConflict: 'exam_file_id' },
    );

    if (upsertError) throw upsertError;
    extracted += 1;
    console.log(`Texto extraido: ${localTextPath}`);
  } catch (extractError) {
    failed += 1;
    await supabase.from('exam_file_texts').upsert(
      {
        exam_file_id: file.id,
        extraction_status: 'error',
        extraction_error: extractError.message,
      },
      { onConflict: 'exam_file_id' },
    );
    console.log(`Erro ao extrair ${file.local_path}: ${extractError.message}`);
  }
}

console.log(`PDFs processados: ${processed}`);
console.log(`Extraidos com sucesso: ${extracted}`);
console.log(`Com erro: ${failed}`);
console.log(`Ignorados: ${skipped}`);
console.log('Finalizado.');
