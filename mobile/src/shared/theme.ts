export const lightColors = {
  background: '#F3F5FA',
  surface: '#FFFFFF',
  surfaceAlt: '#E8EDF8',
  border: '#CDD7EE',
  text: '#0B1020',
  muted: '#5E6A85',
  primary: '#146EF5',
  secondary: '#6D28D9',
  success: '#16A34A',
  warning: '#D97706',
  danger: '#DC2626',
};

export const darkColors = {
  background: '#0B1020',
  surface: '#121933',
  surfaceAlt: '#182347',
  border: '#24314D',
  text: '#F4F7FF',
  muted: '#94A3B8',
  primary: '#6EE7F9',
  secondary: '#8B5CF6',
  success: '#34D399',
  warning: '#FBBF24',
  danger: '#FB7185',
};

export type ThemeMode = 'light' | 'dark';
export type AppColors = typeof darkColors;

export function resolveColors(mode: ThemeMode): AppColors {
  return mode === 'light' ? lightColors : darkColors;
}

export const colors = darkColors;
