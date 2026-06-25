import { createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';
import { createSupabaseSeedClient } from '../utils/supabaseSeedClient.mjs';

const downloadTimeoutMs = 30000;

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), downloadTimeoutMs);

  try {
    return await fetch(url, { signal: controller.signal });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`Timeout de ${downloadTimeoutMs} ms`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

console.log('Iniciando download de PDFs aprovados...');
console.log('Autenticando usuário de seed...');
const supabase = await createSupabaseSeedClient();
console.log('Usuário autenticado.');

const outputDir = resolve(process.cwd(), 'data/imported/pdfs');
mkdirSync(outputDir, { recursive: true });

console.log('Buscando arquivos de prova para download...');
const { data: files, error } = await supabase
  .from('exam_files')
  .select('*')
  .not('url', 'is', null)
  .in('status', ['pending', 'discovered', 'approved']);

if (error) throw error;
console.log(`${files?.length ?? 0} arquivo(s) encontrado(s) para avaliação de download.`);

let downloaded = 0;
let skipped = 0;
let failed = 0;

for (const [index, file] of (files ?? []).entries()) {
  console.log(`Processando arquivo ${index + 1}/${files.length}: ${file.title || file.url}`);
  const localPath = `data/imported/pdfs/${file.id}.pdf`;
  const absolutePath = resolve(process.cwd(), localPath);

  try {
    if (existsSync(absolutePath)) {
      skipped += 1;
      await supabase.from('exam_files').update({ local_path: localPath, status: 'downloaded' }).eq('id', file.id);
      console.log(`Arquivo ja existia localmente: ${localPath}`);
      continue;
    }

    const response = await fetchWithTimeout(file.url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const contentType = response.headers.get('content-type') || '';
    if (contentType && !contentType.toLowerCase().includes('pdf') && !file.url.toLowerCase().includes('.pdf')) {
      throw new Error(`Conteudo nao parece PDF: ${contentType}`);
    }

    mkdirSync(dirname(absolutePath), { recursive: true });
    const stream = createWriteStream(absolutePath);
    await finished(Readable.fromWeb(response.body).pipe(stream));

    await supabase.from('exam_files').update({ local_path: localPath, status: 'downloaded' }).eq('id', file.id);
    downloaded += 1;
    console.log(`Download concluido: ${localPath}`);
  } catch (downloadError) {
    failed += 1;
    await supabase.from('exam_files').update({ status: 'error' }).eq('id', file.id);
    console.log(`Erro ao baixar ${file.url}: ${downloadError.message}`);
  }
}

console.log(`Arquivos encontrados para download: ${files?.length ?? 0}`);
console.log(`Baixados: ${downloaded}`);
console.log(`Ignorados: ${skipped}`);
console.log(`Com erro: ${failed}`);
console.log('Finalizado.');
