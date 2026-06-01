import { resolveColors } from "../src/shared/theme";
import {
  clearAccessToken,
  clearAuthTokens,
  clearRefreshToken,
  loadRefreshToken,
  saveAccessToken,
  saveRefreshToken,
} from "../src/shared/authStorage";
import {
  loadHapticsEnabled,
  loadLocale,
  loadThemeMode,
  saveHapticsEnabled,
  saveLocale,
  saveThemeMode,
} from "../src/shared/settingsStorage";
import { loadAccessToken } from "../src/shared/authStorage";
import { haptic } from "../src/shared/haptics";
import { useAppStore } from "../src/shared/store";
import { t } from "../src/shared/i18n";
import { render, fireEvent, act, waitFor } from "@testing-library/react-native";
import { ToastHost, showToast } from "../src/shared/toast";
import * as SecureStore from "expo-secure-store";

jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    getItemAsync: jest.fn(async (key: string) => {
      return store.has(key) ? store.get(key)! : null;
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
    __dangerousReset: () => store.clear(),
  };
});

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(async () => undefined),
  notificationAsync: jest.fn(async () => undefined),
  ImpactFeedbackStyle: { Light: "Light", Medium: "Medium" },
  NotificationFeedbackType: { Success: "Success", Error: "Error" },
}));

jest.mock("react-native-paper", () => {
  const React = require("react");
  const { Text, View } = require("react-native");
  return {
    Snackbar: ({ children, action, onDismiss }: any) => (
      <View>
        <Text onPress={onDismiss}>dismiss</Text>
        <Text onPress={action?.onPress}>action</Text>
        <Text>{children}</Text>
      </View>
    ),
  };
});

describe("shared unit modules", () => {
  beforeEach(async () => {
    const secureStore = require("expo-secure-store");
    secureStore.__dangerousReset?.();
  });
  it("resolveColors returns different palettes", () => {
    const light = resolveColors("light");
    const dark = resolveColors("dark");
    expect(light.background).not.toBe(dark.background);
  });

  it("authStorage saves and clears tokens", async () => {
    await saveAccessToken("a");
    await saveRefreshToken("r");
    await expect(loadAccessToken()).resolves.toBe("a");
    await expect(loadRefreshToken()).resolves.toBe("r");

    await clearAccessToken();
    await expect(loadAccessToken()).resolves.toBeNull();

    await saveAccessToken("a2");
    await saveRefreshToken("r2");
    await clearRefreshToken();
    await expect(loadRefreshToken()).resolves.toBeNull();

    await clearAuthTokens();
    await expect(loadAccessToken()).resolves.toBeNull();
  });

  it("settingsStorage locale roundtrip returns null when missing", async () => {
    await saveLocale("en");
    const loaded = await loadLocale();
    expect(loaded).toBe("en");
  });

  it("settingsStorage handles haptics enabled", async () => {
    await saveHapticsEnabled(true);
    await expect(loadHapticsEnabled()).resolves.toBe(true);

    await saveHapticsEnabled(false);
    await expect(loadHapticsEnabled()).resolves.toBe(false);
  });

  it("settingsStorage returns null when missing", async () => {
    await expect(loadHapticsEnabled()).resolves.toBeNull();
  });

  it("settingsStorage returns null for invalid theme mode", async () => {
    const secureStore = require("expo-secure-store");
    await secureStore.setItemAsync("fluentry.settings.theme_mode", "weird");
    await expect(loadThemeMode()).resolves.toBeNull();
  });

  it("settingsStorage handles theme mode", async () => {
    await saveThemeMode("light");
    await expect(loadThemeMode()).resolves.toBe("light");
    await saveThemeMode("dark");
    await expect(loadThemeMode()).resolves.toBe("dark");
  });

  it("settingsStorage returns null for invalid persisted values", async () => {
    await SecureStore.setItemAsync("fluentry.settings.theme_mode", "weird");
    await expect(loadThemeMode()).resolves.toBeNull();
    await SecureStore.setItemAsync("fluentry.settings.locale", "fr");
    await expect(loadLocale()).resolves.toBeNull();
  });

  it("haptic does nothing when disabled", async () => {
    useAppStore.getState().setHapticsEnabled(false);
    await haptic("light");
  });

  it("i18n t returns translated text", () => {
    useAppStore.getState().setLocale("en");
    expect(t("common.ok")).toBe("OK");
  });

  it("toast host renders and dismisses", async () => {
    const screen = render(<ToastHost />);

    await act(async () => {
      showToast("Hello", "success");
    });
    expect(screen.getByText("Hello")).toBeTruthy();

    fireEvent.press(screen.getByText("dismiss"));

    await act(async () => {
      showToast("Oops", "error");
    });
    await waitFor(() => expect(screen.getByText("Oops")).toBeTruthy());

    fireEvent.press(screen.getByText("action"));
    expect(screen.toJSON()).toBeTruthy();
  });

  it("toast defaults to info kind when omitted", async () => {
    const screen = render(<ToastHost />);
    await act(async () => {
      showToast("Info only");
    });
    expect(screen.getByText("Info only")).toBeTruthy();
  });
});
