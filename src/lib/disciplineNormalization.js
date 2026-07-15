const disciplineMap = [
  {
    slug: 'portugues',
    label: 'Português',
    aliases: ['portugues', 'português', 'lingua portuguesa', 'língua portuguesa'],
  },
  {
    slug: 'matematica-raciocinio-logico',
    label: 'Matemática/Raciocínio Lógico',
    aliases: [
      'matematica / raciocinio logico',
      'matemática / raciocínio lógico',
      'raciocinio logico',
      'raciocínio lógico',
      'matematica',
      'matemática',
    ],
  },
  {
    slug: 'conhecimentos-ibge',
    label: 'Conhecimentos sobre IBGE',
    aliases: ['conhecimentos sobre ibge', 'ibge e pesquisas oficiais', 'conhecimentos ibge', 'geografia'],
  },
  {
    slug: 'informatica',
    label: 'Informática',
    aliases: ['informatica', 'informática'],
  },
  {
    slug: 'etica-administracao-publica',
    label: 'Ética/Administração Pública',
    aliases: [
      'etica / administracao publica',
      'ética/administração pública',
      'ética / administração pública',
      'administracao publica',
      'administração pública',
      'etica',
      'ética',
    ],
  },
];

function normalizeText(value = '') {
  return value
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findDiscipline(value = '') {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  return disciplineMap.find((discipline) => discipline.aliases.some((alias) => {
    const normalizedAlias = normalizeText(alias);
    return normalized === normalizedAlias || normalized.includes(normalizedAlias);
  })) || null;
}

export function normalizeDiscipline(value) {
  return findDiscipline(value)?.slug || 'nao-classificada';
}

export function getDisciplineLabel(value) {
  return findDiscipline(value)?.label || 'Questões ainda não classificadas';
}

export function getDisciplineSlug(value) {
  return normalizeDiscipline(value);
}

export const knownDisciplines = disciplineMap.map(({ slug, label }) => ({ slug, label }));
