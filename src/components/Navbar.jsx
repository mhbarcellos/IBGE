import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth.js';
import { useProfile } from '../hooks/useProfile.js';

const links = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/provas', label: 'Provas' },
  { to: '/questoes', label: 'Banco de Questoes' },
  { to: '/questionario', label: 'Praticar' },
  { to: '/desempenho', label: 'Desempenho' },
  { to: '/materiais', label: 'Materiais' },
  { to: '/perfil', label: 'Perfil' },
];

const adminLinks = [
  { to: '/importacao-automatica', label: 'Importacao automatica' },
  { to: '/importacoes', label: 'Historico de Importacoes' },
  { to: '/importar-pdf', label: 'Importar PDF' },
  { to: '/revisao-questoes', label: 'Revisao' },
  { to: '/admin/questoes', label: 'Admin' },
];

export default function Navbar() {
  const { signOut, user } = useAuth();
  const { isAdmin } = useProfile();
  const navigate = useNavigate();
  const visibleLinks = isAdmin ? [...links, ...adminLinks] : links;

  async function handleSignOut() {
    await signOut();
    navigate('/login', { replace: true });
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <strong>IBGE Estudos</strong>
        <span>{user?.email}</span>
      </div>
      <nav>
        {visibleLinks.map((link) => (
          <NavLink key={link.to} to={link.to}>
            {link.label}
          </NavLink>
        ))}
      </nav>
      <button className="ghost-button" type="button" onClick={handleSignOut}>
        Sair
      </button>
    </aside>
  );
}
