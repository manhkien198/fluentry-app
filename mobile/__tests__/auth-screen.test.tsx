import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";

jest.mock("expo-web-browser", () => ({
  maybeCompleteAuthSession: jest.fn(),
}));

jest.mock("expo-auth-session/providers/google", () => ({
  useAuthRequest: jest.fn(() => [{}, null, jest.fn(async () => ({ type: "dismiss" }))]),
}));

jest.mock("../src/shared/config", () => ({
  appConfig: {
    apiBaseUrl: "https://api.test.local",
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
  requestPasswordReset: jest.fn(),
  confirmPasswordReset: jest.fn(),
  loginWithSSO: jest.fn(),
  getErrorMessage: jest.fn((e: any) =>
    e?.response?.data?.detail || e?.response?.data?.message || e?.message || "error",
  ),
  classifyNetworkIssue: jest.fn((e: any) => {
    if (e?.code === "ECONNABORTED") return "timeout";
    if (e?.response?.status >= 500) return "server";
    if (e?.isAxiosError && !e?.response) return "offline";
    return "unknown";
  }),
}));

import { TextInput } from "react-native";
import { useAppStore } from "../src/shared/store";
import { AuthScreen } from "../src/features/auth/AuthScreen";
import {
  loginWithEmail,
  registerWithEmail,
  requestPasswordReset,
  confirmPasswordReset,
  loginWithSSO,
  getErrorMessage,
} from "../src/shared/api";
import * as Google from "expo-auth-session/providers/google";
import { appConfig } from "../src/shared/config";

describe("AuthScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAppStore.setState({ accessToken: null } as any);
    (Google.useAuthRequest as jest.Mock).mockReturnValue([
      {},
      null,
      jest.fn(async () => ({ type: "dismiss" })),
    ]);
  });

  it("shows inline validation for invalid email", () => {
    const navigation = { replace: jest.fn() } as any;
    const screen = render(<AuthScreen navigation={navigation} route={{} as any} />);

    const inputs = screen.UNSAFE_getAllByType(TextInput);
    fireEvent.changeText(inputs[0], "bad");
    fireEvent.changeText(inputs[1], "12345678");
    fireEvent.press(screen.getAllByText("Sign in")[1]);

    expect(screen.getAllByText("Please enter a valid email address.").length).toBeGreaterThan(0);
  });

  it("allows sign in when api base url uses the public IP", async () => {
    (appConfig as any).apiBaseUrl = "http://103.45.234.100";
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
      expect(loginWithEmail).toHaveBeenCalledWith({
        email: "user@example.com",
        password: "secret123",
      });
      expect(navigation.replace).toHaveBeenCalledWith("Home");
    });
    (appConfig as any).apiBaseUrl = "https://api.test.local";
  });

  it("shows inline validation for short password", () => {
    const navigation = { replace: jest.fn() } as any;
    const screen = render(<AuthScreen navigation={navigation} route={{} as any} />);

    const inputs = screen.UNSAFE_getAllByType(TextInput);
    fireEvent.changeText(inputs[0], "user@example.com");
    fireEvent.changeText(inputs[1], "123");
    fireEvent.press(screen.getAllByText("Sign in")[1]);

    expect(screen.getAllByText("Password must be at least 8 characters.").length).toBeGreaterThan(0);
  });

  it("shows inline validation for signup missing full name and password mismatch", () => {
    const navigation = { replace: jest.fn() } as any;
    const screen = render(<AuthScreen navigation={navigation} route={{} as any} />);

    fireEvent.press(screen.getByText("Sign up"));
    let inputs = screen.UNSAFE_getAllByType(TextInput);
    fireEvent.changeText(inputs[0], "");
    fireEvent.changeText(inputs[1], "user@example.com");
    fireEvent.changeText(inputs[2], "secret123");
    fireEvent.changeText(inputs[3], "secret123");
    fireEvent.press(screen.getAllByText("Sign up")[1]);
    expect(screen.getAllByText("Please enter your full name.").length).toBeGreaterThan(0);

    inputs = screen.UNSAFE_getAllByType(TextInput);
    fireEvent.changeText(inputs[0], "Test User");
    fireEvent.changeText(inputs[1], "user@example.com");
    fireEvent.changeText(inputs[2], "secret123");
    fireEvent.changeText(inputs[3], "mismatch123");
    fireEvent.press(screen.getAllByText("Sign up")[1]);
    expect(screen.getAllByText("Passwords do not match.").length).toBeGreaterThan(0);
  });

  it("redirects to home when access token already exists", async () => {
    useAppStore.setState({ accessToken: "existing-token" } as any);
    const navigation = { replace: jest.fn() } as any;
    render(<AuthScreen navigation={navigation} route={{} as any} />);

    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith("Home"));
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

  it("registers and navigates home", async () => {
    (registerWithEmail as jest.Mock).mockResolvedValue({
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

    await waitFor(() => {
      expect(registerWithEmail).toHaveBeenCalled();
      expect(navigation.replace).toHaveBeenCalledWith("Home");
    });
  });

  it("shows inline error when register fails", async () => {
    (registerWithEmail as jest.Mock).mockRejectedValue(new Error("bad register"));

    const navigation = { replace: jest.fn() } as any;
    const screen = render(<AuthScreen navigation={navigation} route={{} as any} />);

    fireEvent.press(screen.getByText("Sign up"));
    const inputs = screen.UNSAFE_getAllByType(TextInput);
    fireEvent.changeText(inputs[0], "Test User");
    fireEvent.changeText(inputs[1], "new@example.com");
    fireEvent.changeText(inputs[2], "secret123");
    fireEvent.changeText(inputs[3], "secret123");
    fireEvent.press(screen.getAllByText("Sign up")[1]);

    await waitFor(() => expect(screen.getAllByText("bad register").length).toBeGreaterThan(0));
  });

  it("handles password reset request and confirm flows", async () => {
    (requestPasswordReset as jest.Mock).mockResolvedValue({ status: "sent" });
    (confirmPasswordReset as jest.Mock).mockResolvedValue({ status: "ok" });

    const navigation = { replace: jest.fn() } as any;
    const screen = render(<AuthScreen navigation={navigation} route={{} as any} />);

    fireEvent.press(screen.getByText("Forgot password"));
    expect(screen.getAllByText("Please enter your email first.").length).toBeGreaterThan(0);

    const inputs = screen.UNSAFE_getAllByType(TextInput);
    fireEvent.changeText(inputs[0], "user@example.com");
    fireEvent.changeText(inputs[1], "secret123");

    fireEvent.press(screen.getByText("Forgot password"));
    await waitFor(() => expect(requestPasswordReset).toHaveBeenCalledWith("user@example.com"));

    await waitFor(() => expect(screen.getAllByText("Confirm reset").length).toBeGreaterThan(0));
    const resetInputs = screen.UNSAFE_getAllByType(TextInput);
    const tokenInput = resetInputs[resetInputs.length - 2];
    const newPasswordInput = resetInputs[resetInputs.length - 1];
    fireEvent.changeText(tokenInput, "reset-token");
    fireEvent.changeText(newPasswordInput, "new-secret-123");
    fireEvent.press(screen.getAllByText("Confirm reset")[0]);

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

    await waitFor(() => expect(screen.getAllByText("auth failed").length).toBeGreaterThan(0));
  });

  it("shows auth network diagnostics for offline sign up", async () => {
    (registerWithEmail as jest.Mock).mockRejectedValue({ isAxiosError: true });
    const navigation = { replace: jest.fn() } as any;
    const screen = render(<AuthScreen navigation={navigation} route={{} as any} />);

    fireEvent.press(screen.getByText("Sign up"));
    const inputs = screen.UNSAFE_getAllByType(TextInput);
    fireEvent.changeText(inputs[0], "Test User");
    fireEvent.changeText(inputs[1], "new@example.com");
    fireEvent.changeText(inputs[2], "secret123");
    fireEvent.changeText(inputs[3], "secret123");
    fireEvent.press(screen.getAllByText("Sign up")[1]);

    await waitFor(() =>
      expect(
        screen.getAllByText("Network error while trying to sign up. API: https://api.test.local").length,
      ).toBeGreaterThan(0),
    );
  });

  it("shows auth network diagnostics for timeout sign in", async () => {
    (loginWithEmail as jest.Mock).mockRejectedValue({ isAxiosError: true, code: "ECONNABORTED" });
    const navigation = { replace: jest.fn() } as any;
    const screen = render(<AuthScreen navigation={navigation} route={{} as any} />);

    const inputs = screen.UNSAFE_getAllByType(TextInput);
    fireEvent.changeText(inputs[0], "user@example.com");
    fireEvent.changeText(inputs[1], "secret123");
    fireEvent.press(screen.getAllByText("Sign in")[1]);

    await waitFor(() =>
      expect(
        screen.getAllByText("Request timed out while trying to sign in. API: https://api.test.local").length,
      ).toBeGreaterThan(0),
    );
  });

  it("shows auth network diagnostics for server sign up error", async () => {
    (registerWithEmail as jest.Mock).mockRejectedValue({
      isAxiosError: true,
      response: { status: 503 },
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

    await waitFor(() =>
      expect(
        screen.getAllByText("error (server error from https://api.test.local)").length,
      ).toBeGreaterThan(0),
    );
  });

  it("shows api detail for duplicate-email sign up", async () => {
    (registerWithEmail as jest.Mock).mockRejectedValue({
      isAxiosError: true,
      response: { status: 400, data: { detail: "Email already exists" } },
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

    await waitFor(() => expect(screen.getAllByText("Email already exists").length).toBeGreaterThan(0));
  });

  it("shows api detail for duplicate-email sign in", async () => {
    (loginWithEmail as jest.Mock).mockRejectedValue({
      isAxiosError: true,
      response: { status: 401, data: { detail: "Invalid credentials" } },
    });
    const navigation = { replace: jest.fn() } as any;
    const screen = render(<AuthScreen navigation={navigation} route={{} as any} />);

    const inputs = screen.UNSAFE_getAllByType(TextInput);
    fireEvent.changeText(inputs[0], "user@example.com");
    fireEvent.changeText(inputs[1], "secret123");
    fireEvent.press(screen.getAllByText("Sign in")[1]);

    await waitFor(() => expect(screen.getAllByText("Invalid credentials").length).toBeGreaterThan(0));
  });

  it("shows api detail for reset request rate limit", async () => {
    (requestPasswordReset as jest.Mock).mockRejectedValue({
      isAxiosError: true,
      response: { status: 429, data: { detail: "Too many forgot-password attempts" } },
    });
    const navigation = { replace: jest.fn() } as any;
    const screen = render(<AuthScreen navigation={navigation} route={{} as any} />);

    const inputs = screen.UNSAFE_getAllByType(TextInput);
    fireEvent.changeText(inputs[0], "user@example.com");
    fireEvent.changeText(inputs[1], "secret123");
    fireEvent.press(screen.getByText("Forgot password"));

    await waitFor(() => expect(screen.getAllByText("Too many forgot-password attempts").length).toBeGreaterThan(0));
  });

  it("shows api detail for reset confirm invalid token", async () => {
    (requestPasswordReset as jest.Mock).mockResolvedValueOnce({ status: "sent" });
    (confirmPasswordReset as jest.Mock).mockRejectedValue({
      isAxiosError: true,
      response: { status: 400, data: { detail: "Invalid or expired reset token" } },
    });
    const navigation = { replace: jest.fn() } as any;
    const screen = render(<AuthScreen navigation={navigation} route={{} as any} />);

    const inputs = screen.UNSAFE_getAllByType(TextInput);
    fireEvent.changeText(inputs[0], "user@example.com");
    fireEvent.changeText(inputs[1], "secret123");
    fireEvent.press(screen.getByText("Forgot password"));

    await waitFor(() => expect(screen.getAllByText("Confirm reset").length).toBeGreaterThan(0));
    const resetInputs = screen.UNSAFE_getAllByType(TextInput);
    fireEvent.changeText(resetInputs[resetInputs.length - 2], "bad-token");
    fireEvent.changeText(resetInputs[resetInputs.length - 1], "new-secret");
    fireEvent.press(screen.getAllByText("Confirm reset")[0]);

    await waitFor(() => expect(screen.getAllByText("Invalid or expired reset token").length).toBeGreaterThan(0));
  });

  it("shows api detail for google sign-in invalid token", async () => {
    const navigation = { replace: jest.fn() } as any;
    (appConfig as any).googleWebClientId = "x";
    (Google.useAuthRequest as jest.Mock).mockReturnValue([
      {},
      null,
      jest.fn(async () => ({ type: "success", authentication: { idToken: "gid" } })),
    ]);
    (loginWithSSO as jest.Mock).mockRejectedValue({
      isAxiosError: true,
      response: { status: 401, data: { detail: "Invalid SSO token" } },
    });

    const screen = render(<AuthScreen navigation={navigation} route={{} as any} />);
    fireEvent.press(screen.getByText("Sign in with Google"));
    await waitFor(() => expect(screen.getAllByText("Invalid SSO token").length).toBeGreaterThan(0));
  });

  it("shows api detail for google sign-in missing email", async () => {
    const navigation = { replace: jest.fn() } as any;
    (appConfig as any).googleWebClientId = "x";
    (Google.useAuthRequest as jest.Mock).mockReturnValue([
      {},
      null,
      jest.fn(async () => ({ type: "success", authentication: { idToken: "gid" } })),
    ]);
    (loginWithSSO as jest.Mock).mockRejectedValue({
      isAxiosError: true,
      response: { status: 401, data: { detail: "SSO token missing email" } },
    });

    const screen = render(<AuthScreen navigation={navigation} route={{} as any} />);
    fireEvent.press(screen.getByText("Sign in with Google"));
    await waitFor(() => expect(screen.getAllByText("SSO token missing email").length).toBeGreaterThan(0));
  });

  it("shows api detail for google sign-in rate limit", async () => {
    const navigation = { replace: jest.fn() } as any;
    (appConfig as any).googleWebClientId = "x";
    (Google.useAuthRequest as jest.Mock).mockReturnValue([
      {},
      null,
      jest.fn(async () => ({ type: "success", authentication: { idToken: "gid" } })),
    ]);
    (loginWithSSO as jest.Mock).mockRejectedValue({
      isAxiosError: true,
      response: { status: 429, data: { detail: "Too many SSO attempts" } },
    });

    const screen = render(<AuthScreen navigation={navigation} route={{} as any} />);
    fireEvent.press(screen.getByText("Sign in with Google"));
    await waitFor(() => expect(screen.getAllByText("Too many SSO attempts").length).toBeGreaterThan(0));
  });

  it("shows api detail for sign up rate limit", async () => {
    (registerWithEmail as jest.Mock).mockRejectedValue({
      isAxiosError: true,
      response: { status: 429, data: { detail: "Too many register attempts" } },
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

    await waitFor(() => expect(screen.getAllByText("Too many register attempts").length).toBeGreaterThan(0));
  });

  it("shows api detail for sign in rate limit", async () => {
    (loginWithEmail as jest.Mock).mockRejectedValue({
      isAxiosError: true,
      response: { status: 429, data: { detail: "Too many login attempts" } },
    });
    const navigation = { replace: jest.fn() } as any;
    const screen = render(<AuthScreen navigation={navigation} route={{} as any} />);

    const inputs = screen.UNSAFE_getAllByType(TextInput);
    fireEvent.changeText(inputs[0], "user@example.com");
    fireEvent.changeText(inputs[1], "secret123");
    fireEvent.press(screen.getAllByText("Sign in")[1]);

    await waitFor(() => expect(screen.getAllByText("Too many login attempts").length).toBeGreaterThan(0));
  });

  it("shows api detail for sign in unverified email", async () => {
    (loginWithEmail as jest.Mock).mockRejectedValue({
      isAxiosError: true,
      response: { status: 403, data: { detail: "Email not verified" } },
    });
    const navigation = { replace: jest.fn() } as any;
    const screen = render(<AuthScreen navigation={navigation} route={{} as any} />);

    const inputs = screen.UNSAFE_getAllByType(TextInput);
    fireEvent.changeText(inputs[0], "user@example.com");
    fireEvent.changeText(inputs[1], "secret123");
    fireEvent.press(screen.getAllByText("Sign in")[1]);

    await waitFor(() => expect(screen.getAllByText("Email not verified").length).toBeGreaterThan(0));
  });

  it("shows api detail for sign up generic backend message", async () => {
    (registerWithEmail as jest.Mock).mockRejectedValue({
      isAxiosError: true,
      response: { status: 400, data: { message: "Registration blocked" } },
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

    await waitFor(() => expect(screen.getAllByText("Registration blocked").length).toBeGreaterThan(0));
  });

  it("shows api detail for sign in generic backend message", async () => {
    (loginWithEmail as jest.Mock).mockRejectedValue({
      isAxiosError: true,
      response: { status: 400, data: { message: "Login blocked" } },
    });
    const navigation = { replace: jest.fn() } as any;
    const screen = render(<AuthScreen navigation={navigation} route={{} as any} />);

    const inputs = screen.UNSAFE_getAllByType(TextInput);
    fireEvent.changeText(inputs[0], "user@example.com");
    fireEvent.changeText(inputs[1], "secret123");
    fireEvent.press(screen.getAllByText("Sign in")[1]);

    await waitFor(() => expect(screen.getAllByText("Login blocked").length).toBeGreaterThan(0));
  });


  it("handles google disabled, dismiss, and missing token branches", async () => {
    const navigation = { replace: jest.fn() } as any;

    (appConfig as any).googleWebClientId = "";
    (appConfig as any).googleExpoClientId = "";
    let screen = render(<AuthScreen navigation={navigation} route={{} as any} />);
    fireEvent.press(screen.getByText("Sign in with Google"));
    expect(screen.getAllByText("Missing Google client ID in environment variables.").length).toBeGreaterThan(0);

    (appConfig as any).googleWebClientId = "x";
    (Google.useAuthRequest as jest.Mock).mockReturnValueOnce([
      {},
      null,
      jest.fn(async () => ({ type: "dismiss" })),
    ]);
    screen.unmount();
    screen = render(<AuthScreen navigation={navigation} route={{} as any} />);
    fireEvent.press(screen.getByText("Sign in with Google"));
    await waitFor(() => expect(loginWithSSO).not.toHaveBeenCalled());

    (Google.useAuthRequest as jest.Mock).mockReturnValueOnce([
      {},
      null,
      jest.fn(async () => ({ type: "success", authentication: {} })),
    ]);

    screen.unmount();
    screen = render(<AuthScreen navigation={navigation} route={{} as any} />);
    fireEvent.press(screen.getByText("Sign in with Google"));
    await waitFor(() => expect(screen.getAllByText("Google did not return token payload.").length).toBeGreaterThan(0));
  });

  it("handles google success flow", async () => {
    const navigation = { replace: jest.fn() } as any;
    (appConfig as any).googleWebClientId = "x";
    (Google.useAuthRequest as jest.Mock).mockReturnValue([
      {},
      null,
      jest.fn(async () => ({ type: "success", authentication: { idToken: "gid" } })),
    ]);
    (loginWithSSO as jest.Mock).mockResolvedValue({ access_token: "a", refresh_token: "r" });

    const screen = render(<AuthScreen navigation={navigation} route={{} as any} />);
    fireEvent.press(screen.getByText("Sign in with Google"));
    await waitFor(() => expect(loginWithSSO).toHaveBeenCalledWith("google", "gid"));
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

  it("handles google prompt failure branch", async () => {
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
    await waitFor(() => expect(screen.getAllByText("google failed").length).toBeGreaterThan(0));
  });

  it("handles request and confirm reset failures", async () => {
    (requestPasswordReset as jest.Mock).mockRejectedValue(new Error("reset request failed"));
    (confirmPasswordReset as jest.Mock).mockRejectedValue(new Error("confirm failed"));

    const navigation = { replace: jest.fn() } as any;
    const screen = render(<AuthScreen navigation={navigation} route={{} as any} />);

    const inputs = screen.UNSAFE_getAllByType(TextInput);
    fireEvent.changeText(inputs[0], "user@example.com");
    fireEvent.changeText(inputs[1], "secret123");

    fireEvent.press(screen.getByText("Forgot password"));
    await waitFor(() => expect(screen.getAllByText("reset request failed").length).toBeGreaterThan(0));

    (requestPasswordReset as jest.Mock).mockResolvedValueOnce({ status: "sent" });
    fireEvent.press(screen.getByText("Forgot password"));
    await waitFor(() => expect(screen.getAllByText("Confirm reset").length).toBeGreaterThan(0));

    const resetInputs = screen.UNSAFE_getAllByType(TextInput);
    fireEvent.changeText(resetInputs[resetInputs.length - 2], "r-token");
    fireEvent.changeText(resetInputs[resetInputs.length - 1], "new-secret");
    fireEvent.press(screen.getAllByText("Confirm reset")[0]);

    await waitFor(() => expect(screen.getAllByText("confirm failed").length).toBeGreaterThan(0));
  });

  it("covers auth fallback messages when getErrorMessage is empty", async () => {
    (getErrorMessage as jest.Mock).mockReturnValue("");
    const navigation = { replace: jest.fn() } as any;

    (loginWithEmail as jest.Mock).mockRejectedValueOnce(new Error("signin fail"));
    let screen = render(<AuthScreen navigation={navigation} route={{} as any} />);
    let inputs = screen.UNSAFE_getAllByType(TextInput);
    fireEvent.changeText(inputs[0], "user@example.com");
    fireEvent.changeText(inputs[1], "secret123");
    fireEvent.press(screen.getAllByText("Sign in")[1]);
    await waitFor(() => expect(screen.getAllByText("Unable to authenticate.").length).toBeGreaterThan(0));

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
    await waitFor(() => expect(screen.getAllByText("Google sign-in failed.").length).toBeGreaterThan(0));

    screen.unmount();
    (registerWithEmail as jest.Mock).mockRejectedValueOnce(new Error("register fail"));
    screen = render(<AuthScreen navigation={navigation} route={{} as any} />);
    fireEvent.press(screen.getByText("Sign up"));
    inputs = screen.UNSAFE_getAllByType(TextInput);
    fireEvent.changeText(inputs[0], "Test User");
    fireEvent.changeText(inputs[1], "new@example.com");
    fireEvent.changeText(inputs[2], "secret123");
    fireEvent.changeText(inputs[3], "secret123");
    fireEvent.press(screen.getAllByText("Sign up")[1]);
    await waitFor(() => expect(screen.getAllByText("Unable to authenticate.").length).toBeGreaterThan(0));

    screen.unmount();
    (requestPasswordReset as jest.Mock).mockRejectedValueOnce(new Error("reset fail"));
    screen = render(<AuthScreen navigation={navigation} route={{} as any} />);
    inputs = screen.UNSAFE_getAllByType(TextInput);
    fireEvent.changeText(inputs[0], "user@example.com");
    fireEvent.changeText(inputs[1], "secret123");
    fireEvent.press(screen.getByText("Forgot password"));
    await waitFor(() => expect(screen.getAllByText("Unable to request password reset.").length).toBeGreaterThan(0));

    screen.unmount();
    (requestPasswordReset as jest.Mock).mockResolvedValueOnce({ status: "sent" });
    (confirmPasswordReset as jest.Mock).mockRejectedValueOnce(new Error("confirm fail"));
    screen = render(<AuthScreen navigation={navigation} route={{} as any} />);
    inputs = screen.UNSAFE_getAllByType(TextInput);
    fireEvent.changeText(inputs[0], "user@example.com");
    fireEvent.changeText(inputs[1], "secret123");
    fireEvent.press(screen.getByText("Forgot password"));
    await waitFor(() => expect(screen.getAllByText("Confirm reset").length).toBeGreaterThan(0));
    const resetInputs = screen.UNSAFE_getAllByType(TextInput);
    fireEvent.changeText(resetInputs[resetInputs.length - 2], "token");
    fireEvent.changeText(resetInputs[resetInputs.length - 1], "new-secret");
    fireEvent.press(screen.getAllByText("Confirm reset")[0]);
    await waitFor(() => expect(screen.getAllByText("Unable to reset password.").length).toBeGreaterThan(0));
  });
});
