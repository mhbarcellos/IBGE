import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import EmptyState from '../components/EmptyState.jsx';
import Loading from '../components/Loading.jsx';
import PageHeader from '../components/PageHeader.jsx';
import { useAuth } from '../context/useAuth.js';
import { getDisciplineLabel, getDisciplineSlug, knownDisciplines } from '../lib/disciplineNormalization.js';
import { targetRole } from '../lib/targetRole.js';
import { listAttempts } from '../services/performanceService.js';
import { listQuestions } from '../services/questionService.js';

const disciplineDescriptions = {
  portugues: 'Interpretação, gramática, coesão e pontuação.',
  'matematica-raciocinio-logico': 'Porcentagem, tabelas, gráficos e problemas lógicos.',
  'conhecimentos-ibge': 'Censo, indicadores, território e pesquisas oficiais.',
  informatica: 'Navegação, segurança e planilhas.',
  'etica-administracao-publica': 'Princípios, conduta e atendimento ao público.',
  'nao-classificada': 'Itens úteis que ainda precisam de disciplina ou assunto refinado.',
};

function percent(correct, total) {
  return total ? Math.round((correct / total) * 100) : 0;
}

function isValidQuestion(question) {
  return ['A', 'B', 'C', 'D', 'E'].includes(question.correct_answer) && !question.needs_review;
}

function chooseTrailQuestions(allQuestions) {
  const valid = allQuestions.filter(isValidQuestion);
  const target = valid.filter((question) => question.role_focus === 'target');
  const related = valid.filter((question) => question.role_focus === 'related');

  if (target.length) {
    return {
      questions: [...target, ...related],
      totalValid: valid.length,
      target: target.length,
      related: related.length,
      unknown: valid.filter((question) => question.role_focus === 'unknown').length,
      notice: related.length ? `A trilha prioriza ${targetRole} e inclui cargos relacionados como complemento.` : '',
    };
  }

  if (related.length) {
    return {
      questions: related,
      totalValid: valid.length,
      target: 0,
      related: related.length,
      unknown: valid.filter((question) => question.role_focus === 'unknown').length,
      notice: `Ainda há poucas questões específicas de ${targetRole}. Questões de cargos relacionados estão sendo usadas como complemento.`,
    };
  }

  return {
    questions: valid,
    totalValid: valid.length,
    target: 0,
    related: 0,
    unknown: valid.filter((question) => question.role_focus === 'unknown').length,
    notice: valid.length ? 'Estas questões ainda estão sendo classificadas por cargo.' : '',
  };
}

function makeBlock({ slug, title, description, questions, attempts }) {
  const questionIds = new Set(questions.map((question) => question.id));
  const blockAttempts = attempts.filter((attempt) => questionIds.has(attempt.question_id));
  const correct = blockAttempts.filter((attempt) => attempt.is_correct).length;
  return {
    slug,
    title,
    description,
    total: questions.length,
    correct,
    rate: percent(correct, blockAttempts.length),
    to: `/questionario?discipline=${encodeURIComponent(questions[0]?.discipline || '')}`,
  };
}

