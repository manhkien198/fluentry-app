import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { useAppStore } from "../src/shared/store";

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

import { SettingsScreen } from "../src/features/settings/SettingsScreen";
import { saveThemeMode, saveLocale, saveHapticsEnabled } from "../src/shared/settingsStorage";

describe("SettingsScreen additional", () => {
  beforeEach(() => {
    useAppStore.setState({
      themeMode: "dark",
      locale: "en",
      hapticsEnabled: true,
      accessToken: "token",
      authStatus: "authenticated",
    } as any);
  });

  it("updates theme and locale", async () => {
    const navigation = { replace: jest.fn() } as any;
    const screen = render(<SettingsScreen navigation={navigation} route={{} as any} />);

    fireEvent.press(screen.getByText("Light"));
    fireEvent.press(screen.getByText("VI"));

    await waitFor(() => {
      expect(saveThemeMode).toHaveBeenCalledWith("light");
      expect(saveLocale).toHaveBeenCalledWith("vi");
    });
  });

  it("toggles haptics switch", async () => {
    const navigation = { replace: jest.fn() } as any;
    const screen = render(<SettingsScreen navigation={navigation} route={{} as any} />);

    fireEvent.press(screen.getByText("ON"));

    await waitFor(() => {
      expect(saveHapticsEnabled).toHaveBeenCalledWith(false);
    });
  });
});
