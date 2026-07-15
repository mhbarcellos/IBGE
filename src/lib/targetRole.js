const viteEnv = import.meta.env || {};
const nodeEnv = typeof process !== 'undefined' ? process.env : {};

export const targetRole = viteEnv.VITE_TARGET_ROLE || nodeEnv.VITE_TARGET_ROLE || nodeEnv.TARGET_EXAM_ROLE || 'ACA';
export const targetRoleLabel = viteEnv.VITE_TARGET_ROLE_LABEL || nodeEnv.VITE_TARGET_ROLE_LABEL || nodeEnv.TARGET_EXAM_ROLE_LABEL || 'Agente Censitário Administrativo';

const targetAliases = [
  'aca',
  'agente censitário administrativo',
  'agente censitario administrativo',
  'agente censitário administrativo - aca',
  'agente censitario administrativo - aca',
];

const relatedAliases = [
  'aci',
  'acm',
  'acs',
  'apm',
  'scq',
  'agente censitário de administração e informática',
  'agente censitario de administracao e informatica',
  'agente censitário municipal',
  'agente censitario municipal',
  'agente censitário supervisor',
  'agente censitario supervisor',
  'agente de pesquisas e mapeamento',
  'supervisor de coleta e qualidade',
];

const knownOtherRoleTerms = [
  'recenseador',
  'analista censitário',
  'analista censitario',
  'tecnologista',
  'pesquisador',
  'supervisor de pesquisas',
];

export const roleFocusLabels = {
  target: targetRole,
  related: 'Relacionada',
  other: 'Outra',
  unknown: 'Sem classificação',
};

export const roleFocusLongLabels = {
  target: `${targetRole} — ${targetRoleLabel}`,
  related: 'Cargo relacionado',
  other: 'Outro cargo',
  unknown: 'Sem classificação',
};

export function normalizeRoleText(value = '') {
  return value
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function containsAlias(text, aliases) {
  const normalized = normalizeRoleText(text);
  return aliases.find((alias) => {
    const normalizedAlias = normalizeRoleText(alias);
    if (normalizedAlias.length <= 3) {
      return new RegExp(`(^|\\s)${normalizedAlias}(\\s|$)`).test(normalized);
    }
    return normalized.includes(normalizedAlias);
  }) || '';
}

export function isTargetRole(text) {
  return Boolean(containsAlias(text, targetAliases));
}

export function isRelatedRole(text) {
  return Boolean(containsAlias(text, relatedAliases));
}

export function getMatchedRoleAlias(text) {
  return containsAlias(text, targetAliases) || containsAlias(text, relatedAliases) || '';
}

export function getRoleFocusLevel(text) {
  const normalized = normalizeRoleText(text);
  if (!normalized) return 'unknown';
  if (isTargetRole(normalized)) return 'target';
  if (isRelatedRole(normalized)) return 'related';
  if (knownOtherRoleTerms.some((term) => normalized.includes(normalizeRoleText(term)))) return 'other';
  return 'unknown';
}

export function roleFocusMatches(question, focus) {
  if (!focus || focus === 'all') return true;
  const roleFocus = question?.role_focus || question?.exams?.role_focus || 'unknown';
  if (focus === 'target_related') return roleFocus === 'target' || roleFocus === 'related';
  return roleFocus === focus;
}
