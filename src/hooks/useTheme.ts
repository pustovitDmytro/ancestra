import { useEffect, useState } from 'react';

const KEY = 'ancestra-theme';

export type Theme = 'light' | 'dark';

export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  const v = localStorage.getItem(KEY) as Theme | null;
  if (v === 'dark' || v === 'light') return v;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>(() => getStoredTheme());

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    localStorage.setItem(KEY, theme);
  }, [theme]);

  const setTheme = (t: Theme) => setThemeState(t);
  return [theme, setTheme];
}
