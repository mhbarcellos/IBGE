import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import EmptyState from '../components/EmptyState.jsx';
import Loading from '../components/Loading.jsx';
import StatCard from '../components/StatCard.jsx';
import { useAuth } from '../context/useAuth.js';
import { useProfile } from '../hooks/useProfile.js';
import { getPerformanceSummary } from '../services/performanceService.js';

export default function Dashboard() {
  const { user } = useAuth();
  const { isAdmin } = useProfile();
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
          <span className="eyebrow">Inicio</span>
          <h1>Dashboard</h1>
        </div>
      </header>

      {summary.total === 0 ? (
        <EmptyState title="Voce ainda nao respondeu questoes." description="Comece um questionario para gerar seu historico de desempenho." />
      ) : null}

      <div className="stats-grid">
        <StatCard label="Questoes respondidas" value={summary.total} />
        <StatCard label="Acertos" value={summary.correct} />
        <StatCard label="Aproveitamento" value={`${summary.percent}%`} />
        <StatCard label="Assunto mais errado" value={summary.subjectMostWrong} />
        <StatCard label="Melhor disciplina" value={summary.bestDiscipline} />
      </div>

      <div className="button-row">
        <Link className="button-link" to="/questionario">Continuar praticando</Link>
        <Link className="button-link secondary-link" to="/questoes">Banco de Questoes</Link>
      </div>

      <article className="table-card">
        <h2>Ultimas praticas</h2>
        {summary.recentWrong.length ? (
          <div className="responsive-table">
            <table>
              <thead>
                <tr><th>Questao</th><th>Sua resposta</th><th>Gabarito</th></tr>
              </thead>
              <tbody>
                {summary.recentWrong.map((attempt) => (
                  <tr key={attempt.id}>
                    <td>{attempt.questions?.statement || 'Questao'}</td>
                    <td>{attempt.selected_answer}</td>
                    <td>{attempt.questions?.correct_answer}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">Nenhum erro recente registrado.</p>
        )}
      </article>

      {isAdmin ? (
        <article className="table-card">
          <h2>Area administrativa</h2>
          <div className="button-row">
            <Link className="button-link secondary-link" to="/importacao-automatica">Importacao automatica</Link>
            <Link className="button-link secondary-link" to="/revisao-questoes">Revisao</Link>
            <Link className="button-link secondary-link" to="/admin/questoes">Admin</Link>
          </div>
        </article>
      ) : null}
    </section>
  );
}
