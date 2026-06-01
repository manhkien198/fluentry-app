import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";

jest.mock("expo-web-browser", () => ({
  maybeCompleteAuthSession: jest.fn(),
}));

jest.mock("expo-auth-session/providers/google", () => ({
  useAuthRequest: jest.fn(() => [{}, null, jest.fn(async () => ({ type: "dismiss" }))]),
}));

jest.mock("expo-apple-authentication", () => ({
  isAvailableAsync: jest.fn(async () => false),
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: "FULL_NAME", EMAIL: "EMAIL" },
}));

jest.mock("../src/shared/config", () => ({
  appConfig: {
    googleWebClientId: "",
    googleExpoClientId: "",
  },
}));

jest.mock("../src/shared/authStorage", () => ({
  saveAccessToken: jest.fn(async () => undefined),
  saveRefreshToken: jest.fn(async () => undefined),
}));

jest.mock("../src/shared/api", () => ({
  loginWithEmail: jest.fn(),
  registerWithEmail: jest.fn(),
  verifyEmail: jest.fn(),
  resendVerification: jest.fn(),
  requestPasswordReset: jest.fn(),
  confirmPasswordReset: jest.fn(),
  loginWithSSO: jest.fn(),
  getErrorMessage: jest.fn((e: any) => e?.message || "error"),
}));

import { Alert, Platform, TextInput } from "react-native";
import { useAppStore } from "../src/shared/store";
import { AuthScreen } from "../src/features/auth/AuthScreen";
import {
  loginWithEmail,
  registerWithEmail,
  verifyEmail,
  resendVerification,
  requestPasswordReset,
  confirmPasswordReset,
  loginWithSSO,
  getErrorMessage,
} from "../src/shared/api";
import * as Google from "expo-auth-session/providers/google";
import * as AppleAuthentication from "expo-apple-authentication";
import { appConfig } from "../src/shared/config";

