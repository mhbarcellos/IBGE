import { Link, Navigate } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle.jsx';
import { useAuth } from '../context/useAuth.js';
import { targetRole, targetRoleLabel } from '../lib/targetRole.js';

export default function Landing() {
  const { session, loading } = useAuth();

  if (!loading && session) return <Navigate to="/dashboard" replace />;

  return (
    <main className="landing-page">
      <div className="public-topbar">
        <strong>IBGE Estudos</strong>
        <ThemeToggle compact />
      </div>
      <section className="landing-hero">
        <div>
          <span className="eyebrow">Plataforma de estudos</span>
          <h1>Estude para o IBGE com foco em {targetRole}</h1>
          <p>Pratique questões, revise erros, monte simulados e acompanhe sua evolução em {targetRoleLabel}.</p>
          <div className="button-row">
            <Link className="button-link" to="/login">Entrar</Link>
            <Link className="button-link secondary-link" to="/login">Criar conta</Link>
          </div>
        </div>
      </section>

      <section className="landing-benefits">
        <article>
          <h2>Questões do IBGE</h2>
          <p>Treine por disciplina, assunto, prova e foco.</p>
        </article>
        <article>
          <h2>Feedback imediato</h2>
          <p>Veja correção e comentário logo após responder.</p>
        </article>
        <article>
          <h2>Revisão de erros</h2>
          <p>Volte ao que errou e consolide o aprendizado.</p>
        </article>
        <article>
          <h2>Simulados</h2>
          <p>Monte treinos rápidos com foco ACA.</p>
        </article>
      </section>

      <footer className="public-footer">
        Plataforma independente de estudos. Não é site oficial do IBGE. {new Date().getFullYear()}
      </footer>
    </main>
  );
}
