import { NavLink, useNavigate } from 'react-router-dom';
import ThemeToggle from './ThemeToggle.jsx';
import { useAuth } from '../context/useAuth.js';
import { useProfile } from '../hooks/useProfile.js';

const studyLinks = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/trilha', label: 'Trilha de Estudos' },
  { to: '/questionario', label: 'Praticar' },
  { to: '/simulados', label: 'Simulados' },
  { to: '/revisao-erros', label: 'Revisão de Erros' },
];

const libraryLinks = [
  { to: '/questoes', label: 'Banco de Questões' },
  { to: '/provas', label: 'Provas' },
  { to: '/materiais', label: 'Materiais' },
];

const accountLinks = [
  { to: '/desempenho', label: 'Desempenho' },
  { to: '/perfil', label: 'Perfil' },
];

const adminLinks = [
  { to: '/importacao-automatica', label: 'Importação automática' },
  { to: '/importacoes', label: 'Histórico de Importações' },
  { to: '/revisao-questoes', label: 'Revisão' },
  { to: '/admin/questoes', label: 'Admin' },
];

export default function Navbar({ onNavigate }) {
  const { signOut, user } = useAuth();
  const { isAdmin, profile } = useProfile();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate('/login', { replace: true });
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <strong>IBGE Estudos</strong>
        <span>{profile?.full_name || user?.email}</span>
        {profile?.full_name ? <small>{user?.email}</small> : null}
      </div>
      <nav>
        <div className="nav-group">
          <span className="nav-group-title">Estudar</span>
          {studyLinks.map((link) => (
            <NavLink key={link.to} to={link.to} onClick={onNavigate}>
              {link.label}
            </NavLink>
          ))}
        </div>
        <div className="nav-group">
          <span className="nav-group-title">Biblioteca</span>
          {libraryLinks.map((link) => (
            <NavLink key={link.to} to={link.to} onClick={onNavigate}>
              {link.label}
            </NavLink>
          ))}
        </div>
        <div className="nav-group">
          <span className="nav-group-title">Conta</span>
          {accountLinks.map((link) => (
            <NavLink key={link.to} to={link.to} onClick={onNavigate}>
              {link.label}
            </NavLink>
          ))}
        </div>
        {isAdmin ? (
          <div className="nav-group">
            <span className="nav-group-title">Administração</span>
            {adminLinks.map((link) => (
              <NavLink key={link.to} to={link.to} onClick={onNavigate}>
                {link.label}
              </NavLink>
            ))}
          </div>
        ) : null}
      </nav>
      <div className="sidebar-footer">
        <ThemeToggle />
        <button className="ghost-button" type="button" onClick={handleSignOut}>
          Sair
        </button>
      </div>
    </aside>
  );
}
