export const lightColors = {
  background: "#F3F5FA",
  surface: "#FFFFFF",
  surfaceAlt: "#E8EDF8",
  border: "#CDD7EE",
  text: "#0B1020",
  muted: "#5E6A85",
  primary: "#146EF5",
  secondary: "#6D28D9",
  success: "#16A34A",
  warning: "#D97706",
  danger: "#DC2626",
};

export const darkColors = {
  background: "#0B1020",
  surface: "#121933",
  surfaceAlt: "#182347",
  border: "#24314D",
  text: "#F4F7FF",
  muted: "#94A3B8",
  primary: "#6EE7F9",
  secondary: "#8B5CF6",
  success: "#34D399",
  warning: "#FBBF24",
  danger: "#FB7185",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  full: 999,
};

export const typography = {
  display: { fontSize: 34, lineHeight: 42, fontWeight: "800" as const },
  title: { fontSize: 26, lineHeight: 34, fontWeight: "800" as const },
  subtitle: { fontSize: 18, lineHeight: 24, fontWeight: "700" as const },
  body: { fontSize: 15, lineHeight: 22, fontWeight: "400" as const },
  caption: { fontSize: 12, lineHeight: 18, fontWeight: "600" as const },
  label: { fontSize: 13, lineHeight: 18, fontWeight: "700" as const },
};

export const motion = {
  fast: 180,
  normal: 240,
  slow: 320,
  pressInScale: 0.985,
  springSpeed: 40,
  springBounciness: 6,
  skeleton: 900,
  toast: 2400,
};

export type ThemeMode = "light" | "dark";
export type AppColors = typeof darkColors;

export function resolveColors(mode: ThemeMode): AppColors {
  return mode === "light" ? lightColors : darkColors;
}

export const colors = darkColors;
