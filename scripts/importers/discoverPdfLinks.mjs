import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as cheerio from 'cheerio';
import { createSupabaseSeedClient } from '../utils/supabaseSeedClient.mjs';
import { classifyExamRelevance } from './utils/fileInference.mjs';

const terms = ['prova', 'gabarito', 'edital', 'caderno', 'resultado', 'comunicado'];
const sourceTimeoutMs = 15000;
const delay = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));

function loadEnvValue(key) {
  if (process.env[key]) return process.env[key];

  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return '';

  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;

    const envKey = trimmed.slice(0, separator).trim();
    if (envKey !== key) continue;

    return trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, '');
  }

  return '';
}

function isMissingTableError(error) {
  return error?.message?.includes('Could not find the table') || error?.code === 'PGRST205';
}

function classifyFileType(text) {
  const lower = text.toLowerCase();
  if (lower.includes('gabarito')) return 'gabarito';
  if (lower.includes('edital')) return 'edital';
  if (lower.includes('resultado')) return 'resultado';
  if (lower.includes('comunicado')) return 'comunicado';
  if (lower.includes('prova') || lower.includes('caderno')) return 'prova';
  return 'outro';
}

function inferYear(text) {
  const match = text.match(/\b(20\d{2}|19\d{2})\b/);
  return match ? Number(match[1]) : null;
}

function shouldKeepLink(href, label) {
  const lower = `${href} ${label}`.toLowerCase();
  return lower.includes('.pdf') || terms.some((term) => lower.includes(term));
}

function makeTitle(label, absoluteUrl) {
  const cleanLabel = label.replace(/\s+/g, ' ').trim();
  if (cleanLabel) return cleanLabel.slice(0, 240);

  const pathname = new URL(absoluteUrl).pathname.split('/').pop() || absoluteUrl;
  return decodeURIComponent(pathname).replace(/[-_]+/g, ' ').slice(0, 240);
}

async function fetchSourceHtml(source) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), sourceTimeoutMs);

  try {
    const response = await fetch(source.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; IBGE Estudos Importer)',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.text();
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`Timeout de ${sourceTimeoutMs} ms`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function extractLinks(html, source) {
  const $ = cheerio.load(html);
  const discoveredForSource = new Map();

  $('a[href]').each((_index, element) => {
    const href = $(element).attr('href');
    const label = $(element).text();
    if (!href) return;

    let absoluteUrl;
    try {
      absoluteUrl = new URL(href, source.url).toString();
    } catch {
      return;
    }

    if (!['http:', 'https:'].includes(new URL(absoluteUrl).protocol)) return;
    if (!shouldKeepLink(absoluteUrl, label)) return;

    const combined = `${label} ${absoluteUrl}`;
    const title = makeTitle(label, absoluteUrl);
    const fileType = classifyFileType(combined);
    const relevance = classifyExamRelevance({
      title,
      url: absoluteUrl,
      sourceName: source.name,
      fileType,
      notes: `Descoberto em ${source.name}`,
    });
    discoveredForSource.set(absoluteUrl, {
      source_id: source.id,
      title,
      url: absoluteUrl,
      file_type: fileType,
      guessed_year: inferYear(combined),
      guessed_board: source.name?.match(/\b(FGV|IBFC|Cebraspe)\b/i)?.[1] ?? null,
      guessed_role: null,
      is_exam_relevant: relevance.isExamRelevant,
      relevance_category: relevance.relevanceCategory,
      relevance_reason: relevance.relevanceReason,
      status: relevance.isExamRelevant ? 'discovered' : 'archived',
      archived_at: relevance.isExamRelevant ? null : new Date().toISOString(),
      notes: `Descoberto em ${source.name}`,
    });
  });

  return [...discoveredForSource.values()];
}

console.log('Iniciando descoberta de PDFs...');
console.log('Autenticando usuário de seed...');
const supabase = await createSupabaseSeedClient();
console.log('Usuário autenticado.');

console.log('Verificando tabela import_discovered_files...');
const preflight = await supabase
  .from('import_discovered_files')
  .select('id, is_exam_relevant, relevance_category, relevance_reason, archived_at')
  .limit(1);
if (preflight.error) {
  if (isMissingTableError(preflight.error)) {
    console.log('Tabela import_discovered_files não encontrada. Rode supabase/phase3_pdf_pipeline.sql no Supabase.');
  } else if (preflight.error.message?.includes('is_exam_relevant') || preflight.error.message?.includes('relevance_category')) {
    console.log('Colunas exam-only não encontradas. Rode supabase/phase3_exam_only_filter.sql no Supabase.');
  } else {
    console.log(`Erro ao verificar import_discovered_files: ${preflight.error.message}`);
  }
  console.log('Finalizado.');
  process.exit(1);
}

console.log('Buscando fontes cadastradas...');
const { data: sourceRows, error: sourcesError } = await supabase.from('import_sources').select('*').order('created_at');
if (sourcesError) throw sourcesError;

const maxSources = Number(loadEnvValue('IMPORT_MAX_SOURCES'));
const allSources = sourceRows ?? [];
const sources = Number.isFinite(maxSources) && maxSources > 0 ? allSources.slice(0, maxSources) : allSources;

console.log(`${sources.length} fontes encontradas.`);
if (!sources.length) {
  console.log('Nenhuma fonte encontrada. Rode npm run seed:sources ou npm run seed:all antes de descobrir PDFs.');
  console.log('Finalizado.');
  process.exit(0);
}

if (sources.length !== allSources.length) {
  console.log(`IMPORT_MAX_SOURCES ativo: processando ${sources.length} de ${allSources.length} fontes.`);
}

let sourcesRead = 0;
let linksFound = 0;
let inserted = 0;
let existing = 0;
const sourceErrors = [];

for (const [index, source] of sources.entries()) {
  console.log(`Lendo fonte ${index + 1}/${sources.length}: ${source.name} - ${source.url}`);

  try {
    const html = await fetchSourceHtml(source);
    const discoveredFiles = extractLinks(html, source);

    sourcesRead += 1;
    linksFound += discoveredFiles.length;
    console.log(`Fonte lida. ${discoveredFiles.length} link(s) candidato(s) encontrado(s).`);

    for (const file of discoveredFiles) {
      const current = await supabase.from('import_discovered_files').select('id').eq('url', file.url).maybeSingle();
      if (current.error) throw current.error;

      if (current.data) {
        existing += 1;
        continue;
      }

      const { error } = await supabase.from('import_discovered_files').insert(file);
      if (error) throw error;
      inserted += 1;
    }
  } catch (error) {
    sourceErrors.push({ source: source.name, message: error.message });
    console.log(`Erro na fonte ${source.name}: ${error.message}`);
  }

  if (index < sources.length - 1) {
    console.log('Aguardando 1 segundo antes da próxima fonte...');
    await delay(1000);
    console.log('Continuando descoberta.');
  }
}

console.log('Resumo da descoberta');
console.log(`Fontes lidas: ${sourcesRead}`);
console.log(`Fontes com erro: ${sourceErrors.length}`);
console.log(`Links encontrados: ${linksFound}`);
console.log(`Novos links inseridos: ${inserted}`);
console.log(`Links já existentes: ${existing}`);
if (sourceErrors.length) {
  console.log('Erros por fonte:');
  sourceErrors.forEach((item) => console.log(`- ${item.source}: ${item.message}`));
}
console.log('Finalizado.');
