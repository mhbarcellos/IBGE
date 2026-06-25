import { Navigate, Route, Routes } from 'react-router-dom';
import AdminRoute from './components/AdminRoute.jsx';
import Navbar from './components/Navbar.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import AdminQuestoes from './pages/AdminQuestoes.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Desempenho from './pages/Desempenho.jsx';
import Login from './pages/Login.jsx';
import Landing from './pages/Landing.jsx';
import ImportacaoAutomatica from './pages/ImportacaoAutomatica.jsx';
import ImportarPdf from './pages/ImportarPdf.jsx';
import Importacoes from './pages/Importacoes.jsx';
import Materiais from './pages/Materiais.jsx';
import Perfil from './pages/Perfil.jsx';
import Provas from './pages/Provas.jsx';
import Questionario from './pages/Questionario.jsx';
import Questoes from './pages/Questoes.jsx';
import RevisaoQuestoes from './pages/RevisaoQuestoes.jsx';
import ResetPassword from './pages/ResetPassword.jsx';

function AppShell({ children }) {
  return (
    <div className="app-shell">
      <Navbar />
      <main className="page">{children}</main>
    </div>
  );
}

function ProtectedPage({ children }) {
  return (
    <ProtectedRoute>
      <AppShell>{children}</AppShell>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedPage>
            <Dashboard />
          </ProtectedPage>
        }
      />
      <Route
        path="/provas"
        element={
          <ProtectedPage>
            <Provas />
          </ProtectedPage>
        }
      />
      <Route
        path="/questoes"
        element={
          <ProtectedPage>
            <Questoes />
          </ProtectedPage>
        }
      />
      <Route
        path="/questionario"
        element={
          <ProtectedPage>
            <Questionario />
          </ProtectedPage>
        }
      />
      <Route
        path="/desempenho"
        element={
          <ProtectedPage>
            <Desempenho />
          </ProtectedPage>
        }
      />
      <Route
        path="/materiais"
        element={
          <ProtectedPage>
            <Materiais />
          </ProtectedPage>
        }
      />
      <Route
        path="/perfil"
        element={
          <ProtectedPage>
            <Perfil />
          </ProtectedPage>
        }
      />
      <Route
        path="/importacoes"
        element={
          <ProtectedPage>
            <AdminRoute>
              <Importacoes />
            </AdminRoute>
          </ProtectedPage>
        }
      />
      <Route
        path="/importacao-automatica"
        element={
          <ProtectedPage>
            <AdminRoute>
              <ImportacaoAutomatica />
            </AdminRoute>
          </ProtectedPage>
        }
      />
      <Route
        path="/importar-pdf"
        element={
          <ProtectedPage>
            <AdminRoute>
              <ImportarPdf />
            </AdminRoute>
          </ProtectedPage>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedPage>
            <AdminRoute>
              <Navigate to="/admin/questoes" replace />
            </AdminRoute>
          </ProtectedPage>
        }
      />
      <Route
        path="/admin/questoes"
        element={
          <ProtectedPage>
            <AdminRoute>
              <AdminQuestoes />
            </AdminRoute>
          </ProtectedPage>
        }
      />
      <Route
        path="/revisao-questoes"
        element={
          <ProtectedPage>
            <AdminRoute>
              <RevisaoQuestoes />
            </AdminRoute>
          </ProtectedPage>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
