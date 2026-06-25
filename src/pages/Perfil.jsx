import { useEffect, useState } from 'react';
import Loading from '../components/Loading.jsx';
import StatCard from '../components/StatCard.jsx';
import { useAuth } from '../context/useAuth.js';
import { useProfile } from '../hooks/useProfile.js';
import { getPerformanceSummary } from '../services/performanceService.js';

export default function Perfil() {
  const { user } = useAuth();
  const { profile, role, loading: profileLoading, updateProfile } = useProfile();
  const [fullName, setFullName] = useState('');
  const [summary, setSummary] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) setFullName(profile.full_name || '');
  }, [profile]);

  useEffect(() => {
    getPerformanceSummary(user?.id).then(({ data }) => setSummary(data));
  }, [user?.id]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    const { error: updateError } = await updateProfile({ full_name: fullName });
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setMessage('Perfil atualizado.');
  }

  if (profileLoading || !summary) return <Loading />;

  return (
    <section className="content-stack">
      <header className="page-header">
        <div>
          <span className="eyebrow">Conta</span>
          <h1>Perfil</h1>
        </div>
      </header>

      {message ? <div className="success">{message}</div> : null}
      {error ? <div className="error">{error}</div> : null}

      <form className="panel-form" onSubmit={handleSubmit}>
        <h2>Dados da conta</h2>
        <label>
          Email
          <input disabled value={profile?.email || user?.email || ''} />
        </label>
        <label>
          Nome
          <input value={fullName} onChange={(event) => setFullName(event.target.value)} />
        </label>
        <label>
          Papel
          <input disabled value={role} />
        </label>
        <button disabled={saving} type="submit">{saving ? 'Salvando...' : 'Salvar nome'}</button>
      </form>

      <div className="stats-grid">
        <StatCard label="Questoes respondidas" value={summary.total} />
        <StatCard label="Acertos" value={summary.correct} />
        <StatCard label="Taxa de acerto" value={`${summary.percent}%`} />
      </div>
    </section>
  );
}
