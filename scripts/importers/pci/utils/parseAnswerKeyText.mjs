const validAnswers = new Set(['A', 'B', 'C', 'D', 'E']);

function setAnswer(map, rawNumber, rawAnswer) {
  const number = Number(rawNumber);
  const answer = rawAnswer?.toUpperCase();
  if (!number || !validAnswers.has(answer)) return;
  if (!map[number]) map[number] = answer;
}

export function parseAnswersFromText(text = '') {
  const answers = {};
  const normalized = text.replace(/\r/g, '\n').replace(/[ \t]+/g, ' ');

  try {
    for (const match of normalized.matchAll(/(?:Quest(?:a|ã|Ã£)o|QUEST(?:A|Ã)O)\s*(\d{1,3})\s*[:\-.]?\s*([A-E])/gi)) {
      if (match?.[1] && match?.[2]) setAnswer(answers, match[1], match[2]);
    }

    for (const match of normalized.matchAll(/(?:^|\n|\s)(\d{1,3})\s*(?:[-:.]|\))?\s*([A-E])(?:\s|$)/gi)) {
      if (match?.[1] && match?.[2]) setAnswer(answers, match[1], match[2]);
    }

    for (const line of normalized.split('\n')) {
      const numbers = [...line.matchAll(/\b(\d{1,3})\b/g)].map((match) => match?.[1]).filter(Boolean);
      const letters = [...line.matchAll(/\b([A-E])\b/gi)].map((match) => match?.[1]).filter(Boolean);
      if (numbers.length && numbers.length === letters.length) {
        numbers.forEach((number, index) => setAnswer(answers, number, letters[index]));
      }
    }
  } catch {
    return {};
  }

  return answers;
}
