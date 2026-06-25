import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { createSupabaseSeedClient } from '../../utils/supabaseSeedClient.mjs';
import { getManualLimit, getManualSourceName, loadEnvFile } from './manualUtils.mjs';

const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');

console.log('Extraindo texto dos PDFs manuais...');
const env = loadEnvFile();
const sourceName = getManualSourceName(env);
const limit = getManualLimit(env, 'MANUAL_MAX_PDFS', 10);
const supabase = await createSupabaseSeedClient();
const textDir = resolve(process.cwd(), 'data/imported/manual/texts');
mkdirSync(textDir, { recursive: true });

const { data: files, error } = await supabase
  .from('exam_files')
  .select('*')
  .eq('source_name', sourceName)
  .eq('status', 'downloaded')
  .not('local_path', 'is', null)
  .limit(limit);
if (error) throw error;

let processed = 0;
let extracted = 0;
let failed = 0;

for (const file of files ?? []) {
  processed += 1;
  const pdfPath = resolve(process.cwd(), file.local_path);
  const localTextPath = `data/imported/manual/texts/${file.id}.txt`;
  const absoluteTextPath = resolve(process.cwd(), localTextPath);
  console.log(`Extraindo ${processed}/${files.length}: ${file.local_path}`);

  try {
    if (!existsSync(pdfPath)) throw new Error(`PDF local nao encontrado: ${file.local_path}`);
    const parser = new PDFParse({ data: readFileSync(pdfPath) });
    const parsed = await parser.getText();
    writeFileSync(absoluteTextPath, parsed.text, 'utf8');

    const { error: upsertError } = await supabase.from('exam_file_texts').upsert(
      {
        exam_file_id: file.id,
        text_content: parsed.text,
        page_count: parsed.total,
        extraction_status: 'extracted',
        extraction_error: null,
        local_text_path: localTextPath,
        extracted_at: new Date().toISOString(),
      },
      { onConflict: 'exam_file_id' },
    );
    if (upsertError) throw upsertError;
    extracted += 1;
    console.log(`Texto salvo: ${localTextPath}`);
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
console.log(`Textos extraidos: ${extracted}`);
console.log(`Com erro: ${failed}`);
console.log('Finalizado.');
