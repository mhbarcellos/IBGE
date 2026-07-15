import * as cheerio from 'cheerio';
import { getMatchedRoleAlias, getRoleFocusLevel, targetRole } from '../../../src/lib/targetRole.js';
import { createSupabaseSeedClient } from '../../utils/supabaseSeedClient.mjs';
import {
  delay,
  fetchWithTimeout,
  getEnvNumber,
  isAdministrativeDocument,
  isBadPciLinkText,
  isPlausiblePciExamPage,
  normalizeWhitespace,
  parseBoard,
  parseYear,
  pciIbgeUrl,
  pciSourceName,
} from './pciUtils.mjs';

function extractExamRows(html, pageUrl) {
  const $ = cheerio.load(html);
  const exams = new Map();

  $('a[href]').each((_index, element) => {
    const href = $(element).attr('href');
    const label = normalizeWhitespace($(element).text());
    if (!href || !label || isBadPciLinkText(label)) return;

    let url;
    try {
      url = new URL(href, pageUrl).toString();
    } catch {
      return;
    }

    if (!isPlausiblePciExamPage(url)) return;
    if (isAdministrativeDocument(`${label} ${url}`)) return;

    const rowText = normalizeWhitespace($(element).closest('tr').text());
    const metadataText = `${label} ${url} ${rowText}`;
    if (!/ibge/i.test(metadataText)) return;

    const year = parseYear(metadataText);
    const board = parseBoard(metadataText);
    if (!year && !board) return;

    const role = label
      .replace(/\bIBGE\b/gi, '')
      .replace(/\b(19|20)\d{2}\b/g, '')
      .replace(/\b(FGV|IBFC|Cebraspe|Cesgranrio|AOCP|Consulplan|Vunesp|IADES|SELECON|IBADE|NCE\/UFRJ)\b/gi, '')
      .replace(/prova(s)?|quest(oes|oes)|download|pdf/gi, '')
      .trim();
    if (!role || /^ibge\s*-\s*\d+$/i.test(role)) return;
    const roleFocusText = `${role} ${label} ${url} ${rowText}`;

    exams.set(url, {
      title: normalizeWhitespace(`IBGE${year ? ` ${year}` : ''} - ${role}${board ? ` - ${board}` : ''}`),
      year,
      board,
      role,
      organization: 'IBGE',
      role_focus: getRoleFocusLevel(roleFocusText),
      target_role: targetRole,
      role_alias_matched: getMatchedRoleAlias(roleFocusText) || null,
      source_name: pciSourceName,
      source_page_url: url,
      source_url: url,
      external_id: url.split('/').filter(Boolean).pop(),
      imported_at: new Date().toISOString(),
    });
  });

  return [...exams.values()];
}

function findNextPage(html, currentUrl) {
  const $ = cheerio.load(html);
  const next = $('a[href]')
    .toArray()
    .map((element) => ({ href: $(element).attr('href'), text: normalizeWhitespace($(element).text()).toLowerCase() }))
    .find((link) => ['proxima', 'próxima', '>', 'seguinte'].includes(link.text));

  if (!next?.href) return null;
  try {
    return new URL(next.href, currentUrl).toString();
  } catch {
    return null;
  }
}

console.log('Descobrindo provas PCI IBGE...');
const supabase = await createSupabaseSeedClient();
const maxPages = getEnvNumber('PCI_MAX_LIST_PAGES', 50);
let pageUrl = pciIbgeUrl;
let pagesRead = 0;
let examsFound = 0;
let imported = 0;
let updated = 0;

const logInsert = await supabase
  .from('question_import_logs')
  .insert({ source_name: pciSourceName, source_url: pciIbgeUrl, status: 'running', started_at: new Date().toISOString() })
  .select()
  .single();
const logId = logInsert.data?.id;

while (pageUrl && pagesRead < maxPages) {
  console.log(`Lendo pagina ${pagesRead + 1}/${maxPages}: ${pageUrl}`);
  const response = await fetchWithTimeout(pageUrl);
  if (!response.ok) throw new Error(`HTTP ${response.status} em ${pageUrl}`);
  const html = await response.text();
  const exams = extractExamRows(html, pageUrl);
  examsFound += exams.length;
  console.log(`${exams.length} prova(s) valida(s) encontrada(s) nesta pagina.`);

  for (const exam of exams) {
    if (exam.source_page_url === pciIbgeUrl) continue;
    const current = await supabase.from('exams').select('id').eq('source_page_url', exam.source_page_url).maybeSingle();
    if (current.error) throw current.error;

    if (current.data) {
      const { error } = await supabase.from('exams').update(exam).eq('id', current.data.id);
      if (error) throw error;
      updated += 1;
    } else {
      const { error } = await supabase.from('exams').insert(exam);
      if (error) throw error;
      imported += 1;
    }
  }

  pagesRead += 1;
  pageUrl = findNextPage(html, pageUrl);
  if (pageUrl && pagesRead < maxPages) {
    console.log('Aguardando 1 segundo antes da proxima pagina...');
    await delay(1000);
  }
}

if (logId) {
  await supabase
    .from('question_import_logs')
    .update({
      status: 'finished',
      exams_found: examsFound,
      exams_imported: imported,
      exams_updated: updated,
      finished_at: new Date().toISOString(),
    })
    .eq('id', logId);
}

console.log(`Paginas lidas: ${pagesRead}`);
console.log(`Provas encontradas: ${examsFound}`);
console.log(`Provas importadas: ${imported}`);
console.log(`Provas atualizadas: ${updated}`);
console.log('Finalizado.');
