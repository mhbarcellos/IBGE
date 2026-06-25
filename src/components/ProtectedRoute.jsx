import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth.js';
import Loading from './Loading.jsx';

export default function ProtectedRoute({ children }) {
  const { loading, session } = useAuth();

  if (loading) {
    return <Loading label="Verificando login..." />;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
