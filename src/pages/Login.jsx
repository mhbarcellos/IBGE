import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth.js';
import { isSupabaseConfigured, supabaseConfigMessage } from '../lib/supabaseClient.js';
import { resetPassword, signInWithPassword, signUp } from '../services/authService.js';

export default function Login() {
  const { enterDemoMode, session } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  if (session) {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleAuth(mode) {
    setError('');
    setMessage('');
    setLoading(true);

    const result = mode === 'signup' ? await signUp(email, password) : await signInWithPassword(email, password);
    setLoading(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    if (mode === 'signup' && !result.data?.session) {
      setMessage('Conta criada. Verifique seu email se a confirmacao estiver ativa no Supabase.');
      return;
    }

    navigate('/dashboard', { replace: true });
  }

  function handleDemoMode() {
    enterDemoMode();
    navigate('/dashboard', { replace: true });
  }

  async function handleResetPassword() {
    setError('');
    setMessage('');

    if (!email) {
      setError('Preencha o e-mail para receber o link de recuperação.');
      return;
    }

    setLoading(true);
    const { error: resetError } = await resetPassword(email);
    setLoading(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setMessage('Enviamos um link de recuperação para seu e-mail.');
  }

  return (
    <main className="login-page">
      <div className="login-shell">
        <section className="login-intro">
          <span className="eyebrow">IBGE Estudos</span>
          <h1>Entre no IBGE Estudos</h1>
          <p>Treine com questões de concursos do IBGE, acompanhe seu desempenho e organize sua preparação.</p>
          <ul className="login-benefits">
            <li>Banco de questões</li>
            <li>Prática com feedback</li>
            <li>Desempenho individual</li>
            <li>Materiais de estudo</li>
          </ul>
        </section>

        <section className="login-card">
          <div>
            <span className="eyebrow">Acesso</span>
            <h1>Entrar</h1>
            <p className="muted">Use sua conta para continuar estudando.</p>
          </div>

          {!isSupabaseConfigured ? <div className="notice">{supabaseConfigMessage}</div> : null}
          {error ? <div className="error">{error}</div> : null}
          {message ? <div className="success">{message}</div> : null}

          <form onSubmit={(event) => event.preventDefault()}>
            <label>
              Email
              <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
            </label>
            <label>
              Senha
              <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required />
            </label>
            <button disabled={loading} type="button" onClick={() => handleAuth('signin')}>
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
            <div className="button-row">
              <button className="secondary-button" disabled={loading} type="button" onClick={() => handleAuth('signup')}>
                Criar conta
              </button>
              <button className="secondary-button" disabled={loading} type="button" onClick={handleResetPassword}>
                Esqueci minha senha
              </button>
              {!isSupabaseConfigured ? (
                <button className="secondary-button" disabled={loading} type="button" onClick={handleDemoMode}>
                  Entrar em modo demonstração
                </button>
              ) : null}
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
