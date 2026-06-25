import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Loading from '../components/Loading.jsx';
import { isSupabaseConfigured, supabaseConfigMessage } from '../lib/supabaseClient.js';
import { getSession, signOut, updatePassword } from '../services/authService.js';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [checkingSession, setCheckingSession] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let mounted = true;

    getSession().then(({ session, error: sessionError }) => {
      if (!mounted) return;

      if (sessionError) {
        setError(sessionError.message);
      } else if (!session && isSupabaseConfigured) {
        setError('Link de recuperação inválido ou expirado. Solicite um novo link na tela de login.');
      }

      setCheckingSession(false);
    });

    return () => {
      mounted = false;
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    if (newPassword.length < 6) {
      setError('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('As senhas não são iguais.');
      return;
    }

    setLoading(true);
    const { error: updateError } = await updatePassword(newPassword);

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setMessage('Senha redefinida com sucesso. Redirecionando para o login...');
    await signOut();
    setLoading(false);

    window.setTimeout(() => {
      navigate('/login', { replace: true });
    }, 1200);
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div>
          <span className="eyebrow">Conta</span>
          <h1>Redefinir senha</h1>
          <p>Informe uma nova senha para concluir a recuperação de acesso.</p>
        </div>

        {!isSupabaseConfigured ? <div className="notice">{supabaseConfigMessage}</div> : null}
        {checkingSession ? <Loading label="Validando link de recuperação..." /> : null}
        {error ? <div className="error">{error}</div> : null}
        {message ? <div className="success">{message}</div> : null}

        <form onSubmit={handleSubmit}>
          <label>
            Nova senha
            <input
              autoComplete="new-password"
              disabled={checkingSession || loading || Boolean(message)}
              minLength="6"
              onChange={(event) => setNewPassword(event.target.value)}
              required
              type="password"
              value={newPassword}
            />
          </label>
          <label>
            Confirmar nova senha
            <input
              autoComplete="new-password"
              disabled={checkingSession || loading || Boolean(message)}
              minLength="6"
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              type="password"
              value={confirmPassword}
            />
          </label>
          <div className="button-row">
            <button disabled={checkingSession || loading || Boolean(message)} type="submit">
              {loading ? 'Salvando...' : 'Salvar nova senha'}
            </button>
            <button className="secondary-button" type="button" onClick={() => navigate('/login', { replace: true })}>
              Voltar ao login
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
