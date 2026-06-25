import * as cheerio from 'cheerio';
import { createSupabaseSeedClient } from '../../utils/supabaseSeedClient.mjs';
import {
  delay,
  fetchWithTimeout,
  getEnvNumber,
  hasStudyPdfTerms,
  isAdministrativeDocument,
  isBadPciLinkText,
  isPciNavigationUrl,
  looksLikePdfUrl,
  normalizeWhitespace,
  pciSourceName,
} from './pciUtils.mjs';

const blockedUrlPatterns = /\/provas\/top|\/colaborar\/?|\/provas\/ibge\/?$|\/provas\/?$|\/busca|categoria/i;

function classifyFile(label, url) {
  const value = `${label} ${url}`.toLowerCase();
  if (/gabarito|resposta|answer/.test(value)) return 'gabarito';
  if (/prova|caderno|quest(?:a|ã|Ã£|o)es|questoes|questões|\.pdf/.test(value)) return 'prova';
  return null;
}

function isNavigationLink(label, url) {
  return isBadPciLinkText(label) || isPciNavigationUrl(url) || blockedUrlPatterns.test(url);
}

async function confirmPdfUrl(url) {
  if (looksLikePdfUrl(url)) return { ok: true, finalUrl: url, contentType: 'url-pdf' };

  try {
    const head = await fetchWithTimeout(url, { method: 'HEAD', headers: { Accept: 'application/pdf' } }, 8000);
    const headType = head.headers.get('content-type') || '';
    if (head.ok && /application\/pdf|octet-stream/i.test(headType)) {
      return { ok: true, finalUrl: head.url || url, contentType: headType };
    }
    if (/text\/html/i.test(headType)) return { ok: false, reason: 'html', contentType: headType };
  } catch {
    // Some servers do not support HEAD; try a tiny GET below.
  }

  const response = await fetchWithTimeout(url, { headers: { Accept: 'application/pdf' } }, 8000);
  const contentType = response.headers.get('content-type') || '';
  response.body?.cancel?.();
  if (response.ok && /application\/pdf|octet-stream/i.test(contentType)) {
    return { ok: true, finalUrl: response.url || url, contentType };
  }
  return { ok: false, reason: /text\/html/i.test(contentType) ? 'html' : 'not-pdf', contentType };
}

function collectRawLinks(html, pageUrl) {
  const $ = cheerio.load(html);
  const rawLinks = [];
  let protectedLinks = 0;

  $('.card').each((_cardIndex, card) => {
    const cardTitle = normalizeWhitespace($(card).find('.card-header, h5').first().text());
    const isPdfSection = /visualizar os arquivos pdf|download dos arquivos pdf|arquivo(s)? pdf/i.test(cardTitle);
    if (!isPdfSection) return;

    $(card).find('a[href]').each((_index, element) => {
      const href = $(element).attr('href');
      const label = normalizeWhitespace($(element).text()) || normalizeWhitespace($(element).attr('data-arquivo')) || 'Arquivo PDF';
      if (!href || !hasStudyPdfTerms(`${label} ${href}`) || isBadPciLinkText(label)) return;

      if (/^javascript:/i.test(href)) {
        protectedLinks += 1;
        return;
      }

      let url;
      try {
        url = new URL(href, pageUrl).toString();
      } catch {
        return;
      }

      if (isNavigationLink(label, url) || isAdministrativeDocument(`${label} ${url}`)) return;
      rawLinks.push({ title: label, url, file_type: classifyFile(label, url) });
    });
  });

  return { rawLinks, protectedLinks };
}

