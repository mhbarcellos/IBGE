import { useTheme } from '../hooks/useTheme.js';

function SunIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20">
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <path
        d="M12 2.75v2.1M12 19.15v2.1M4.85 4.85l1.48 1.48M17.67 17.67l1.48 1.48M2.75 12h2.1M19.15 12h2.1M4.85 19.15l1.48-1.48M17.67 6.33l1.48-1.48"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20">
      <path
        d="M20.1 14.2A7.6 7.6 0 0 1 9.8 3.9a8.4 8.4 0 1 0 10.3 10.3Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export default function ThemeToggle({ compact = false }) {
  const { isDark, toggleTheme } = useTheme();
  const nextLabel = isDark ? 'claro' : 'escuro';

  return (
    <button
      aria-label={`Alternar para modo ${nextLabel}`}
      className={`theme-toggle ${compact ? 'theme-toggle-compact' : ''}`}
      type="button"
      onClick={toggleTheme}
    >
      <span aria-hidden="true" className="theme-toggle__icon">
        {isDark ? <SunIcon /> : <MoonIcon />}
      </span>
      <span className="theme-toggle__label">{isDark ? 'Claro' : 'Escuro'}</span>
    </button>
  );
}
