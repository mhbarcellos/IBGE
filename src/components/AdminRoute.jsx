import { Navigate } from 'react-router-dom';
import Loading from './Loading.jsx';
import { useAuth } from '../context/useAuth.js';
import { useProfile } from '../hooks/useProfile.js';

export default function AdminRoute({ children }) {
  const { session, loading: authLoading } = useAuth();
  const { isAdmin, loading: profileLoading } = useProfile();

  if (authLoading || profileLoading) return <Loading />;
  if (!session) return <Navigate to="/login" replace />;

  if (!isAdmin) {
    return (
      <section className="content-stack">
        <article className="empty-state">
          <h1>Acesso restrito</h1>
          <p>Esta area e exclusiva para administradores.</p>
        </article>
      </section>
    );
  }

  return children;
}
