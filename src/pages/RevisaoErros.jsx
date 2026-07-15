import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import EmptyState from '../components/EmptyState.jsx';
import Loading from '../components/Loading.jsx';
import { useAuth } from '../context/useAuth.js';
import { listWrongAttempts } from '../services/performanceService.js';

const allValue = '__all__';

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

export default function RevisaoErros() {
  const { user } = useAuth();
  const [attempts, setAttempts] = useState([]);
  const [filters, setFilters] = useState({ discipline: allValue, subject: allValue, exam: allValue });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listWrongAttempts(user?.id).then(({ data }) => {
      setAttempts(data ?? []);
      setLoading(false);
    });
  }, [user?.id]);

  const options = useMemo(() => ({
    disciplines: unique(attempts.map((attempt) => attempt.questions?.discipline)),
    subjects: unique(attempts.map((attempt) => attempt.questions?.topic || attempt.questions?.subject)),
    exams: unique(attempts.map((attempt) => attempt.questions?.exams?.title)),
  }), [attempts]);

  const filtered = attempts.filter((attempt) => {
    const question = attempt.questions ?? {};
    const examTitle = question.exams?.title || '';
    const topic = question.topic || question.subject || '';
    return (filters.discipline === allValue || question.discipline === filters.discipline)
      && (filters.subject === allValue || topic === filters.subject)
      && (filters.exam === allValue || examTitle === filters.exam);
  });

  if (loading) return <Loading />;

  return (
    <section className="content-stack">
      <header className="page-header">
        <div>
          <span className="eyebrow">Revisão</span>
          <h1>Revisão de Erros</h1>
        </div>
        <Link className="button-link" to="/questionario">Praticar erros</Link>
      </header>

      <form className="filters">
        <label>
          Disciplina
          <select value={filters.discipline} onChange={(event) => setFilters((current) => ({ ...current, discipline: event.target.value }))}>
            <option value={allValue}>Todas</option>
            {options.disciplines.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label>
          Assunto
          <select value={filters.subject} onChange={(event) => setFilters((current) => ({ ...current, subject: event.target.value }))}>
            <option value={allValue}>Todos</option>
            {options.subjects.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label>
          Prova
          <select value={filters.exam} onChange={(event) => setFilters((current) => ({ ...current, exam: event.target.value }))}>
            <option value={allValue}>Todas</option>
            {options.exams.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
      </form>

      {!filtered.length ? <EmptyState title="Nenhum erro encontrado." description="Quando você errar questões, elas aparecerão aqui para revisão." /> : null}

      {filtered.map((attempt) => {
        const question = attempt.questions ?? {};
        return (
          <article className="question-card" key={attempt.id}>
            <div className="question-meta">
              <span>{question.discipline || 'Disciplina'}</span>
              <span>{question.topic || question.subject || 'Assunto'}</span>
              {question.exams?.title ? <span>{question.exams.title}</span> : null}
            </div>
            <h3>{question.statement}</h3>
            <div className="answer-box">
              <p><strong>Última alternativa marcada:</strong> {attempt.selected_answer}</p>
              <p><strong>Resposta correta:</strong> {question.correct_answer || 'Sem gabarito'}</p>
              <p>{question.explanation || 'Ainda não há explicação revisada para esta questão.'}</p>
            </div>
          </article>
        );
      })}
    </section>
  );
}
