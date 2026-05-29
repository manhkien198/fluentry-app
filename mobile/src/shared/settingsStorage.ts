import * as SecureStore from "expo-secure-store";

const HAPTICS_ENABLED_KEY = "fluentry.settings.haptics_enabled";
const THEME_MODE_KEY = "fluentry.settings.theme_mode";
const LOCALE_KEY = "fluentry.settings.locale";

export async function saveHapticsEnabled(enabled: boolean) {
  await SecureStore.setItemAsync(
    HAPTICS_ENABLED_KEY,
    enabled ? "true" : "false",
  );
}

export async function loadHapticsEnabled() {
  const value = await SecureStore.getItemAsync(HAPTICS_ENABLED_KEY);
  if (value === null) return null;
  return value === "true";
}

export type PersistedThemeMode = "light" | "dark";

export async function saveThemeMode(mode: PersistedThemeMode) {
  await SecureStore.setItemAsync(THEME_MODE_KEY, mode);
}

export async function loadThemeMode() {
  const value = await SecureStore.getItemAsync(THEME_MODE_KEY);
  if (value === "light" || value === "dark") return value;
  return null;
}

export type PersistedLocale = "en" | "vi";

export async function saveLocale(locale: PersistedLocale) {
  await SecureStore.setItemAsync(LOCALE_KEY, locale);
}

export async function loadLocale() {
  const value = await SecureStore.getItemAsync(LOCALE_KEY);
  if (value === "en" || value === "vi") return value;
  return null;
}
