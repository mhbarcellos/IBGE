import { createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';
import { createSupabaseSeedClient } from '../../utils/supabaseSeedClient.mjs';
import { delay, fetchWithTimeout, getEnvNumber, isPciNavigationUrl, looksLikePdfUrl, pciSourceName } from './pciUtils.mjs';

async function ensurePdfBeforeDownload(file) {
  if (isPciNavigationUrl(file.url)) return { ok: false, reason: 'URL de navegacao' };
  if (looksLikePdfUrl(file.url)) return { ok: true };

  const response = await fetchWithTimeout(file.url, { method: 'HEAD', headers: { Accept: 'application/pdf' } }, 8000);
  const contentType = response.headers.get('content-type') || '';
  if (response.ok && /application\/pdf|octet-stream/i.test(contentType)) return { ok: true };
  return { ok: false, reason: `Conteudo nao parece PDF: ${contentType || response.status}` };
}

console.log('Baixando PDFs PCI...');
const supabase = await createSupabaseSeedClient();
const maxPdfs = getEnvNumber('PCI_MAX_PDFS', 6);
const outputDir = resolve(process.cwd(), 'data/imported/pci/pdfs');
mkdirSync(outputDir, { recursive: true });

const { data: files, error } = await supabase
  .from('exam_files')
  .select('*')
  .eq('source_name', pciSourceName)
  .in('status', ['approved', 'download_error', 'pending'])
  .in('file_type', ['prova', 'gabarito'])
  .limit(maxPdfs);

if (error) throw error;

let downloaded = 0;
let skipped = 0;
let failed = 0;

for (const [index, file] of (files ?? []).entries()) {
  const localPath = `data/imported/pci/pdfs/${file.id}.pdf`;
  const absolutePath = resolve(process.cwd(), localPath);
  console.log(`Processando PDF ${index + 1}/${files.length}: ${file.title || file.url}`);

  try {
    const preflight = await ensurePdfBeforeDownload(file);
    if (!preflight.ok) {
      skipped += 1;
      await supabase.from('exam_files').update({ status: 'download_error' }).eq('id', file.id);
      console.log(`Ignorado antes do download: ${preflight.reason}`);
      continue;
    }

    if (existsSync(absolutePath)) {
      skipped += 1;
      await supabase.from('exam_files').update({ local_path: localPath, status: 'downloaded' }).eq('id', file.id);
      console.log(`Arquivo ja existe: ${localPath}`);
      continue;
    }

    const response = await fetchWithTimeout(file.url, {}, 30000);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const contentType = response.headers.get('content-type') || '';
    if (contentType && !contentType.toLowerCase().includes('pdf') && !file.url.toLowerCase().includes('.pdf')) {
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

  if (index < (files?.length ?? 0) - 1) {
    console.log('Aguardando 1 segundo antes do proximo PDF...');
    await delay(1000);
  }
}

console.log(`PDFs avaliados: ${files?.length ?? 0}`);
console.log(`Baixados: ${downloaded}`);
console.log(`Ja existentes: ${skipped}`);
console.log(`Com erro: ${failed}`);
console.log('Finalizado.');
