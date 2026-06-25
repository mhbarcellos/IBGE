export const mockExams = [
  {
    id: 'mock-exam-1',
    title: 'IBGE - Agente de Pesquisas e Mapeamento',
    year: 2023,
    board: 'FGV',
    role: 'Agente',
    source_url: 'https://www.ibge.gov.br/',
  },
];

export const mockQuestions = [
  {
    id: 'mock-question-1',
    number: 1,
    discipline: 'Portugues',
    subject: 'Interpretacao de texto',
    topic: 'Interpretacao de texto',
    subtopic: 'Ideia central',
    statement: 'Em um texto informativo, a ideia central corresponde ao tema principal desenvolvido pelo autor.',
    alternatives: {
      A: 'Apenas a opiniao final do leitor.',
      B: 'O assunto principal desenvolvido no texto.',
      C: 'Um detalhe isolado do primeiro paragrafo.',
      D: 'A citacao mais longa do texto.',
      E: 'O titulo sem relacao com o conteudo.',
    },
    correct_answer: 'B',
    explanation: 'A ideia central resume o eixo de sentido do texto, nao apenas um detalhe.',
    explanation_status: 'reviewed',
    difficulty: 'facil',
    exams: mockExams[0],
  },
  {
    id: 'mock-question-2',
    number: 2,
    discipline: 'Raciocinio Logico',
    subject: 'Porcentagem',
    topic: 'Porcentagem',
    subtopic: 'Aumento percentual',
    statement: 'Um valor de 200 sofre aumento de 10%. Qual e o novo valor?',
    alternatives: {
      A: '210',
      B: '215',
      C: '220',
      D: '230',
      E: '240',
    },
    correct_answer: 'C',
    explanation: '10% de 200 e 20; 200 + 20 = 220.',
    explanation_status: 'reviewed',
    difficulty: 'facil',
    exams: mockExams[0],
  },
];

export const mockMaterials = [
  {
    id: 'mock-material-1',
    discipline: 'Geografia',
    subject: 'Populacao brasileira',
    title: 'Resumo de indicadores demograficos',
    content:
      'Revise conceitos de taxa de natalidade, mortalidade, crescimento vegetativo, migracao e distribuicao populacional.',
  },
];
