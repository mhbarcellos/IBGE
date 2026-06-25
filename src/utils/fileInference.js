const boards = ['FGV', 'IBFC', 'Cebraspe', 'Cesgranrio', 'AOCP', 'Consulplan'];

const rolePatterns = [
  { pattern: /\bAPM\b|agente de pesquisas e mapeamento/i, role: 'Agente de Pesquisas e Mapeamento', aliases: ['apm'] },
  { pattern: /\bSCQ\b|supervisor de coleta e qualidade/i, role: 'Supervisor de Coleta e Qualidade', aliases: ['scq'] },
  { pattern: /\bACM\b|agente censitario municipal|agente censitário municipal/i, role: 'Agente Censitário Municipal', aliases: ['acm'] },
  { pattern: /\bACS\b|agente censitario supervisor|agente censitário supervisor/i, role: 'Agente Censitário Supervisor', aliases: ['acs'] },
  { pattern: /recenseador/i, role: 'Recenseador', aliases: ['recenseador'] },
  { pattern: /analista/i, role: 'Analista', aliases: ['analista'] },
  { pattern: /tecnologista/i, role: 'Tecnologista', aliases: ['tecnologista'] },
  { pattern: /t[eé]cnico|tecnico/i, role: 'Técnico', aliases: ['tecnico', 'técnico'] },
];

