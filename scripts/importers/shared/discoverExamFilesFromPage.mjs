import * as cheerio from 'cheerio';
import { fetchWithTimeout } from './fetchWithTimeout.mjs';
import {
  detectFileExtensionFromUrl,
  detectFileTypeFromContentType,
  classifyExamFileRelevance,
  hasRelevantExamFileTerm,
  isAllowedExamFile,
  isIgnoredAdministrativeFile,
  isProcessableForText,
} from './fileValidation.mjs';

const allowedHosts = new Set([
  'cdn.cebraspe.org.br',
  'conhecimento.fgv.br',
  'concursos.ibfc.org.br',
  'ibfc.org.br',
  'www.ibge.gov.br',
  'ibge.gov.br',
]);

function normalizeWhitespace(value = '') {
  return value.replace(/\s+/g, ' ').trim();
}

function hostAllowed(url) {
  try {
    const { hostname } = new URL(url);
    return allowedHosts.has(hostname) || [...allowedHosts].some((host) => hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

function getHeaders(accept = 'text/html,application/xhtml+xml') {
  return {
    'User-Agent': 'Mozilla/5.0 (compatible; IBGE Estudos Importer)',
    Accept: accept,
  };
}

async function inspectContentType(url) {
  try {
    const head = await fetchWithTimeout(url, { method: 'HEAD', headers: getHeaders('*/*') }, 8000);
    return head.headers.get('content-type') || '';
  } catch {
    try {
      const response = await fetchWithTimeout(url, { headers: getHeaders('*/*') }, 8000);
      return response.headers.get('content-type') || '';
    } catch {
      return '';
    }
  }
}

function collectLinks(html, pageUrl) {
  const $ = cheerio.load(html);
  const links = [];
  $('a[href]').each((_index, element) => {
    const href = $(element).attr('href');
    if (!href || /^javascript:/i.test(href) || /^mailto:/i.test(href)) return;
    try {
      const url = new URL(href, pageUrl).toString();
      const title = normalizeWhitespace($(element).text()) || normalizeWhitespace($(element).attr('title') || '') || url;
      links.push({ title, url, sourcePageUrl: pageUrl });
    } catch {
      // Ignore malformed links from public pages.
    }
  });
  return links;
}

async function classifyLink(link) {
  if (!hostAllowed(link.url)) {
    return { kind: 'ignored', reason: 'dominio externo' };
  }

  if (isIgnoredAdministrativeFile({ url: link.url, title: link.title })) {
    return { kind: 'ignored', reason: 'arquivo administrativo' };
  }

  const extensionFromUrl = detectFileExtensionFromUrl(link.url);
  if (extensionFromUrl) {
    return {
      kind: 'direct_exam_file',
      fileExtension: extensionFromUrl,
      mimeType: null,
    };
  }

  if (hasRelevantExamFileTerm({ url: link.url, title: link.title })) {
    const mimeType = await inspectContentType(link.url);
    const extensionFromType = detectFileTypeFromContentType(mimeType);
    if (extensionFromType || isAllowedExamFile({ url: link.url, contentType: mimeType })) {
      return {
        kind: 'direct_exam_file',
        fileExtension: extensionFromType,
        mimeType,
      };
    }

    if (/text\/html/i.test(mimeType) || !mimeType) {
      return { kind: 'candidate_file_page', reason: 'pagina candidata' };
    }
  }

  return { kind: 'ignored', reason: 'sem sinal de prova ou gabarito' };
}

async function readHtmlPage(url) {
  const response = await fetchWithTimeout(url, { headers: getHeaders() }, 15000);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const contentType = response.headers.get('content-type') || '';
  if (contentType && !/text\/html/i.test(contentType)) {
    throw new Error(`Conteudo nao HTML: ${contentType}`);
  }
  return response.text();
}

export async function discoverExamFilesFromPage({ url, sourceName, board, year, roleHint, maxDepth = 1, logger = console }) {
  const files = [];
  const ignoredLinks = [];
  const visitedPages = new Set();
  const seenFiles = new Set();
  const queue = [{ url, depth: 0 }];

  while (queue.length) {
    const page = queue.shift();
    if (!page || visitedPages.has(page.url) || page.depth > maxDepth) continue;
    visitedPages.add(page.url);
    logger.log(`Lendo pagina oficial: ${page.url}`);

    let links;
    try {
      const html = await readHtmlPage(page.url);
      links = collectLinks(html, page.url);
    } catch (error) {
      ignoredLinks.push({ url: page.url, title: page.url, reason: error.message });
      continue;
    }

    for (const link of links) {
      const classification = await classifyLink(link);
      if (classification.kind === 'ignored') {
        ignoredLinks.push({ ...link, reason: classification.reason });
        continue;
      }

      if (classification.kind === 'candidate_file_page') {
        if (page.depth < maxDepth && !visitedPages.has(link.url)) {
          logger.log(`Seguindo pagina candidata: ${link.title} - ${link.url}`);
          queue.push({ url: link.url, depth: page.depth + 1 });
        }
        continue;
      }

      const fileExtension = classification.fileExtension || detectFileExtensionFromUrl(link.url) || 'pdf';
      if (seenFiles.has(link.url)) continue;
      seenFiles.add(link.url);

      const relevance = classifyExamFileRelevance({
        title: link.title,
        url: link.url,
        sourcePageUrl: link.sourcePageUrl,
        sourceName,
        board,
        roleHint,
      });

      if (!relevance.isRelevant) {
        logger.log(`Arquivo rejeitado: ${link.title} - ${relevance.reason}`);
        ignoredLinks.push({ ...link, reason: relevance.reason, confidence: relevance.confidence });
        continue;
      }

      logger.log(`Arquivo aceito: ${relevance.fileType} - ${link.title} - ${relevance.reason}`);
      files.push({
        file_type: relevance.fileType,
        title: link.title,
        source_page_url: link.sourcePageUrl,
        file_url: link.url,
        file_extension: fileExtension,
        mime_type: classification.mimeType,
        is_processable: isProcessableForText(fileExtension),
        relevance_reason: relevance.reason,
        relevance_confidence: relevance.confidence,
        source_name: sourceName,
        board,
        year,
        roleHint,
      });
    }
  }

  return { files, ignoredLinks };
}
