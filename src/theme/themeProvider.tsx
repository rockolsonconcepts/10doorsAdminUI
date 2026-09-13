import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { DarkTheme, LightTheme, ThemeTokens } from './themeTokens';

type Mode = 'light' | 'dark';
const KEY = 'ten_doors_admin_theme';

interface ThemeContextValue {
  mode: Mode;
  tokens: ThemeTokens;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>(() => (localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light'));

  useEffect(() => {
    document.documentElement.classList.toggle('dark', mode === 'dark');
    localStorage.setItem(KEY, mode);
  }, [mode]);

  const value = useMemo(
    () => ({ mode, tokens: mode === 'dark' ? DarkTheme : LightTheme, toggle: () => setMode((m) => (m === 'dark' ? 'light' : 'dark')) }),
    [mode],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
