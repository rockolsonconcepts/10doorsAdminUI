export type ThemeTokens = {
  background: string; surface: string; surfaceAlt: string; cardBackground: string; inputBackground: string;
  border: string; primaryText: string; secondaryText: string; mutedText: string;
  success: string; warning: string; error: string; accent: string; accentDark: string;
};

export const LightTheme: ThemeTokens = {
  background: '#ffffff',
  surface: '#f8fafc',
  surfaceAlt: '#f1f5f9',
  cardBackground: '#ffffff',
  inputBackground: '#f8fafc',
  border: '#e2e8f0',
  primaryText: '#0f172a',
  secondaryText: '#475569',
  mutedText: '#94a3b8',
  success: '#059669',
  warning: '#D97706',
  error: '#DC2626',
  accent: '#1a56db',
  accentDark: '#1e40af',
};

export const DarkTheme: ThemeTokens = {
  background: '#0B0B0F',
  surface: '#16161D',
  surfaceAlt: '#1E1E2A',
  cardBackground: '#16161D',
  inputBackground: '#1E1E2A',
  border: 'rgba(249,250,251,0.12)',
  primaryText: '#F9FAFB',
  secondaryText: '#D1D5DB',
  mutedText: '#9CA3AF',
  success: '#10B981',
  warning: '#FBBF24',
  error: '#F87171',
  accent: '#3b82f6',
  accentDark: '#2563eb',
};
