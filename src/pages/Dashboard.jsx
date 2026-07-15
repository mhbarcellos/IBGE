import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Loading from '../components/Loading.jsx';
import PageHeader from '../components/PageHeader.jsx';
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
          supabase.from('import_run_reports').select('status, created_at').order('created_at', { ascending: false }).limit(1),
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
      <PageHeader
        eyebrow="Início"
        title="Dashboard"
        description={`Seu plano de estudo para ${targetRole} fica aqui: pratique, revise e faça simulados sem perder o foco.`}
      />

      <article className="focus-card">
        <div>
          <span className="eyebrow">Foco atual</span>
          <h2>Continue sua preparação para {targetRole}</h2>
          <p>{targetRoleLabel}. Questões relacionadas entram como complemento quando ainda houver pouco material específico.</p>
        </div>
        <div className="button-row">
          <Link className="button-link" to="/questionario">Praticar agora</Link>
          <Link className="button-link secondary-link" to="/simulados">Fazer simulado</Link>
        </div>
      </article>

      {focusStats.target === 0 && focusStats.related > 0 ? (
        <article className="notice">
          Ainda há poucas questões específicas de ACA. A plataforma usa questões relacionadas como complemento.
        </article>
      ) : null}

      <div className="stats-grid dashboard-stats">
        <StatCard label="Questões respondidas" value={summary.total} />
        <StatCard label="Taxa de acerto" value={`${summary.percent}%`} />
        <StatCard label="Erros para revisar" value={summary.wrong} />
        <StatCard label="Questões disponíveis" value={focusStats.total} hint={`${focusStats.target} específicas de ${targetRole}`} />
      </div>

      <article className="table-card">
        <h2>Próximos passos</h2>
        <div className="action-grid compact-actions">
          <Link className="data-card action-card-link" to="/trilha">
            <strong>Continuar na trilha</strong>
            <span>Escolha uma disciplina e avance por blocos.</span>
          </Link>
          <Link className="data-card action-card-link" to="/revisao-erros">
            <strong>Revisar erros</strong>
            <span>Volte ao que você marcou errado.</span>
          </Link>
          <Link className="data-card action-card-link" to="/simulados">
            <strong>Simulado rápido</strong>
            <span>Treine em formato de prova.</span>
          </Link>
        </div>
      </article>

      {isAdmin ? (
        <article className="table-card admin-summary">
          <h2>Administração</h2>
          {adminStats ? (
            <div className="stats-grid compact">
              <div><strong>{adminStats.questions}</strong><span>Questões</span></div>
              <div><strong>{adminStats.files}</strong><span>Arquivos</span></div>
              <div><strong>{adminStats.review}</strong><span>Revisão</span></div>
              <div><strong>{adminStats.latestImport?.status || '-'}</strong><span>Importação</span></div>
            </div>
          ) : null}
          <div className="button-row">
            <Link className="button-link secondary-link" to="/importacao-automatica">Importação</Link>
            <Link className="button-link secondary-link" to="/revisao-questoes">Revisão</Link>
            <Link className="button-link secondary-link" to="/admin/questoes">Admin</Link>
          </div>
        </article>
      ) : null}
    </section>
  );
}
