import { createEmptyStats } from '../shared/importReport.mjs';
import { getMatchedRoleAlias, getRoleFocusLevel, targetRole } from '../../../src/lib/targetRole.js';
import { discoverExamFilesFromPage } from '../shared/discoverExamFilesFromPage.mjs';
import { upsertExam, upsertExamFile } from '../shared/saveExamFiles.mjs';

function normalizeWhitespace(value = '') {
  return value.replace(/\s+/g, ' ').trim();
}

function examTitleFromPage(page) {
  const parts = ['IBGE'];
  if (page.year) parts.push(String(page.year));
  if (page.roleHint) parts.push(page.roleHint);
  return normalizeWhitespace(parts.join(' - '));
}

function readPositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function roleFocusForPage(page, source) {
  return getRoleFocusLevel(`${page.roleHint || ''} ${page.url || ''} ${source.name || ''} ${source.board || ''}`);
}

export async function discoverSource({ supabase, source, limits = {}, logger = console }) {
  const stats = createEmptyStats(source.name);
  stats.startedAt = new Date().toISOString();
  const maxOfficialPages = readPositiveInt(process.env.IBGE_MAX_OFFICIAL_PAGES, limits.maxOfficialPages ?? 10);
  const maxExamFiles = readPositiveInt(process.env.IBGE_MAX_EXAM_FILES, limits.maxExamFiles ?? 20);
  const pages = (source.pages ?? [])
    .map((page) => ({ ...page, role_focus: roleFocusForPage(page, source) }))
    .sort((a, b) => {
      const priority = { target: 0, related: 1, other: 2, unknown: 3 };
      return (priority[a.role_focus] ?? 9) - (priority[b.role_focus] ?? 9);
    })
    .slice(0, maxOfficialPages);

  logger.log(`Iniciando fonte: ${source.name}`);
  if (!pages.length) {
    stats.errors.push('Nenhuma pagina oficial especifica configurada.');
    logger.log(`Fonte sem paginas oficiais especificas: ${source.name}`);
    return stats;
  }

  if ((source.pages ?? []).length > pages.length) {
    logger.log(`Ignorando ${(source.pages ?? []).length - pages.length} pagina(s) oficiais excedentes nesta fonte.`);
  }

  for (const page of pages) {
    try {
      logger.log(`Lendo fonte oficial: ${page.url}`);
      const { files, ignoredLinks } = await discoverExamFilesFromPage({
        url: page.url,
        sourceName: source.name,
        board: page.board || source.board,
        year: page.year,
        roleHint: page.roleHint,
        maxDepth: source.maxDepth ?? 1,
        logger,
      });

      const limitedFiles = files.slice(0, maxExamFiles);
      if (files.length > limitedFiles.length) {
        stats.pdfsBlocked += files.length - limitedFiles.length;
        logger.log(`Ignorando ${files.length - limitedFiles.length} arquivo(s) excedentes nesta pagina.`);
      }

      const relevantIgnored = ignoredLinks.filter((link) => link.reason !== 'sem sinal de prova ou gabarito');
      if (relevantIgnored.length) {
        logger.log(`Links ignorados em ${page.url}: ${relevantIgnored.length}`);
        for (const ignored of relevantIgnored.slice(0, 5)) {
          logger.log(`- Ignorado (${ignored.reason}): ${ignored.title || ignored.url}`);
        }
      }

      if (!limitedFiles.length) {
        stats.errors.push(`${page.url}: nenhum arquivo de prova/gabarito encontrado`);
        continue;
      }

      const { data: exam, created } = await upsertExam(supabase, {
        title: examTitleFromPage(page),
        year: page.year,
        board: page.board || source.board,
        role: page.roleHint || 'Prova IBGE',
        organization: 'IBGE',
        role_focus: page.role_focus || 'unknown',
        target_role: targetRole,
        role_alias_matched: getMatchedRoleAlias(`${page.roleHint || ''} ${page.url || ''}`) || null,
        source_name: source.name,
        source_page_url: page.url,
        source_url: page.url,
        imported_at: new Date().toISOString(),
      });

      stats.examsFound += 1;
      if (created) stats.examsImported += 1;

      for (const file of limitedFiles) {
        stats.pdfsFound += 1;
        await upsertExamFile(supabase, exam.id, {
          file_type: file.file_type,
          title: file.title,
          url: file.file_url,
          source_name: source.name,
          status: 'approved',
          file_extension: file.file_extension,
          mime_type: file.mime_type,
          processing_status: 'pending',
          processing_error: null,
          is_processable: file.is_processable,
        });
        logger.log(`Arquivo cadastrado: ${file.file_type} ${file.file_extension} - ${file.title}`);
      }
    } catch (error) {
      stats.errors.push(`${page.url}: ${error.message}`);
      logger.log(`Erro em ${page.url}: ${error.message}`);
    }
  }

  logger.log(`Fonte finalizada: ${source.name}`);
  return stats;
}
