import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { useAppStore } from "../src/shared/store";
import { saveThemeMode, saveLocale, saveHapticsEnabled } from "../src/shared/settingsStorage";
import { appConfig } from "../src/shared/config";

jest.mock("../src/shared/settingsStorage", () => ({
  saveThemeMode: jest.fn(async () => undefined),
  saveLocale: jest.fn(async () => undefined),
  saveHapticsEnabled: jest.fn(async () => undefined),
}));

jest.mock("../src/shared/authStorage", () => ({
  clearAuthTokens: jest.fn(async () => undefined),
}));

jest.mock("../src/shared/toast", () => ({
  showToast: jest.fn(),
}));

jest.mock("../src/shared/haptics", () => ({
  haptic: jest.fn(async () => undefined),
}));

jest.mock("../src/shared/useAppColors", () => ({
  useAppColors: () => ({
    text: "#fff",
    muted: "#aaa",
    surfaceAlt: "#111",
    danger: "#f00",
  }),
}));

describe("SettingsScreen", () => {
  beforeEach(() => {
    useAppStore.setState({
      themeMode: "dark",
      locale: "en",
      hapticsEnabled: true,
      accessToken: "token",
      authStatus: "authenticated",
    } as any);
  });

  it("updates theme, language and haptics", async () => {
    const { SettingsScreen } = require("../src/features/settings/SettingsScreen");
    const navigation = { replace: jest.fn() };
    const screen = render(<SettingsScreen navigation={navigation} />);

    fireEvent.press(screen.getByText("Light"));
    await waitFor(() => expect(saveThemeMode).toHaveBeenCalledWith("light"));

    fireEvent.press(screen.getByText("VI"));
    await waitFor(() => expect(saveLocale).toHaveBeenCalledWith("vi"));

    fireEvent.press(screen.getByText("ON"));
    await waitFor(() => expect(saveHapticsEnabled).toHaveBeenCalledWith(false));
  });

  it("renders api/sso config branches", () => {
    const { SettingsScreen } = require("../src/features/settings/SettingsScreen");
    const navigation = { replace: jest.fn() };

    (appConfig as any).googleWebClientId = "";
    (appConfig as any).googleExpoClientId = "";
    (appConfig as any).appleServiceId = "";
    let screen = render(<SettingsScreen navigation={navigation} />);
    expect(screen.getByText(/Google configured: No/i)).toBeTruthy();
    expect(screen.getByText(/Apple service id: Missing/i)).toBeTruthy();

    screen.unmount();
    (appConfig as any).googleWebClientId = "web-id";
    (appConfig as any).appleServiceId = "apple-id";
    screen = render(<SettingsScreen navigation={navigation} />);
    expect(screen.getByText(/Google configured: Yes/i)).toBeTruthy();
    expect(screen.getByText(/Apple service id: Set/i)).toBeTruthy();
  });

  it("signs out and navigates to Auth", async () => {
    const { SettingsScreen } = require("../src/features/settings/SettingsScreen");
    const navigation = { replace: jest.fn() };

    const screen = render(<SettingsScreen navigation={navigation} />);
    fireEvent.press(screen.getByText("Sign out"));

    await waitFor(() => {
      expect(navigation.replace).toHaveBeenCalledWith("Auth");
    });
    expect(useAppStore.getState().authStatus).toBe("expired");
  });
});
