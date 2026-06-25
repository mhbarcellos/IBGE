import { useEffect, useState } from 'react';
import EmptyState from '../components/EmptyState.jsx';
import Loading from '../components/Loading.jsx';
import StatCard from '../components/StatCard.jsx';
import { useAuth } from '../context/useAuth.js';
import { getPerformanceSummary } from '../services/performanceService.js';

function Table({ title, data }) {
  const rows = Object.entries(data);

  return (
    <article className="table-card">
      <h2>{title}</h2>
      {!rows.length ? <p className="muted">Sem dados.</p> : null}
      {rows.length ? (
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Total</th>
              <th>Acertos</th>
              <th>%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([name, item]) => (
              <tr key={name}>
                <td>{name}</td>
                <td>{item.total}</td>
                <td>{item.correct}</td>
                <td>{item.total ? Math.round((item.correct / item.total) * 100) : 0}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </article>
  );
}

export default function Desempenho() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPerformanceSummary(user?.id).then(({ data }) => {
      setSummary(data);
      setLoading(false);
    });
  }, [user?.id]);

  if (loading) return <Loading />;

  return (
    <section className="content-stack">
      <header className="page-header">
        <div>
          <span className="eyebrow">Historico</span>
          <h1>Desempenho</h1>
        </div>
      </header>

      {summary.total === 0 ? <EmptyState title="Sem desempenho registrado." description="Responda um questionario para preencher esta pagina." /> : null}

      <div className="stats-grid">
        <StatCard label="Total respondido" value={summary.total} />
        <StatCard label="Total de acertos" value={summary.correct} />
        <StatCard label="Percentual geral" value={`${summary.percent}%`} />
      </div>

      <div className="two-columns">
        <Table title="Por disciplina" data={summary.byDiscipline} />
        <Table title="Por assunto" data={summary.bySubject} />
      </div>

      <article className="table-card">
        <h2>Questoes erradas recentes</h2>
        {!summary.recentWrong.length ? <p className="muted">Nenhum erro recente.</p> : null}
        {summary.recentWrong.map((attempt) => (
          <div className="wrong-item" key={attempt.id}>
            <strong>{attempt.questions?.discipline} - {attempt.questions?.subject}</strong>
            <p>{attempt.questions?.statement}</p>
          </div>
        ))}
      </article>
    </section>
  );
}