function stripDiacritics(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function normalizeText(value = '') {
  return value
    .replace(/[_]+/g, ' ')
    .replace(/[-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function analysisText(input) {
  return normalizeText([input.title, input.normalizedTitle, input.url, input.sourceName, input.sourceUrl, input.notes, input.fileType].filter(Boolean).join(' '));
}

function normalizedForSearch(value = '') {
  return stripDiacritics(value).toLowerCase();
}

function inferFileType(text) {
  const lower = normalizedForSearch(text);
  if (lower.includes('comunicado')) return { fileType: 'comunicado', reason: "conter 'comunicado'" };
  if (lower.includes('edital')) return { fileType: 'edital', reason: "conter 'edital'" };
  if (lower.includes('gabarito')) return { fileType: 'gabarito', reason: "conter 'gabarito'" };
  if (/(prova|caderno|questoes|questões)/i.test(lower)) return { fileType: 'prova', reason: "conter 'prova', 'caderno' ou 'questoes'" };
  if (lower.includes('resultado')) return { fileType: 'resultado', reason: "conter 'resultado'" };
  if (lower.includes('convocacao')) return { fileType: 'convocacao', reason: "conter 'convocacao'" };
  return { fileType: 'outro', reason: 'nao conter palavras-chave especificas' };
}

function inferNoticeNumber(text) {
  const searchable = normalizedForSearch(text);
  const patterns = [
    /edital\s*(?:n(?:º|o|\.|°)?\s*)?(\d{1,2})\s*[/_ -]\s*(20\d{2})/i,
    /(?:n(?:º|o|\.|°)?\s*)?(\d{1,2})\s*[/_ -]\s*(20\d{2})/i,
  ];

  for (const pattern of patterns) {
    const match = searchable.match(pattern);
    if (match) return `${match[1].padStart(2, '0')}/${match[2]}`;
  }

  return null;
}

function inferYear(text, noticeNumber, sourceName, url) {
  if (noticeNumber) return Number(noticeNumber.split('/')[1]);

  const sourceMatch = `${sourceName || ''}`.match(/\b(2021|2022|2023|2024|2025|2026)\b/);
  if (sourceMatch) return Number(sourceMatch[1]);

  const urlMatch = `${url || ''}`.match(/\b(2021|2022|2023|2024|2025|2026)\b/);
  if (urlMatch) return Number(urlMatch[1]);

  const textMatch = text.match(/\b(2021|2022|2023|2024|2025|2026)\b/);
  return textMatch ? Number(textMatch[1]) : null;
}

function inferBoard(text) {
  const lower = normalizedForSearch(text);
  return boards.find((board) => lower.includes(board.toLowerCase())) ?? null;
}

function inferRole(text) {
  const found = rolePatterns.find((item) => item.pattern.test(text));
  return found?.role ?? null;
}

function sharedTerms(left = '', right = '') {
  const stopWords = new Set(['ibge', 'concurso', 'publico', 'public', 'nivel', 'processo', 'seletivo', 'de', 'e', 'para']);
  const leftTerms = normalizedForSearch(left)
    .split(/\W+/)
    .filter((term) => term.length > 2 && !stopWords.has(term));
  const rightTerms = new Set(
    normalizedForSearch(right)
      .split(/\W+/)
      .filter((term) => term.length > 2 && !stopWords.has(term)),
  );

  return leftTerms.filter((term) => rightTerms.has(term)).length;
}

function roleMatches(inferredRole, examRole = '') {
  if (!inferredRole) return false;
  const left = normalizedForSearch(inferredRole);
  const right = normalizedForSearch(examRole);
  return right.includes(left) || left.includes(right) || rolePatterns.some((item) => item.role === inferredRole && item.aliases.some((alias) => right.includes(alias)));
}

function scoreExam(exam, metadata, input) {
  let score = 0;
  if (metadata.inferredYear && Number(exam.year) === metadata.inferredYear) score += 3;
  if (metadata.inferredBoard && normalizedForSearch(exam.board || '').includes(metadata.inferredBoard.toLowerCase())) score += 3;
  if (roleMatches(metadata.inferredRole, exam.role)) score += 4;
  if (sharedTerms(metadata.normalizedTitle, `${exam.title} ${exam.role}`) > 0) score += 2;
  if (roleMatches(metadata.inferredRole, `${input.sourceName || ''} ${exam.role || ''}`)) score += 2;
  return score;
}

function inferExam(exams, metadata, input) {
  const ranked = (exams || [])
    .map((exam) => ({ exam, score: scoreExam(exam, metadata, input) }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];

  if (!best || best.score < 5) {
    return { inferredExamId: null, inferredExamTitle: null, examScore: 0 };
  }

  return {
    inferredExamId: best.exam.id,
    inferredExamTitle: best.exam.title,
    examScore: best.score,
  };
}

function calculateConfidence(metadata) {
  if (metadata.inferredExamId && metadata.fileType !== 'outro' && metadata.inferredYear && metadata.inferredBoard && metadata.inferredRole) return 0.9;
  if (metadata.fileType !== 'outro' && metadata.inferredYear && metadata.inferredBoard) return 0.7;
  if (metadata.fileType !== 'outro' && metadata.inferredYear) return 0.5;
  if (metadata.fileType !== 'outro') return 0.3;
  return 0;
}

function makeNotes(metadata, typeReason) {
  const notes = [`Tipo inferido por ${typeReason}.`];
  if (metadata.inferredNoticeNumber) notes.push(`Edital ${metadata.inferredNoticeNumber} detectado.`);
  if (metadata.inferredExamTitle) notes.push(`Prova sugerida por ano, banca e cargo ${metadata.inferredRole || ''}.`.replace(/\s+\./, '.'));
  else if (metadata.inferredRole) notes.push(`Cargo ${metadata.inferredRole} inferido.`);
  return notes.join(' ');
}

export function classifyExamRelevance(input) {
  const text = normalizedForSearch(analysisText(input));
  const hasGabarito = /\bgabarito(s)?\b/.test(text);
  const hasProva =
    /\bprova(s)?\b/.test(text) ||
    text.includes('prova objetiva') ||
    text.includes('caderno de prova') ||
    text.includes('caderno de questoes') ||
    (text.includes('cartao resposta') && hasGabarito);
  const hasInclusion = hasProva || hasGabarito;
  const exclusionTerms = [
    'comunicado',
    'edital',
    'resultado',
    'convocacao',
    'retificacao',
    'homologacao',
    'cronograma',
    'inscricao',
    'relacao de inscritos',
    'aviso',
    'demanda',
    'julgamento de recurso',
    'recurso',
    'classificacao',
    'lista',
    'relacao',
  ];
  const matchedExclusion = exclusionTerms.find((term) => text.includes(term));

  if (hasProva && hasGabarito) {
    return {
      isExamRelevant: true,
      relevanceCategory: 'prova_e_gabarito',
      relevanceReason: "Contem termos fortes de prova e gabarito.",
    };
  }

  if (hasProva) {
    return {
      isExamRelevant: true,
      relevanceCategory: 'prova',
      relevanceReason: "Contem termo forte de prova ou caderno de questoes.",
    };
  }

  if (hasGabarito) {
    return {
      isExamRelevant: true,
      relevanceCategory: 'gabarito',
      relevanceReason: "Contem termo forte de gabarito.",
    };
  }

  if (matchedExclusion && !hasInclusion) {
    return {
      isExamRelevant: false,
      relevanceCategory: 'irrelevante',
      relevanceReason: `Arquivado por conter termo administrativo: ${matchedExclusion}.`,
    };
  }

  return {
    isExamRelevant: false,
    relevanceCategory: 'desconhecido',
    relevanceReason: 'Nao contem termos fortes de prova ou gabarito.',
  };
}

export function inferFileMetadata(input) {
  const text = analysisText(input);
  const normalizedTitle = normalizeText(input.title || new URL(input.url).pathname.split('/').pop() || 'Arquivo descoberto');
  const { fileType, reason } = inferFileType(text);
  const inferredNoticeNumber = inferNoticeNumber(text);
  const inferredYear = inferYear(text, inferredNoticeNumber, input.sourceName, input.url);
  const inferredBoard = inferBoard(text);
  const inferredRole = inferRole(text);
  const relevance = classifyExamRelevance({
    ...input,
    normalizedTitle,
    fileType,
  });

  const metadata = {
    normalizedTitle,
    fileType,
    inferredNoticeNumber,
    inferredYear,
    inferredBoard,
    inferredRole,
    inferredExamTitle: null,
    inferredExamId: null,
    confidence: 0,
    notes: '',
    isExamRelevant: relevance.isExamRelevant,
    relevanceCategory: relevance.relevanceCategory,
    relevanceReason: relevance.relevanceReason,
  };

  const exam = inferExam(input.exams || [], metadata, input);
  metadata.inferredExamId = exam.inferredExamId;
  metadata.inferredExamTitle = exam.inferredExamTitle;
  metadata.confidence = calculateConfidence(metadata);
  metadata.notes = makeNotes(metadata, reason);

  return metadata;
}