async function resolvePdfLinks(link) {
  const confirmed = await confirmPdfUrl(link.url);
  if (confirmed.ok) return [{ ...link, url: confirmed.finalUrl, status: 'approved', source_name: pciSourceName }];
  if (confirmed.reason !== 'html') return [];

  const response = await fetchWithTimeout(link.url, {}, 8000);
  const html = await response.text();
  const $ = cheerio.load(html);
  const nested = [];

  $('a[href]').each((_index, element) => {
    const href = $(element).attr('href');
    const label = normalizeWhitespace($(element).text()) || link.title;
    if (!href || !hasStudyPdfTerms(`${label} ${href}`) || /^javascript:/i.test(href)) return;
    let nestedUrl;
    try {
      nestedUrl = new URL(href, link.url).toString();
    } catch {
      return;
    }
    if (isNavigationLink(label, nestedUrl)) return;
    const fileType = classifyFile(label, nestedUrl);
    if (!fileType) return;
    nested.push({ title: label, url: nestedUrl, file_type: fileType });
  });

  const confirmedNested = [];
  for (const item of nested) {
    const nestedResult = await confirmPdfUrl(item.url);
    if (nestedResult.ok) confirmedNested.push({ ...item, url: nestedResult.finalUrl, status: 'approved', source_name: pciSourceName });
  }
  return confirmedNested;
}

console.log('Importando links reais de PDFs das paginas PCI...');
const supabase = await createSupabaseSeedClient();
const maxExams = getEnvNumber('PCI_MAX_EXAMS', 3);

const { data: exams, error: examsError } = await supabase
  .from('exams')
  .select('id, title, source_page_url')
  .eq('source_name', pciSourceName)
  .not('source_page_url', 'is', null)
  .limit(maxExams);

if (examsError) throw examsError;

let read = 0;
let candidates = 0;
let confirmedPdfs = 0;
let importedProofs = 0;
let importedKeys = 0;
let htmlIgnored = 0;
let navIgnored = 0;
let protectedIgnored = 0;
let duplicates = 0;
let errors = 0;

for (const exam of exams ?? []) {
  read += 1;
  console.log(`Lendo prova ${read}/${exams.length}: ${exam.title}`);

  try {
    if (isPciNavigationUrl(exam.source_page_url)) {
      navIgnored += 1;
      console.log(`Ignorando source_page_url de navegacao: ${exam.source_page_url}`);
      continue;
    }

    const response = await fetchWithTimeout(exam.source_page_url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const { rawLinks, protectedLinks } = collectRawLinks(await response.text(), exam.source_page_url);
    protectedIgnored += protectedLinks;
    candidates += rawLinks.length;
    console.log(`Links candidatos nesta prova: ${rawLinks.length}; protegidos ignorados: ${protectedLinks}`);

    const byUrl = new Map();
    for (const rawLink of rawLinks) {
      if (isNavigationLink(rawLink.title, rawLink.url)) {
        navIgnored += 1;
        continue;
      }
      const resolved = await resolvePdfLinks(rawLink);
      if (!resolved.length) {
        htmlIgnored += 1;
        continue;
      }
      resolved.forEach((item) => byUrl.set(item.url, item));
    }

    for (const link of byUrl.values()) {
      confirmedPdfs += 1;
      const existing = await supabase
        .from('exam_files')
        .select('id')
        .eq('exam_id', exam.id)
        .eq('url', link.url)
        .maybeSingle();
      if (existing.error) throw existing.error;

      if (existing.data) {
        duplicates += 1;
        await supabase.from('exam_files').update({ ...link, status: 'approved' }).eq('id', existing.data.id);
        continue;
      }

      const { error } = await supabase.from('exam_files').insert({ ...link, exam_id: exam.id });
      if (error) throw error;
      if (link.file_type === 'gabarito') importedKeys += 1;
      if (link.file_type === 'prova') importedProofs += 1;
    }
  } catch (error) {
    errors += 1;
    console.log(`Erro ao ler ${exam.source_page_url}: ${error.message}`);
  }

  if (read < (exams?.length ?? 0)) {
    console.log('Aguardando 1 segundo antes da proxima prova...');
    await delay(1000);
  }
}

console.log(`Provas lidas: ${read}`);
console.log(`Links candidatos: ${candidates}`);
console.log(`PDFs reais confirmados: ${confirmedPdfs}`);
console.log(`PDFs de prova importados: ${importedProofs}`);
console.log(`PDFs de gabarito importados: ${importedKeys}`);
console.log(`HTMLs ignorados: ${htmlIgnored}`);
console.log(`Links de navegacao ignorados: ${navIgnored}`);
console.log(`Links protegidos por verificacao ignorados: ${protectedIgnored}`);
console.log(`Duplicados: ${duplicates}`);
console.log(`Erros: ${errors}`);
console.log('Finalizado.');
