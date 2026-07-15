import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth.js';
import { targetRole, targetRoleLabel } from '../lib/targetRole.js';

export default function Landing() {
  const { session, loading } = useAuth();

  if (!loading && session) return <Navigate to="/dashboard" replace />;

  return (
    <main className="landing-page">
      <section className="landing-hero">
        <div>
          <span className="eyebrow">IBGE Estudos</span>
          <h1>Estude para o IBGE com foco em {targetRole}</h1>
          <p>Plataforma independente para praticar questões, revisar erros, montar simulados e acompanhar sua evolução em {targetRoleLabel}.</p>
          <div className="button-row">
            <Link className="button-link" to="/login">Entrar</Link>
            <Link className="button-link secondary-link" to="/login">Criar conta</Link>
          </div>
        </div>
      </section>

      <section className="landing-benefits">
        <article>
          <h2>Questões de provas do IBGE</h2>
          <p>Treine com questões importadas e organizadas por disciplina, assunto, prova e foco.</p>
        </article>
        <article>
          <h2>Prática com feedback</h2>
          <p>Responda alternativa por alternativa e veja a correção logo após a resposta.</p>
        </article>
        <article>
          <h2>Revisão de erros</h2>
          <p>Volte às questões erradas para transformar tropeços em próximos acertos.</p>
        </article>
        <article>
          <h2>Simulados</h2>
          <p>Monte treinos rápidos com foco ACA, cargos relacionados ou todas as questões.</p>
        </article>
        <article>
          <h2>Desempenho individual</h2>
          <p>Acompanhe acertos, erros e assuntos que precisam de reforço.</p>
        </article>
      </section>

      <footer className="public-footer">
        Plataforma independente de estudos. Não é site oficial do IBGE. {new Date().getFullYear()}
      </footer>
    </main>
  );
}
