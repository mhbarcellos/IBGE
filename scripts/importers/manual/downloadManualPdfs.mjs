import { createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';
import { createSupabaseSeedClient } from '../../utils/supabaseSeedClient.mjs';
import { fetchWithTimeout, isPciNavigationUrl, looksLikePdfUrl } from '../pci/pciUtils.mjs';
import { getManualLimit, getManualSourceName, loadEnvFile } from './manualUtils.mjs';

async function ensurePdf(file) {
  if (isPciNavigationUrl(file.url)) return { ok: false, reason: 'URL de navegacao' };
  if (looksLikePdfUrl(file.url)) return { ok: true };

  try {
    const head = await fetchWithTimeout(file.url, { method: 'HEAD', headers: { Accept: 'application/pdf' } }, 8000);
    const headType = head.headers.get('content-type') || '';
    if (head.ok && /application\/pdf|octet-stream/i.test(headType)) return { ok: true };
    if (/text\/html/i.test(headType)) return { ok: false, reason: `Conteudo nao parece PDF: ${headType}` };
  } catch {
    // Some official file hosts do not support HEAD. A short GET below confirms the type.
  }

  const response = await fetchWithTimeout(file.url, { headers: { Accept: 'application/pdf' } }, 8000);
  const contentType = response.headers.get('content-type') || '';
  response.body?.cancel?.();
  if (response.ok && /application\/pdf|octet-stream/i.test(contentType)) return { ok: true };
  return { ok: false, reason: `Conteudo nao parece PDF: ${contentType || response.status}` };
}

console.log('Baixando PDFs manuais...');
const env = loadEnvFile();
const sourceName = getManualSourceName(env);
const limit = getManualLimit(env, 'MANUAL_MAX_PDFS', 10);
const supabase = await createSupabaseSeedClient();
const outputDir = resolve(process.cwd(), 'data/imported/manual/pdfs');
mkdirSync(outputDir, { recursive: true });

const { data: files, error } = await supabase
  .from('exam_files')
  .select('*')
  .eq('source_name', sourceName)
  .in('status', ['approved', 'download_error', 'pending'])
  .in('file_type', ['prova', 'gabarito'])
  .limit(limit);
if (error) throw error;

let downloaded = 0;
let skipped = 0;
let failed = 0;

for (const [index, file] of (files ?? []).entries()) {
  const localPath = `data/imported/manual/pdfs/${file.id}.pdf`;
  const absolutePath = resolve(process.cwd(), localPath);
  console.log(`Processando PDF ${index + 1}/${files.length}: ${file.title || file.url}`);

  try {
    const preflight = await ensurePdf(file);
    if (!preflight.ok) {
      skipped += 1;
      await supabase.from('exam_files').update({ status: 'download_error' }).eq('id', file.id);
      console.log(`Ignorado: ${preflight.reason}`);
      continue;
    }

    if (existsSync(absolutePath)) {
      skipped += 1;
      await supabase.from('exam_files').update({ local_path: localPath, status: 'downloaded' }).eq('id', file.id);
      console.log(`Arquivo ja existe: ${localPath}`);
      continue;
    }

    const response = await fetchWithTimeout(file.url, { headers: { Accept: 'application/pdf' } }, 30000);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const contentType = response.headers.get('content-type') || '';
    if (contentType && !/application\/pdf|octet-stream/i.test(contentType) && !looksLikePdfUrl(file.url)) {
      throw new Error(`Conteudo nao parece PDF: ${contentType}`);
    }

    mkdirSync(dirname(absolutePath), { recursive: true });
    await finished(Readable.fromWeb(response.body).pipe(createWriteStream(absolutePath)));
    await supabase.from('exam_files').update({ local_path: localPath, status: 'downloaded' }).eq('id', file.id);
    downloaded += 1;
    console.log(`Download concluido: ${localPath}`);
  } catch (downloadError) {
    failed += 1;
    await supabase.from('exam_files').update({ status: 'download_error' }).eq('id', file.id);
    console.log(`Erro ao baixar ${file.url}: ${downloadError.message}`);
  }
}

console.log(`PDFs avaliados: ${files?.length ?? 0}`);
console.log(`Baixados: ${downloaded}`);
console.log(`Ignorados: ${skipped}`);
console.log(`Com erro: ${failed}`);
console.log('Finalizado.');
