import { useEffect, useState } from 'react';

const storageKey = 'ibge_theme';
const themeEvent = 'ibge-theme-change';
const themes = ['light', 'dark'];

function getPreferredTheme() {
  if (typeof window === 'undefined') return 'light';
  const stored = window.localStorage.getItem(storageKey);
  if (themes.includes(stored)) return stored;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
}

export function useTheme() {
  const [theme, setThemeState] = useState(getPreferredTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    function handleThemeEvent(event) {
      if (themes.includes(event.detail)) setThemeState(event.detail);
    }

    window.addEventListener(themeEvent, handleThemeEvent);
    return () => window.removeEventListener(themeEvent, handleThemeEvent);
  }, []);

  function setTheme(nextTheme) {
    if (!themes.includes(nextTheme)) return;
    window.localStorage.setItem(storageKey, nextTheme);
    window.dispatchEvent(new CustomEvent(themeEvent, { detail: nextTheme }));
    setThemeState(nextTheme);
  }

  function toggleTheme() {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }

  return {
    theme,
    setTheme,
    toggleTheme,
    isDark: theme === 'dark',
  };
}
