import { normalizeWhitespace } from '../pciUtils.mjs';

const optionLetters = ['A', 'B', 'C', 'D', 'E'];

function cleanText(text = '') {
  return text
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => !/^(IBGE|PCI Concursos|www\.pciconcursos|Pagina \d+|Page \d+)$/i.test(line.normalize('NFD').replace(/[\u0300-\u036f]/g, '')))
    .join('\n');
}

function questionNumberMatch(chunk) {
  return chunk.match(/(?:Quest(?:a|ã|Ã£)o|QUEST(?:A|Ã)O)\s*(?:n[ºo.]?\s*)?(\d{1,3})/i)
    || chunk.match(/(?:^|\n)\s*(?:N[ºo.]?\s*)?(\d{1,3})[).]\s+/i);
}

function splitIntoChunks(text) {
  const normalized = cleanText(text);
  return normalized
    .split(/(?=(?:^|\n)\s*(?:(?:Quest(?:a|ã|Ã£)o|QUEST(?:A|Ã)O)\s*(?:n[ºo.]?\s*)?\d{1,3}|(?:N[ºo.]?\s*)?\d{1,3}[).]\s+))/g)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
}

function extractOptions(chunk) {
  const options = {};
  const optionRegex = /(?:^|\n|\s)(?:\(?([A-Ea-e])\)|([A-Ea-e])[).])\s+/g;
  const matches = [...chunk.matchAll(optionRegex)];

  for (const [index, match] of matches.entries()) {
    const letter = (match?.[1] || match?.[2] || '').toUpperCase();
    if (!optionLetters.includes(letter)) continue;

    const start = (match.index ?? 0) + (match[0]?.length ?? 0);
    const end = matches[index + 1]?.index ?? chunk.length;
    const value = normalizeWhitespace(chunk.slice(start, end));
    if (value) options[letter] = value;
  }

  return { options, firstOptionIndex: matches[0]?.index ?? -1 };
}

function confidenceFor(question) {
  const optionCount = optionLetters.filter((letter) => question[`option_${letter.toLowerCase()}`]).length;
  if (question.number && question.statement.length >= 20 && optionCount >= 5) return 0.9;
  if (question.number && question.statement.length >= 20 && optionCount >= 4) return 0.7;
  return 0.4;
}

export function parseQuestionsFromExamText(text = '') {
  const candidates = [];

  try {
    for (const chunk of splitIntoChunks(text)) {
      const numberMatch = questionNumberMatch(chunk);
      if (!numberMatch?.[1]) continue;

      const number = Number(numberMatch[1]);
      if (!number) continue;

      const { options, firstOptionIndex } = extractOptions(chunk);
      const optionCount = Object.keys(options).length;
      const statementSource = firstOptionIndex > -1 ? chunk.slice(0, firstOptionIndex) : chunk;
      const statement = normalizeWhitespace(statementSource.replace(numberMatch[0] || '', ''));
      const notes = [];

      if (statement.length < 20) notes.push('Enunciado muito curto.');
      if (optionCount < 4) notes.push('Menos de 4 alternativas detectadas.');
      if (optionCount === 4) notes.push('Apenas 4 alternativas detectadas.');

      if (statement.length < 20 || optionCount < 4) continue;

      const candidate = {
        number,
        statement,
        option_a: options.A || null,
        option_b: options.B || null,
        option_c: options.C || null,
        option_d: options.D || null,
        option_e: options.E || null,
        parseNotes: notes.join(' ') || null,
      };

      candidate.parseConfidence = confidenceFor(candidate);
      candidates.push(candidate);
    }
  } catch {
    return [];
  }

  return candidates;
}