export default function Trilha() {
  const { user } = useAuth();
  const [allQuestions, setAllQuestions] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      listQuestions({ includePendingReview: false, roleFocus: 'all' }),
      listAttempts(user?.id),
    ]).then(([questionsResult, attemptsResult]) => {
      setAllQuestions(questionsResult.data ?? []);
      setAttempts(attemptsResult.data ?? []);
      setLoading(false);
    });
  }, [user?.id]);

  const trail = useMemo(() => chooseTrailQuestions(allQuestions), [allQuestions]);

  const { primaryBlocks, secondaryBlocks, emptyDisciplines } = useMemo(() => {
    const byDiscipline = new Map();
    for (const question of trail.questions) {
      const slug = getDisciplineSlug(`${question.discipline || ''} ${question.subject || ''} ${question.topic || ''}`);
      if (!byDiscipline.has(slug)) byDiscipline.set(slug, []);
      byDiscipline.get(slug).push(question);
    }

    const startBlock = makeBlock({
      slug: 'comece',
      title: 'Comece por aqui',
      description: 'Uma rodada curta com todas as questões disponíveis na trilha.',
      questions: trail.questions,
      attempts,
    });

    const disciplineBlocks = [...byDiscipline.entries()]
      .map(([slug, questions]) => makeBlock({
        slug,
        title: getDisciplineLabel(questions[0]?.discipline || questions[0]?.subject || slug),
        description: disciplineDescriptions[slug] || 'Pratique questões classificadas neste tema.',
        questions,
        attempts,
      }))
      .filter((block) => block.total > 0)
      .sort((a, b) => b.total - a.total || a.title.localeCompare(b.title));

    const wrongAttempts = attempts.filter((attempt) => !attempt.is_correct);
    const secondary = [];
    if (wrongAttempts.length) {
      secondary.push({
        slug: 'revisao-erros',
        title: 'Revisão de erros',
        description: 'Volte às questões erradas e corrija os padrões de erro.',
        total: wrongAttempts.length,
        correct: 0,
        rate: 0,
        to: '/revisao-erros',
        actionLabel: 'Revisar erros',
      });
    }
    if (trail.questions.length) {
      secondary.push({
        slug: 'simulado',
        title: 'Simulado',
        description: 'Treine em formato de prova com resultado final.',
        total: trail.questions.length,
        correct: 0,
        rate: 0,
        to: '/simulados',
        actionLabel: 'Fazer simulado',
      });
    }

    const activeSlugs = new Set(disciplineBlocks.map((block) => block.slug));
    const empty = knownDisciplines.filter((discipline) => !activeSlugs.has(discipline.slug));

    return {
      primaryBlocks: trail.questions.length ? [startBlock, ...disciplineBlocks] : [],
      secondaryBlocks: secondary,
      emptyDisciplines: empty,
    };
  }, [attempts, trail]);

  if (loading) return <Loading />;

  return (
    <section className="content-stack">
      <PageHeader
        eyebrow="Plano de estudo"
        title="Trilha de Estudos"
        description="Siga uma sequência simples: comece pelo geral, aprofunde por disciplina, revise erros e faça simulados."
      />

      {trail.notice ? <article className="notice trail-notice">{trail.notice}</article> : null}

      {trail.totalValid === 0 ? (
        <EmptyState title="Ainda não há questões para montar a trilha." description="Importe ou cadastre questões com gabarito para liberar os blocos de estudo." />
      ) : null}

      {trail.totalValid > 0 ? (
        <article className="trail-summary">
          <div><strong>{trail.totalValid}</strong><span>questões válidas</span></div>
          <div><strong>{trail.target}</strong><span>{targetRole}</span></div>
          <div><strong>{trail.related}</strong><span>relacionadas</span></div>
          <div><strong>{trail.unknown}</strong><span>em classificação</span></div>
        </article>
      ) : null}

      {primaryBlocks.length ? (
        <section className="trail-section">
          <h2>Continue estudando</h2>
          <div className="trail-grid">
            {primaryBlocks.map((block) => (
              <TrailCard block={block} key={block.slug} />
            ))}
          </div>
        </section>
      ) : null}

      {secondaryBlocks.length ? (
        <section className="trail-section">
          <h2>Próximas ações</h2>
          <div className="trail-grid trail-grid-secondary">
            {secondaryBlocks.map((block) => (
              <TrailCard block={block} key={block.slug} />
            ))}
          </div>
        </section>
      ) : null}

      {emptyDisciplines.length ? (
        <details className="trail-other-themes">
          <summary>Outros temas</summary>
          <p>{emptyDisciplines.map((discipline) => discipline.label).join(', ')}</p>
        </details>
      ) : null}
    </section>
  );
}

function TrailCard({ block }) {
  const actionLabel = block.actionLabel || 'Praticar este tema';

  return (
    <article className="trail-card">
      <div className="trail-card__content">
        <span className="eyebrow">{block.total} questões</span>
        <h3>{block.title}</h3>
        <p>{block.description}</p>
      </div>
      <div className="trail-stats">
        <div><strong>{block.total}</strong><span>Disponíveis</span></div>
        <div><strong>{block.correct}</strong><span>Acertos</span></div>
        <div><strong>{block.rate}%</strong><span>Taxa</span></div>
      </div>
      <Link className="button-link secondary-link trail-card__action" to={block.to}>{actionLabel}</Link>
    </article>
  );
}
