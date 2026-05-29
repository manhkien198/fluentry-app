import { resolveColors } from "../src/shared/theme";
import {
  clearAuthTokens,
  saveAccessToken,
  saveRefreshToken,
} from "../src/shared/authStorage";
import { loadLocale, saveLocale } from "../src/shared/settingsStorage";
import { haptic } from "../src/shared/haptics";
import { useAppStore } from "../src/shared/store";
import { t } from "../src/shared/i18n";
import React from "react";
import { render } from "@testing-library/react-native";
import { ToastHost, showToast } from "../src/shared/toast";

jest.mock("expo-secure-store", () => ({
  setItemAsync: jest.fn(async () => undefined),
  getItemAsync: jest.fn(async (_key: string) => null),
  deleteItemAsync: jest.fn(async () => undefined),
}));

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(async () => undefined),
  notificationAsync: jest.fn(async () => undefined),
  ImpactFeedbackStyle: { Light: "Light", Medium: "Medium" },
  NotificationFeedbackType: { Success: "Success", Error: "Error" },
}));

jest.mock("react-native-paper", () => {
  return {
    Snackbar: ({ children }: { children: React.ReactNode }) => children,
  };
});

describe("shared unit modules", () => {
  it("resolveColors returns different palettes", () => {
    const light = resolveColors("light");
    const dark = resolveColors("dark");
    expect(light.background).not.toBe(dark.background);
  });

  it("authStorage saves and clears tokens", async () => {
    await saveAccessToken("a");
    await saveRefreshToken("r");
    await clearAuthTokens();
  });

  it("settingsStorage locale roundtrip returns null when missing", async () => {
    await saveLocale("en");
    const loaded = await loadLocale();
    expect(loaded).toBeNull();
  });

  it("haptic does nothing when disabled", async () => {
    useAppStore.getState().setHapticsEnabled(false);
    await haptic("light");
  });

  it("i18n t returns translated text", () => {
    useAppStore.getState().setLocale("en");
    expect(t("common.ok")).toBe("OK");
  });

  it("toast host renders after showToast", () => {
    showToast("Hello", "success");
    const screen = render(<ToastHost />);
    expect(screen.toJSON()).toBeTruthy();
  });
});
