import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const pciSourceName = 'PCI Concursos';
export const pciIbgeUrl = 'https://www.pciconcursos.com.br/provas/ibge';

export const delay = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));

export async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; IBGE Estudos Importer)',
        Accept: 'text/html,application/xhtml+xml',
        ...(options.headers || {}),
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

export function isPciNavigationUrl(url = '') {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/+$/, '');
    return [
      '/provas',
      '/provas/top',
      '/provas/ibge',
      '/colaborar',
    ].includes(path) || /\/provas\/(?:top|ibge|cesgranrio|fgv|consulplan|vunesp|selecon|ibade|nce-ufrj)$/i.test(path);
  } catch {
    return true;
  }
}

export function isPlausiblePciExamPage(url = '') {
  try {
    const parsed = new URL(url);
    return parsed.hostname.includes('pciconcursos.com.br')
      && /^\/provas\/download\/[a-z0-9-]+$/i.test(parsed.pathname)
      && !isPciNavigationUrl(url);
  } catch {
    return false;
  }
}

export function isBadPciLinkText(text = '') {
  return /mais acessadas|colabore|enviando provas|ultimas provas|ultimas provas|\d+[.\d]* provas|categorias?|busca/i.test(text);
}

export function hasStudyPdfTerms(text = '') {
  return /prova|gabarito|caderno|quest(?:a|o)es|questoes|questões|\.pdf/i.test(text);
}

export function looksLikePdfUrl(url = '') {
  try {
    const parsed = new URL(url);
    return /\.pdf$/i.test(parsed.pathname);
  } catch {
    return false;
  }
}

export function getEnvNumber(key, fallback = 0) {
  const envPath = resolve(process.cwd(), '.env');
  const fileValue = existsSync(envPath)
    ? readFileSync(envPath, 'utf8')
        .split(/\r?\n/)
        .find((line) => line.trim().startsWith(`${key}=`))
        ?.split('=')
        .slice(1)
        .join('=')
        .trim()
        .replace(/^["']|["']$/g, '')
    : '';
  const value = Number(process.env[key] || fileValue || fallback);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function normalizeWhitespace(value = '') {
  return value.replace(/\s+/g, ' ').trim();
}

export function isAdministrativeDocument(text = '') {
  return /edital|comunicado|resultado|convocacao|cronograma|inscricao|homologacao|retificacao|recurso|isencao/i.test(text);
}

export function inferDiscipline(text = '') {
  const lower = text.toLowerCase();
  if (/portugues|portugu[eê]s|interpretacao|interpreta[cç][aã]o|gramatica|gram[aá]tica|texto/.test(lower)) return 'Portugues';
  if (/matematica|matem[aá]tica|raciocinio|racioc[ií]nio|porcentagem|grafico|gr[aá]fico|tabela|logico|l[oó]gico/.test(lower)) return 'Matematica/Raciocinio Logico';
  if (/etica|[eé]tica|administracao publica|administra[cç][aã]o p[uú]blica|conduta/.test(lower)) return 'Etica';
  if (/ibge|geografia|territorio|territ[oó]rio|populacao|popula[cç][aã]o|indicadores/.test(lower)) return 'Conhecimentos sobre IBGE/Geografia';
  if (/informatica|inform[aá]tica|internet|navegador|seguranca|seguran[cç]a|planilha/.test(lower)) return 'Informatica';
  return 'Geral';
}

export function inferSubject(discipline) {
  const subjects = {
    Portugues: 'Interpretacao de texto',
    'Matematica/Raciocinio Logico': 'Raciocinio logico',
    Etica: 'Conduta no servico publico',
    'Conhecimentos sobre IBGE/Geografia': 'Conhecimentos sobre o IBGE',
    Informatica: 'Nocoes de informatica',
    Geral: 'Conhecimentos gerais',
  };
  return subjects[discipline] || 'Conhecimentos gerais';
}

export function parseYear(text = '') {
  const match = text.match(/\b(20\d{2}|19\d{2})\b/);
  return match ? Number(match[1]) : null;
}

export function parseBoard(text = '') {
  return text.match(/\b(FGV|IBFC|Cebraspe|Cesgranrio|AOCP|Consulplan|Vunesp|IADES|SELECON|IBADE|NCE\/UFRJ)\b/i)?.[1] ?? null;
}