describe("AuthScreen", () => {
  const setAlert = () =>
    jest.spyOn(Alert, "alert").mockImplementation(() => {});

  beforeEach(() => {
    jest.clearAllMocks();
    useAppStore.setState({ accessToken: null } as any);
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
    (Google.useAuthRequest as jest.Mock).mockReturnValue([
      {},
      null,
      jest.fn(async () => ({ type: "dismiss" })),
    ]);
    (AppleAuthentication.isAvailableAsync as jest.Mock).mockResolvedValue(false);
  });

  it("shows validation alert for invalid email", () => {
    const navigation = { replace: jest.fn() } as any;
    const screen = render(<AuthScreen navigation={navigation} route={{} as any} />);

    const inputs = screen.UNSAFE_getAllByType(TextInput);
    fireEvent.changeText(inputs[0], "bad");
    fireEvent.changeText(inputs[1], "12345678");
    fireEvent.press(screen.getAllByText("Sign in")[1]);

    expect(Alert.alert).toHaveBeenCalled();
  });

  it("shows validation alert for short password", () => {
    const navigation = { replace: jest.fn() } as any;
    const screen = render(<AuthScreen navigation={navigation} route={{} as any} />);

    const inputs = screen.UNSAFE_getAllByType(TextInput);
    fireEvent.changeText(inputs[0], "user@example.com");
    fireEvent.changeText(inputs[1], "123");
    fireEvent.press(screen.getAllByText("Sign in")[1]);

    expect(Alert.alert).toHaveBeenCalled();
  });

  it("shows validation alerts for signup missing full name and password mismatch", () => {
    const navigation = { replace: jest.fn() } as any;
    const screen = render(<AuthScreen navigation={navigation} route={{} as any} />);

    fireEvent.press(screen.getByText("Sign up"));
    let inputs = screen.UNSAFE_getAllByType(TextInput);
    fireEvent.changeText(inputs[0], "");
    fireEvent.changeText(inputs[1], "user@example.com");
    fireEvent.changeText(inputs[2], "secret123");
    fireEvent.changeText(inputs[3], "secret123");
    fireEvent.press(screen.getAllByText("Sign up")[1]);
    expect(Alert.alert).toHaveBeenCalled();

    inputs = screen.UNSAFE_getAllByType(TextInput);
    fireEvent.changeText(inputs[0], "Test User");
    fireEvent.changeText(inputs[1], "user@example.com");
    fireEvent.changeText(inputs[2], "secret123");
    fireEvent.changeText(inputs[3], "mismatch123");
    fireEvent.press(screen.getAllByText("Sign up")[1]);
    expect(Alert.alert).toHaveBeenCalled();
  });

  it("signs in and navigates home", async () => {
    (loginWithEmail as jest.Mock).mockResolvedValue({
      access_token: "token-a",
      refresh_token: "token-r",
    });

    const navigation = { replace: jest.fn() } as any;
    const screen = render(<AuthScreen navigation={navigation} route={{} as any} />);

    const inputs = screen.UNSAFE_getAllByType(TextInput);
    fireEvent.changeText(inputs[0], "user@example.com");
    fireEvent.changeText(inputs[1], "secret123");
    fireEvent.press(screen.getAllByText("Sign in")[1]);

    await waitFor(() => {
      expect(loginWithEmail).toHaveBeenCalled();
      expect(navigation.replace).toHaveBeenCalledWith("Home");
    });
  });

  it("handles signup then verify step", async () => {
    (registerWithEmail as jest.Mock).mockResolvedValue({ verificationToken: "abc-123" });

    const navigation = { replace: jest.fn() } as any;
    const screen = render(<AuthScreen navigation={navigation} route={{} as any} />);

    fireEvent.press(screen.getByText("Sign up"));
    const inputs = screen.UNSAFE_getAllByType(TextInput);
    fireEvent.changeText(inputs[0], "Test User");
    fireEvent.changeText(inputs[1], "new@example.com");
    fireEvent.changeText(inputs[2], "secret123");
    fireEvent.changeText(inputs[3], "secret123");
    fireEvent.press(screen.getAllByText("Sign up")[1]);

    await waitFor(() => {
      expect(registerWithEmail).toHaveBeenCalled();
      expect(screen.getByText("Verify email")).toBeTruthy();
    });
  });

  it("resends verification token", async () => {
    (registerWithEmail as jest.Mock).mockResolvedValue({ verificationToken: "abc-123" });
    (resendVerification as jest.Mock).mockResolvedValue({ token: "new-token" });

    const navigation = { replace: jest.fn() } as any;
    const screen = render(<AuthScreen navigation={navigation} route={{} as any} />);

    fireEvent.press(screen.getByText("Sign up"));
    const inputs = screen.UNSAFE_getAllByType(TextInput);
    fireEvent.changeText(inputs[0], "Test User");
    fireEvent.changeText(inputs[1], "new@example.com");
    fireEvent.changeText(inputs[2], "secret123");
    fireEvent.changeText(inputs[3], "secret123");
    fireEvent.press(screen.getAllByText("Sign up")[1]);

    await waitFor(() => expect(screen.getByText("Resend verification")));
    fireEvent.press(screen.getByText("Resend verification"));

    await waitFor(() => expect(resendVerification).toHaveBeenCalled());
  });

  it("verifies email then logs in", async () => {
    (registerWithEmail as jest.Mock).mockResolvedValue({ verificationToken: "abc-123" });
    (verifyEmail as jest.Mock).mockResolvedValue({ status: "verified" });
    (loginWithEmail as jest.Mock).mockResolvedValue({
      access_token: "token-a",
      refresh_token: "token-r",
    });

    const navigation = { replace: jest.fn() } as any;
    const screen = render(<AuthScreen navigation={navigation} route={{} as any} />);

    fireEvent.press(screen.getByText("Sign up"));
    const inputs = screen.UNSAFE_getAllByType(TextInput);
    fireEvent.changeText(inputs[0], "Test User");
    fireEvent.changeText(inputs[1], "new@example.com");
    fireEvent.changeText(inputs[2], "secret123");
    fireEvent.changeText(inputs[3], "secret123");
    fireEvent.press(screen.getAllByText("Sign up")[1]);

    await waitFor(() => expect(screen.getByText("Verify email")));
    const verifyInputs = screen.UNSAFE_getAllByType(TextInput);
    fireEvent.changeText(verifyInputs[0], "abc-123");
    fireEvent.press(screen.getByText("Verify email"));

    await waitFor(() => {
      expect(verifyEmail).toHaveBeenCalledWith("abc-123");
      expect(loginWithEmail).toHaveBeenCalled();
      expect(navigation.replace).toHaveBeenCalledWith("Home");
    });
  });

  it("shows alert when verify token empty", async () => {
    (registerWithEmail as jest.Mock).mockResolvedValue({ verificationToken: "abc-123" });

    const navigation = { replace: jest.fn() } as any;
    const screen = render(<AuthScreen navigation={navigation} route={{} as any} />);

    fireEvent.press(screen.getByText("Sign up"));
    const inputs = screen.UNSAFE_getAllByType(TextInput);
    fireEvent.changeText(inputs[0], "Test User");
    fireEvent.changeText(inputs[1], "new@example.com");
    fireEvent.changeText(inputs[2], "secret123");
    fireEvent.changeText(inputs[3], "secret123");
    fireEvent.press(screen.getAllByText("Sign up")[1]);

    await waitFor(() => expect(screen.getByText("Verify email")));
    fireEvent.changeText(screen.UNSAFE_getAllByType(TextInput)[0], "");
    fireEvent.press(screen.getByText("Verify email"));

    expect(Alert.alert).toHaveBeenCalled();
  });

  it("handles verify and resend failures", async () => {
    (registerWithEmail as jest.Mock).mockResolvedValue({ verificationToken: "abc-123" });
    (verifyEmail as jest.Mock).mockRejectedValue(new Error("bad token"));
    (resendVerification as jest.Mock).mockRejectedValue(new Error("resend failed"));

    const navigation = { replace: jest.fn() } as any;
    const screen = render(<AuthScreen navigation={navigation} route={{} as any} />);

    fireEvent.press(screen.getByText("Sign up"));
    const inputs = screen.UNSAFE_getAllByType(TextInput);
    fireEvent.changeText(inputs[0], "Test User");
    fireEvent.changeText(inputs[1], "new@example.com");
    fireEvent.changeText(inputs[2], "secret123");
    fireEvent.changeText(inputs[3], "secret123");
    fireEvent.press(screen.getAllByText("Sign up")[1]);

    await waitFor(() => expect(screen.getByText("Verify email")));
    fireEvent.changeText(screen.UNSAFE_getAllByType(TextInput)[0], "abc-123");
    fireEvent.press(screen.getByText("Verify email"));
    await waitFor(() => expect(Alert.alert).toHaveBeenCalled());

    fireEvent.press(screen.getByText("Resend verification"));
    await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
  });

  it("handles password reset request and confirm flows", async () => {
    (requestPasswordReset as jest.Mock).mockResolvedValue({ status: "sent" });
    (confirmPasswordReset as jest.Mock).mockResolvedValue({ status: "ok" });

    const navigation = { replace: jest.fn() } as any;
    const screen = render(<AuthScreen navigation={navigation} route={{} as any} />);

    fireEvent.press(screen.getByText("Forgot password"));
    expect(Alert.alert).toHaveBeenCalled();

    const inputs = screen.UNSAFE_getAllByType(TextInput);
    fireEvent.changeText(inputs[0], "user@example.com");
    fireEvent.changeText(inputs[1], "secret123");

    fireEvent.press(screen.getByText("Forgot password"));
    await waitFor(() => expect(requestPasswordReset).toHaveBeenCalledWith("user@example.com"));

    await waitFor(() => expect(screen.getByText("Confirm reset")));
    const resetInputs = screen.UNSAFE_getAllByType(TextInput);
    const tokenInput = resetInputs[resetInputs.length - 2];
    const newPasswordInput = resetInputs[resetInputs.length - 1];
    fireEvent.changeText(tokenInput, "reset-token");
    fireEvent.changeText(newPasswordInput, "new-secret-123");
    fireEvent.press(screen.getByText("Confirm reset"));

    await waitFor(() => {
      expect(confirmPasswordReset).toHaveBeenCalledWith({ token: "reset-token", new_password: "new-secret-123" });
    });
  });

  it("handles email auth failure branch", async () => {
    (loginWithEmail as jest.Mock).mockRejectedValue(new Error("auth failed"));
    const navigation = { replace: jest.fn() } as any;
    const screen = render(<AuthScreen navigation={navigation} route={{} as any} />);

    const inputs = screen.UNSAFE_getAllByType(TextInput);
    fireEvent.changeText(inputs[0], "user@example.com");
    fireEvent.changeText(inputs[1], "secret123");
    fireEvent.press(screen.getAllByText("Sign in")[1]);

    await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
  });

  it("handles google disabled and missing token branches", async () => {
    const navigation = { replace: jest.fn() } as any;

    (appConfig as any).googleWebClientId = "";
    (appConfig as any).googleExpoClientId = "";
    let screen = render(<AuthScreen navigation={navigation} route={{} as any} />);
    fireEvent.press(screen.getByText("Sign in with Google"));
    expect(Alert.alert).toHaveBeenCalled();

    (appConfig as any).googleWebClientId = "x";
    (Google.useAuthRequest as jest.Mock).mockReturnValue([
      {},
      null,
      jest.fn(async () => ({ type: "success", authentication: {} })),
    ]);

    screen.unmount();
    screen = render(<AuthScreen navigation={navigation} route={{} as any} />);
    fireEvent.press(screen.getByText("Sign in with Google"));
    await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
  });

  it("handles google and apple success flows", async () => {
    const navigation = { replace: jest.fn() } as any;
    (appConfig as any).googleWebClientId = "x";
    (Google.useAuthRequest as jest.Mock).mockReturnValue([
      {},
      null,
      jest.fn(async () => ({ type: "success", authentication: { idToken: "gid" } })),
    ]);
    (loginWithSSO as jest.Mock).mockResolvedValue({ access_token: "a", refresh_token: "r" });
    (AppleAuthentication.isAvailableAsync as jest.Mock).mockResolvedValue(true);
    (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue({ identityToken: "aid" });

    const screen = render(<AuthScreen navigation={navigation} route={{} as any} />);
    fireEvent.press(screen.getByText("Sign in with Google"));
    await waitFor(() => expect(loginWithSSO).toHaveBeenCalledWith("google", "gid"));

    fireEvent.press(screen.getByText("Sign in with Apple"));
    await waitFor(() => expect(loginWithSSO).toHaveBeenCalledWith("apple", "aid"));
  });

  it("handles google token extraction from accessToken and params.id_token", async () => {
    const navigation = { replace: jest.fn() } as any;
    (appConfig as any).googleWebClientId = "x";
    (loginWithSSO as jest.Mock).mockResolvedValue({ access_token: "a", refresh_token: "r" });

    (Google.useAuthRequest as jest.Mock).mockReturnValueOnce([
      {},
      null,
      jest.fn(async () => ({ type: "success", authentication: { accessToken: "g-access" } })),
    ]);
    let screen = render(<AuthScreen navigation={navigation} route={{} as any} />);
    fireEvent.press(screen.getByText("Sign in with Google"));
    await waitFor(() => expect(loginWithSSO).toHaveBeenCalledWith("google", "g-access"));

    screen.unmount();
    (Google.useAuthRequest as jest.Mock).mockReturnValueOnce([
      {},
      null,
      jest.fn(async () => ({ type: "success", params: { id_token: "g-param-token" } })),
    ]);
    screen = render(<AuthScreen navigation={navigation} route={{} as any} />);
    fireEvent.press(screen.getByText("Sign in with Google"));
    await waitFor(() => expect(loginWithSSO).toHaveBeenCalledWith("google", "g-param-token"));
  });

  it("handles apple disabled press branch repeatedly", async () => {
    const alertSpy = setAlert();
    const navigation = { replace: jest.fn() } as any;
    (AppleAuthentication.isAvailableAsync as jest.Mock).mockResolvedValue(false);

    const screen = render(<AuthScreen navigation={navigation} route={{} as any} />);
    fireEvent.press(screen.getByText("Apple (disabled)"));
    fireEvent.press(screen.getByText("Apple (disabled)"));

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
  });

  it("handles google prompt failure branch", async () => {
    const alertSpy = setAlert();
    const navigation = { replace: jest.fn() } as any;
    (appConfig as any).googleWebClientId = "x";
    (Google.useAuthRequest as jest.Mock).mockReturnValue([
      {},
      null,
      jest.fn(async () => {
        throw new Error("google failed");
      }),
    ]);

    const screen = render(<AuthScreen navigation={navigation} route={{} as any} />);
    fireEvent.press(screen.getByText("Sign in with Google"));
    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
  });


  it("handles apple unavailable branch", async () => {
    const alertSpy = setAlert();
    (AppleAuthentication.isAvailableAsync as jest.Mock).mockResolvedValue(false);
    const navigation = { replace: jest.fn() } as any;

    const screen = render(<AuthScreen navigation={navigation} route={{} as any} />);
    await waitFor(() => {
      expect(screen.getByText("Apple (disabled)")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("Apple (disabled)"));
    expect(alertSpy).toHaveBeenCalled();
  });

  it("handles request and confirm reset failures", async () => {
    const alertSpy = setAlert();
    (requestPasswordReset as jest.Mock).mockRejectedValue(new Error("reset request failed"));
    (confirmPasswordReset as jest.Mock).mockRejectedValue(new Error("confirm failed"));

    const navigation = { replace: jest.fn() } as any;
    const screen = render(<AuthScreen navigation={navigation} route={{} as any} />);

    const inputs = screen.UNSAFE_getAllByType(TextInput);
    fireEvent.changeText(inputs[0], "user@example.com");
    fireEvent.changeText(inputs[1], "secret123");

    fireEvent.press(screen.getByText("Forgot password"));
    await waitFor(() => expect(alertSpy).toHaveBeenCalled());

    (requestPasswordReset as jest.Mock).mockResolvedValueOnce({ status: "sent" });
    fireEvent.press(screen.getByText("Forgot password"));
    await waitFor(() => expect(screen.getByText("Confirm reset")).toBeTruthy());

    const resetInputs = screen.UNSAFE_getAllByType(TextInput);
    fireEvent.changeText(resetInputs[resetInputs.length - 2], "r-token");
    fireEvent.changeText(resetInputs[resetInputs.length - 1], "new-secret");
    fireEvent.press(screen.getByText("Confirm reset"));

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
  });

  it("handles apple ios-only, missing token and sign-in errors", async () => {
    const alertSpy = setAlert();
    const navigation = { replace: jest.fn() } as any;
    const originalOS = Platform.OS;

    Object.defineProperty(Platform, "OS", { value: "android" });
    let screen = render(<AuthScreen navigation={navigation} route={{} as any} />);
    fireEvent.press(screen.getByText("Apple (disabled)"));
    expect(alertSpy).toHaveBeenCalled();

    screen.unmount();
    Object.defineProperty(Platform, "OS", { value: "ios" });
    (AppleAuthentication.isAvailableAsync as jest.Mock).mockResolvedValue(true);
    (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue({ identityToken: null });
    screen = render(<AuthScreen navigation={navigation} route={{} as any} />);
    await waitFor(() => expect(screen.getByText("Sign in with Apple")).toBeTruthy());
    fireEvent.press(screen.getByText("Sign in with Apple"));
    await waitFor(() => expect(alertSpy).toHaveBeenCalled());

    (AppleAuthentication.signInAsync as jest.Mock).mockRejectedValueOnce(new Error("apple failed"));
    fireEvent.press(screen.getByText("Sign in with Apple"));
    await waitFor(() => expect(alertSpy).toHaveBeenCalled());

    (AppleAuthentication.signInAsync as jest.Mock).mockRejectedValueOnce({ code: "ERR_REQUEST_CANCELED" });
    fireEvent.press(screen.getByText("Sign in with Apple"));
    await waitFor(() => expect(loginWithSSO).toHaveBeenCalledTimes(0));

    Object.defineProperty(Platform, "OS", { value: originalOS });
  });

  it("handles apple availability check failure and reset validation back flow", async () => {
    const alertSpy = setAlert();
    const navigation = { replace: jest.fn() } as any;
    const originalOS = Platform.OS;
    Object.defineProperty(Platform, "OS", { value: "ios" });
    (AppleAuthentication.isAvailableAsync as jest.Mock).mockRejectedValueOnce(new Error("unavailable"));

    const screen = render(<AuthScreen navigation={navigation} route={{} as any} />);
    await waitFor(() => expect(screen.getByText("Apple (disabled)")).toBeTruthy());

    const inputs = screen.UNSAFE_getAllByType(TextInput);
    fireEvent.changeText(inputs[0], "user@example.com");
    fireEvent.changeText(inputs[1], "secret123");
    (requestPasswordReset as jest.Mock).mockResolvedValueOnce({ status: "sent" });
    fireEvent.press(screen.getByText("Forgot password"));

    await waitFor(() => expect(screen.getByText("Confirm reset")).toBeTruthy());
    fireEvent.press(screen.getByText("Confirm reset"));
    expect(alertSpy).toHaveBeenCalled();

    fireEvent.press(screen.getByText("Back to sign in"));
    await waitFor(() => expect(screen.queryByText("Confirm reset")).toBeNull());

    Object.defineProperty(Platform, "OS", { value: originalOS });
  });

  it("covers auth fallback messages when getErrorMessage is empty", async () => {
    const alertSpy = setAlert();
    (getErrorMessage as jest.Mock).mockReturnValue("");
    const navigation = { replace: jest.fn() } as any;

    (loginWithEmail as jest.Mock).mockRejectedValueOnce(new Error("signin fail"));
    let screen = render(<AuthScreen navigation={navigation} route={{} as any} />);
    let inputs = screen.UNSAFE_getAllByType(TextInput);
    fireEvent.changeText(inputs[0], "user@example.com");
    fireEvent.changeText(inputs[1], "secret123");
    fireEvent.press(screen.getAllByText("Sign in")[1]);

    screen.unmount();
    (appConfig as any).googleWebClientId = "x";
    (Google.useAuthRequest as jest.Mock).mockReturnValueOnce([
      {},
      null,
      jest.fn(async () => {
        throw new Error("google fail");
      }),
    ]);
    screen = render(<AuthScreen navigation={navigation} route={{} as any} />);
    fireEvent.press(screen.getByText("Sign in with Google"));

    screen.unmount();
    (registerWithEmail as jest.Mock).mockResolvedValueOnce({ verificationToken: "abc-123" });
    (verifyEmail as jest.Mock).mockRejectedValueOnce(new Error("verify fail"));
    screen = render(<AuthScreen navigation={navigation} route={{} as any} />);
    fireEvent.press(screen.getByText("Sign up"));
    inputs = screen.UNSAFE_getAllByType(TextInput);
    fireEvent.changeText(inputs[0], "Test User");
    fireEvent.changeText(inputs[1], "new@example.com");
    fireEvent.changeText(inputs[2], "secret123");
    fireEvent.changeText(inputs[3], "secret123");
    fireEvent.press(screen.getAllByText("Sign up")[1]);
    await waitFor(() => expect(screen.getByText("Verify email")).toBeTruthy());
    fireEvent.changeText(screen.UNSAFE_getAllByType(TextInput)[0], "abc-123");
    fireEvent.press(screen.getByText("Verify email"));

    screen.unmount();
    (requestPasswordReset as jest.Mock).mockRejectedValueOnce(new Error("reset fail"));
    screen = render(<AuthScreen navigation={navigation} route={{} as any} />);
    inputs = screen.UNSAFE_getAllByType(TextInput);
    fireEvent.changeText(inputs[0], "user@example.com");
    fireEvent.changeText(inputs[1], "secret123");
    fireEvent.press(screen.getByText("Forgot password"));

    screen.unmount();
    (requestPasswordReset as jest.Mock).mockResolvedValueOnce({ status: "sent" });
    (confirmPasswordReset as jest.Mock).mockRejectedValueOnce(new Error("confirm fail"));
    screen = render(<AuthScreen navigation={navigation} route={{} as any} />);
    inputs = screen.UNSAFE_getAllByType(TextInput);
    fireEvent.changeText(inputs[0], "user@example.com");
    fireEvent.changeText(inputs[1], "secret123");
    fireEvent.press(screen.getByText("Forgot password"));
    await waitFor(() => expect(screen.getByText("Confirm reset")).toBeTruthy());
    const resetInputs = screen.UNSAFE_getAllByType(TextInput);
    fireEvent.changeText(resetInputs[resetInputs.length - 2], "token");
    fireEvent.changeText(resetInputs[resetInputs.length - 1], "new-secret");
    fireEvent.press(screen.getByText("Confirm reset"));

    screen.unmount();
    (registerWithEmail as jest.Mock).mockResolvedValueOnce({ verificationToken: "abc-123" });
    (resendVerification as jest.Mock).mockRejectedValueOnce(new Error("resend fail"));
    screen = render(<AuthScreen navigation={navigation} route={{} as any} />);
    fireEvent.press(screen.getByText("Sign up"));
    inputs = screen.UNSAFE_getAllByType(TextInput);
    fireEvent.changeText(inputs[0], "Test User");
    fireEvent.changeText(inputs[1], "new@example.com");
    fireEvent.changeText(inputs[2], "secret123");
    fireEvent.changeText(inputs[3], "secret123");
    fireEvent.press(screen.getAllByText("Sign up")[1]);
    await waitFor(() => expect(screen.getByText("Resend verification")).toBeTruthy());
    fireEvent.press(screen.getByText("Resend verification"));

    await waitFor(() => {
      const calls = alertSpy.mock.calls.map((args) => [String(args[0]), String(args[1])]);
      expect(calls).toEqual(expect.arrayContaining([
        ["Auth failed", "Unable to authenticate."],
        ["Auth failed", "Google sign-in failed."],
        ["Verify failed", "Verification failed."],
        ["Reset failed", "Unable to request password reset."],
        ["Reset failed", "Unable to reset password."],
        ["Resend failed", "Unable to resend verification."],
      ]));
    });
  });
});
