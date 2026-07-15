import { createSupabaseSeedClient } from '../utils/supabaseSeedClient.mjs';
import { getRoleFocusLevel, targetRole } from '../../src/lib/targetRole.js';

const unclassifiedDiscipline = 'Nao classificada';
const unclassifiedTopic = 'Nao classificado';

const rules = [
  {
    discipline: 'Portugues',
    topic: 'Lingua portuguesa',
    terms: ['texto', 'interpretacao', 'vocabulario', 'gramatica', 'crase', 'concordancia', 'pontuacao', 'ortografia', 'coesao', 'coerencia', 'regencia', 'pronome', 'verbo'],
  },
  {
    discipline: 'Matematica / Raciocinio Logico',
    topic: 'Raciocinio logico-matematico',
    terms: ['porcentagem', 'razao', 'proporcao', 'equacao', 'grafico', 'tabela', 'media', 'mediana', 'probabilidade', 'logica', 'sequencia', 'juros', 'fracao'],
  },
  {
    discipline: 'Geografia',
    topic: 'Geografia',
    terms: ['territorio', 'populacao', 'urbano', 'rural', 'regiao', 'estado', 'municipio', 'mapa', 'cartografia', 'clima', 'vegetacao'],
  },
  {
    discipline: 'Conhecimentos sobre IBGE',
    topic: 'IBGE e pesquisas oficiais',
    terms: ['ibge', 'censo', 'pesquisa', 'coleta', 'domicilio', 'recenseamento', 'estatistica oficial'],
  },
  {
    discipline: 'Informatica',
    topic: 'Informatica',
    terms: ['planilha', 'internet', 'navegador', 'sistema operacional', 'arquivo', 'seguranca da informacao', 'e-mail', 'editor de texto'],
  },
  {
    discipline: 'Etica / Administracao Publica',
    topic: 'Etica e administracao publica',
    terms: ['etica', 'servidor publico', 'administracao publica', 'principios', 'legalidade', 'impessoalidade', 'moralidade', 'publicidade', 'eficiencia'],
  },
];

function normalize(value = '') {
  return value
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function alternativesText(alternatives) {
  if (!alternatives) return '';
  if (typeof alternatives === 'string') return alternatives;
  if (Array.isArray(alternatives)) return alternatives.join(' ');
  if (typeof alternatives === 'object') return Object.values(alternatives).join(' ');
  return '';
}

function isEmptyClassification(question) {
  const discipline = normalize(question.discipline);
  const topic = normalize(question.topic || question.subject);
  return !discipline
    || !topic
    || discipline === normalize(unclassifiedDiscipline)
    || topic === normalize(unclassifiedTopic)
    || question.classification_status === 'unclassified';
}

function classify(question) {
  const text = normalize(`${question.statement} ${alternativesText(question.alternatives)}`);
  for (const rule of rules) {
    const matchedTerm = rule.terms.find((term) => text.includes(normalize(term)));
    if (matchedTerm) {
      return {
        discipline: rule.discipline,
        topic: rule.topic,
        subject: rule.topic,
        classification_status: 'auto_classified',
        classification_source: 'heuristic_rules',
        classification_updated_at: new Date().toISOString(),
      };
    }
  }

  return {
    discipline: unclassifiedDiscipline,
    topic: unclassifiedTopic,
    subject: unclassifiedTopic,
    classification_status: 'unclassified',
    classification_source: 'heuristic_rules',
    classification_updated_at: new Date().toISOString(),
  };
}

function classifyRoleFocus(question) {
  return getRoleFocusLevel([
    question.source_name,
    question.source_page_url,
    question.import_notes,
    question.statement,
  ].filter(Boolean).join(' '));
}

const supabase = await createSupabaseSeedClient();

const { data, error } = await supabase
  .from('questions')
  .select('id, statement, alternatives, discipline, subject, topic, classification_status, source_name, source_page_url, import_notes')
  .order('created_at', { ascending: false });

if (error) throw error;

let analyzed = 0;
let classified = 0;
let unclassified = 0;
const byDiscipline = new Map();
const byTopic = new Map();
const byFocus = new Map();

for (const question of data ?? []) {
  const shouldClassifyDiscipline = isEmptyClassification(question);
  if (!shouldClassifyDiscipline) continue;
  analyzed += 1;
  const roleFocus = classifyRoleFocus(question);
  const payload = {
    ...classify(question),
    role_focus: roleFocus,
    target_role: targetRole,
  };
  const { error: updateError } = await supabase.from('questions').update(payload).eq('id', question.id);
  if (updateError) throw updateError;

  if (payload.classification_status === 'auto_classified') classified += 1;
  else unclassified += 1;

  byDiscipline.set(payload.discipline, (byDiscipline.get(payload.discipline) || 0) + 1);
  byTopic.set(payload.topic, (byTopic.get(payload.topic) || 0) + 1);
  byFocus.set(payload.role_focus, (byFocus.get(payload.role_focus) || 0) + 1);
}

console.log('Classificacao de questoes importadas');
console.log(`Analisadas: ${analyzed}`);
console.log(`Classificadas: ${classified}`);
console.log(`Nao classificadas: ${unclassified}`);
console.log('Por disciplina:');
for (const [discipline, total] of [...byDiscipline.entries()].sort()) console.log(`- ${discipline}: ${total}`);
console.log('Por assunto:');
for (const [topic, total] of [...byTopic.entries()].sort()) console.log(`- ${topic}: ${total}`);
console.log('Por foco ACA/relacionadas/outras:');
for (const [focus, total] of [...byFocus.entries()].sort()) console.log(`- ${focus}: ${total}`);
console.log('Finalizado.');
