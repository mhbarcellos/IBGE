export const allowedExamFileExtensions = ['pdf', 'zip', 'doc', 'docx', 'xls', 'xlsx', 'csv'];

const contentTypeToExtension = new Map([
  ['application/pdf', 'pdf'],
  ['application/zip', 'zip'],
  ['application/x-zip-compressed', 'zip'],
  ['application/msword', 'doc'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx'],
  ['application/vnd.ms-excel', 'xls'],
  ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx'],
  ['text/csv', 'csv'],
  ['application/csv', 'csv'],
]);

const administrativeTerms = [
  'termos de uso',
  'lgpd',
  'tutorial',
  'pagamento',
  'comissao',
  'confirmacao',
  'autodeclaracao',
  'pessoa negros',
  'heteroidentificacao',
  'anexo',
  'anexos',
  'nomes iniciados',
  'homologado',
  'homologados',
  'homologacao',
  'resultado',
  'relacao',
  'relacao de inscritos',
  'aprovado',
  'aprovados',
  'classificado',
  'classificados',
  'liminar',
  'inscricao',
  'cronograma',
  'edital',
  'comunicado',
  'convocacao',
  'retificacao',
  'certificado',
  'curriculo',
  'mini curriculo',
  'recurso',
  'julgamento',
  'demanda',
  'aviso',
  'login',
  'painel',
  'area restrita',
];

const relevantTerms = [
  'prova',
  'provas',
  'gabarito',
  'gabaritos',
  'caderno',
  'questoes',
  'resposta',
  'respostas',
  'cartao resposta',
];

const targetRoleTerms = [
  'agente censitario administrativo',
  'agente censitário administrativo',
  'aca',
  'ibge pss 2017',
  '1pss',
  'fgv 2017',
];

function normalizeText(value = '') {
  return value
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function includesAny(text, terms) {
  return terms.some((term) => text.includes(normalizeText(term)));
}

function hasPhrase(text, phrase) {
  const normalizedPhrase = normalizeText(phrase).replace(/\s+/g, '[\\s_-]+');
  return new RegExp(`(^|[^a-z0-9])${normalizedPhrase}([^a-z0-9]|$)`, 'i').test(text);
}

export function detectFileExtensionFromUrl(url = '') {
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/\.([a-z0-9]+)$/i);
    if (!match) return null;
    const extension = match[1].toLowerCase();
    return allowedExamFileExtensions.includes(extension) ? extension : null;
  } catch {
    const match = url.split(/[?#]/)[0].match(/\.([a-z0-9]+)$/i);
    if (!match) return null;
    const extension = match[1].toLowerCase();
    return allowedExamFileExtensions.includes(extension) ? extension : null;
  }
}

export function detectFileTypeFromContentType(contentType = '') {
  const normalized = contentType.split(';')[0].trim().toLowerCase();
  return contentTypeToExtension.get(normalized) || null;
}

export function isAllowedExamFile({ url = '', contentType = '' }) {
  const extension = detectFileExtensionFromUrl(url) || detectFileTypeFromContentType(contentType);
  return Boolean(extension);
}

export function isProcessableForText(fileExtension = '') {
  return ['pdf', 'docx', 'xls', 'xlsx', 'csv'].includes(fileExtension.toLowerCase());
}

export function isIgnoredAdministrativeFile({ url = '', title = '' }) {
  const text = normalizeText(`${title} ${url}`);
  return includesAny(text, administrativeTerms);
}

export function hasRelevantExamFileTerm({ url = '', title = '' }) {
  const text = normalizeText(`${title} ${url}`);
  if (includesAny(text, targetRoleTerms)) return true;
  const hasCardSignal = text.includes('cartao resposta') || text.includes('cartao-resposta');
  if (hasCardSignal) return text.includes('prova') || text.includes('gabarito') || text.includes('resposta');
  return relevantTerms.some((term) => hasPhrase(text, term));
}

export function inferExamFileType({ url = '', title = '' }) {
  const text = normalizeText(`${title} ${url}`);
  if (text.includes('gabarito') || text.includes('resposta')) return 'gabarito';
  return 'prova';
}

export function classifyExamFileRelevance({ title = '', url = '', sourcePageUrl = '', sourceName = '', board = '', roleHint = '' } = {}) {
  const text = normalizeText(`${title} ${url}`);
  const context = normalizeText(`${sourcePageUrl} ${sourceName} ${board} ${roleHint}`);
  const fullText = `${text} ${context}`;
  const hasPdfSignal = /\.pdf(?:$|[?#])/i.test(url) || detectFileExtensionFromUrl(url) === 'pdf';
  const hasExamContext = /(concurso|prova|caderno|apm|scq|ibge|pss|objetiva)/i.test(fullText);
  const hasTargetRoleContext = includesAny(fullText, targetRoleTerms);

  if (hasPhrase(text, 'gabarito') || hasPhrase(text, 'gabaritos')) {
    return {
      isRelevant: true,
      fileType: 'gabarito',
      reason: 'gabarito oficial/preliminar/definitivo detectado',
      confidence: /(oficial|preliminar|definitivo|prova objetiva)/i.test(text) ? 0.95 : 0.8,
    };
  }

  if (includesAny(text, administrativeTerms)) {
    return {
      isRelevant: false,
      fileType: null,
      reason: 'arquivo administrativo ou resultado, nao e prova/gabarito',
      confidence: 0.95,
    };
  }

  if (hasTargetRoleContext && hasPdfSignal && /(prova|caderno|tipo|objetiva|gabarito|resposta|aca|1pss)/i.test(fullText)) {
    return {
      isRelevant: true,
      fileType: inferExamFileType({ url, title }),
      reason: 'arquivo relacionado ao foco ACA detectado',
      confidence: 0.9,
    };
  }

  const provaPhrases = [
    'prova objetiva',
    'prova objetiva tipo',
    'caderno de prova',
    'caderno de questoes',
    'prova tipo',
  ];

  if (provaPhrases.some((phrase) => hasPhrase(text, phrase))) {
    return {
      isRelevant: true,
      fileType: 'prova',
      reason: 'prova objetiva ou caderno de prova detectado',
      confidence: 0.95,
    };
  }

  if ((hasPhrase(text, 'tipo 1') || hasPhrase(text, 'tipo 2')) && hasExamContext) {
    return {
      isRelevant: true,
      fileType: 'prova',
      reason: 'tipo de prova com contexto de concurso/prova',
      confidence: 0.85,
    };
  }

  if ((hasPhrase(text, 'supervisor de coleta e qualidade') || hasPhrase(text, 'agente de pesquisas e mapeamento') || hasPhrase(text, 'agente censitario administrativo')) && hasPdfSignal && /(prova|caderno|tipo|objetiva|apm|scq|aca)/i.test(fullText)) {
    return {
      isRelevant: true,
      fileType: 'prova',
      reason: 'cargo IBGE com URL/contexto de prova real',
      confidence: 0.8,
    };
  }

  return {
    isRelevant: false,
    fileType: null,
    reason: 'sem evidencia forte de prova objetiva, caderno ou gabarito',
    confidence: 0.7,
  };
}

export function getAllowedContentTypes() {
  return [...contentTypeToExtension.keys()];
}
