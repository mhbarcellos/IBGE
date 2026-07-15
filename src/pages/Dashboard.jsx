import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import EmptyState from '../components/EmptyState.jsx';
import Loading from '../components/Loading.jsx';
import StatCard from '../components/StatCard.jsx';
import { useAuth } from '../context/useAuth.js';
import { useProfile } from '../hooks/useProfile.js';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient.js';
import { targetRole, targetRoleLabel } from '../lib/targetRole.js';
import { getPerformanceSummary } from '../services/performanceService.js';
import { getQuestionFilterOptions } from '../services/questionService.js';

export default function Dashboard() {
  const { user } = useAuth();
  const { isAdmin } = useProfile();
  const [summary, setSummary] = useState(null);
  const [focusStats, setFocusStats] = useState({ target: 0, related: 0, total: 0 });
  const [adminStats, setAdminStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getPerformanceSummary(user?.id),
      getQuestionFilterOptions({ includePendingReview: false }),
      getQuestionFilterOptions({ includePendingReview: false, roleFocus: 'target' }),
      getQuestionFilterOptions({ includePendingReview: false, roleFocus: 'target_related' }),
    ]).then(async ([summaryResult, optionsResult, targetOptionsResult, targetRelatedOptionsResult]) => {
      setSummary(summaryResult.data);
      setFocusStats({
        target: targetOptionsResult.data?.count ?? 0,
        related: Math.max((targetRelatedOptionsResult.data?.count ?? 0) - (targetOptionsResult.data?.count ?? 0), 0),
        total: optionsResult.data?.count ?? 0,
      });

      if (isAdmin && isSupabaseConfigured) {
        const [questionsResult, filesResult, reviewResult, reportsResult] = await Promise.all([
          supabase.from('questions').select('*', { count: 'exact', head: true }),
          supabase.from('exam_files').select('*', { count: 'exact', head: true }),
          supabase.from('questions').select('*', { count: 'exact', head: true }).eq('needs_review', true),
          supabase.from('import_run_reports').select('status, message, created_at').order('created_at', { ascending: false }).limit(1),
        ]);
        setAdminStats({
          questions: questionsResult.count ?? 0,
          files: filesResult.count ?? 0,
          review: reviewResult.count ?? 0,
          latestImport: reportsResult.data?.[0] || null,
        });
      } else {
        setAdminStats(null);
      }

      setLoading(false);
    });
  }, [isAdmin, user?.id]);

  if (loading) return <Loading />;

  return (
    <section className="content-stack">
      <header className="page-header">
        <div>
          <span className="eyebrow">Início</span>
          <h1>Dashboard</h1>
        </div>
      </header>

      <article className="focus-card">
        <div>
          <span className="eyebrow">Foco atual</span>
          <h2>{targetRole} — {targetRoleLabel}</h2>
          <p>A plataforma prioriza questões específicas de ACA e usa cargos censitários relacionados como complemento quando necessário.</p>
        </div>
        <Link className="button-link secondary-link" to="/trilha">Ver trilha</Link>
      </article>

      {focusStats.target === 0 && focusStats.related > 0 ? (
        <article className="notice">
          Ainda há poucas questões específicas de ACA. A plataforma usa questões relacionadas como complemento.
        </article>
      ) : null}

      {summary.total === 0 ? (
        <EmptyState title="Você ainda não respondeu questões." description="Comece pela trilha, por um treino curto ou por um simulado." />
      ) : null}

      <div className="stats-grid">
        <StatCard label="Questões disponíveis" value={focusStats.total} />
        <StatCard label="Questões respondidas" value={summary.total} />
        <StatCard label="Taxa de acerto" value={`${summary.percent}%`} />
        <StatCard label="Questões erradas para revisar" value={summary.wrong} />
        <StatCard label={`Questões ${targetRole}`} value={focusStats.target} />
        <StatCard label="Complementares" value={focusStats.related} />
      </div>

      <div className="action-grid">
        <article className="data-card">
          <h3>Continuar estudando</h3>
          <p>Faça uma rodada curta com feedback imediato.</p>
          <Link className="button-link" to="/questionario">Praticar agora</Link>
        </article>
        <article className="data-card">
          <h3>Praticar por disciplina</h3>
          <p>Siga um caminho organizado por assunto.</p>
          <Link className="button-link secondary-link" to="/trilha">Abrir trilha</Link>
        </article>
        <article className="data-card">
          <h3>Revisar erros</h3>
          <p>Volte às questões que mais precisam de atenção.</p>
          <Link className="button-link secondary-link" to="/revisao-erros">Revisar erros</Link>
        </article>
        <article className="data-card">
          <h3>Fazer simulado</h3>
          <p>Treine em formato mais próximo de prova.</p>
          <Link className="button-link secondary-link" to="/simulados">Criar simulado</Link>
        </article>
      </div>

      <article className="table-card">
        <h2>Últimas atividades</h2>
        {summary.recentWrong.length ? (
          <div className="responsive-table">
            <table>
              <thead>
                <tr><th>Questão</th><th>Sua resposta</th><th>Gabarito</th></tr>
              </thead>
              <tbody>
                {summary.recentWrong.map((attempt) => (
                  <tr key={attempt.id}>
                    <td>{attempt.questions?.statement || 'Questão'}</td>
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
          <h2>Área administrativa</h2>
          {adminStats ? (
            <div className="stats-grid compact">
              <div><strong>{adminStats.questions}</strong><span>Questões importadas</span></div>
              <div><strong>{adminStats.files}</strong><span>Arquivos importados</span></div>
              <div><strong>{adminStats.review}</strong><span>Pendências de revisão</span></div>
              <div><strong>{adminStats.latestImport?.status || '-'}</strong><span>Status da importação</span></div>
            </div>
          ) : null}
          <div className="button-row">
            <Link className="button-link secondary-link" to="/importacao-automatica">Importação automática</Link>
            <Link className="button-link secondary-link" to="/revisao-questoes">Revisão</Link>
            <Link className="button-link secondary-link" to="/admin/questoes">Admin</Link>
          </div>
        </article>
      ) : null}
    </section>
  );
}
