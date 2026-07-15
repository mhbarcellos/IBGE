import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import EmptyState from '../components/EmptyState.jsx';
import Loading from '../components/Loading.jsx';
import { useAuth } from '../context/useAuth.js';
import { listAttempts } from '../services/performanceService.js';
import { listQuestions } from '../services/questionService.js';

const studyBlocks = [
  { title: 'Comece por aqui', match: ['Conhecimentos sobre IBGE', 'Geral'], description: 'Faça uma rodada curta para medir o ponto de partida.' },
  { title: 'Português', match: ['Portugues', 'Português'], description: 'Interpretação, gramática, coesão e pontuação.' },
  { title: 'Matemática/Raciocínio Lógico', match: ['Matematica', 'Matemática', 'Raciocinio', 'Raciocínio'], description: 'Porcentagem, tabelas, gráficos e problemas lógicos.' },
  { title: 'Conhecimentos sobre IBGE', match: ['IBGE', 'Geografia'], description: 'Censo, indicadores, território e pesquisas oficiais.' },
  { title: 'Informática', match: ['Informatica', 'Informática'], description: 'Navegação, segurança e planilhas.' },
  { title: 'Ética/Administração Pública', match: ['Etica', 'Ética', 'Administracao', 'Administração'], description: 'Princípios, conduta e atendimento ao público.' },
  { title: 'Revisão de erros', type: 'errors', description: 'Volte às questões erradas e corrija os padrões de erro.' },
  { title: 'Simulado', type: 'simulation', description: 'Treine em formato de prova com resultado final.' },
];

function percent(correct, total) {
  return total ? Math.round((correct / total) * 100) : 0;
}

function matchesDiscipline(question, block) {
  const text = `${question.discipline || ''} ${question.subject || ''} ${question.topic || ''}`.toLowerCase();
  return block.match?.some((term) => text.includes(term.toLowerCase()));
}

export default function Trilha() {
  const { user } = useAuth();
  const [questions, setQuestions] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      listQuestions({ includePendingReview: false, roleFocus: 'target_related' }),
      listAttempts(user?.id),
    ]).then(([questionsResult, attemptsResult]) => {
      setQuestions(questionsResult.data ?? []);
      setAttempts(attemptsResult.data ?? []);
      setLoading(false);
    });
  }, [user?.id]);

  const blocks = useMemo(() => {
    const usedQuestionIds = new Set();
    const mapped = studyBlocks.map((block) => {
      if (block.type === 'errors') {
        const wrongAttempts = attempts.filter((attempt) => !attempt.is_correct);
        return {
          ...block,
          total: wrongAttempts.length,
          correct: 0,
          rate: 0,
          to: '/revisao-erros',
          button: 'Revisar erros',
        };
      }
      if (block.type === 'simulation') {
        return {
          ...block,
          total: questions.length,
          correct: 0,
          rate: 0,
          to: '/simulados',
          button: 'Fazer simulado',
        };
      }

      const blockQuestions = questions.filter((question) => matchesDiscipline(question, block));
      blockQuestions.forEach((question) => usedQuestionIds.add(question.id));
      const blockAttempts = attempts.filter((attempt) => blockQuestions.some((question) => question.id === attempt.question_id));
      const correct = blockAttempts.filter((attempt) => attempt.is_correct).length;
      return {
        ...block,
        total: blockQuestions.length,
        correct,
        rate: percent(correct, blockAttempts.length),
        to: `/questionario?discipline=${encodeURIComponent(blockQuestions[0]?.discipline || '')}`,
        button: 'Praticar este tema',
      };
    });

    const unclassified = questions.filter((question) => !usedQuestionIds.has(question.id) && (!question.discipline || question.discipline === 'Nao classificada'));
    if (unclassified.length) {
      mapped.push({
        title: 'Questões ainda não classificadas',
        description: 'Itens úteis que ainda precisam de disciplina ou assunto refinado.',
        total: unclassified.length,
        correct: 0,
        rate: 0,
        to: '/questionario',
        button: 'Praticar',
      });
    }
    return mapped;
  }, [questions, attempts]);

  if (loading) return <Loading />;

  return (
    <section className="content-stack">
      <header className="page-header">
        <div>
          <span className="eyebrow">Plano de estudo</span>
          <h1>Trilha de Estudos</h1>
        </div>
      </header>

      {!questions.length ? <EmptyState title="Ainda não há questões para montar a trilha." description="Importe ou cadastre questões para liberar os blocos de estudo." /> : null}

      <div className="study-path-grid">
        {blocks.map((block) => (
          <article className="data-card study-path-card" key={block.title}>
            <div>
              <span className="eyebrow">{block.total} questões</span>
              <h3>{block.title}</h3>
              <p>{block.description}</p>
            </div>
            <div className="stats-grid compact">
              <div><strong>{block.total}</strong><span>Disponíveis</span></div>
              <div><strong>{block.correct}</strong><span>Acertos</span></div>
              <div><strong>{block.rate}%</strong><span>Taxa</span></div>
            </div>
            <Link className="button-link secondary-link" to={block.to}>{block.button}</Link>
          </article>
        ))}
      </div>
    </section>
  );
}
