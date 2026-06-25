import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth.js';

export default function Landing() {
  const { session, loading } = useAuth();

  if (!loading && session) return <Navigate to="/dashboard" replace />;

  return (
    <main className="landing-page">
      <section className="landing-hero">
        <div>
          <span className="eyebrow">IBGE Estudos</span>
          <h1>IBGE Estudos</h1>
          <p>Plataforma de treino com questoes de concursos do IBGE.</p>
          <div className="button-row">
            <Link className="button-link" to="/login">Entrar</Link>
            <Link className="button-link secondary-link" to="/login">Criar conta</Link>
          </div>
        </div>
      </section>

      <section className="landing-benefits">
        <article>
          <h2>Banco de questoes</h2>
          <p>Consulte questoes importadas e organizadas para estudo.</p>
        </article>
        <article>
          <h2>Pratica com feedback</h2>
          <p>Responda alternativa por alternativa e veja a correcao na hora.</p>
        </article>
        <article>
          <h2>Desempenho individual</h2>
          <p>Acompanhe acertos, erros e assuntos que precisam de reforco.</p>
        </article>
        <article>
          <h2>Provas oficiais</h2>
          <p>Use questoes importadas de provas oficiais quando disponiveis.</p>
        </article>
      </section>
    </main>
  );
}
