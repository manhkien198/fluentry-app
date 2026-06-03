import axios from "axios";

jest.mock("../src/shared/authStorage", () => ({
  clearAuthTokens: jest.fn(async () => undefined),
  loadRefreshToken: jest.fn(async () => "refresh-token"),
  saveAccessToken: jest.fn(async () => undefined),
  saveRefreshToken: jest.fn(async () => undefined),
}));

import { loadRefreshToken } from "../src/shared/authStorage";
import { appConfig } from "../src/shared/config";

describe("shared/api interceptor", () => {
  afterEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
  });

  it("refreshes on 401, saves new refresh token, and retries request with new token", async () => {
    jest.spyOn(axios, "isAxiosError").mockReturnValue(true);
    jest
      .spyOn(axios, "post")
      .mockResolvedValueOnce({ data: { access_token: "new-access", refresh_token: "new-refresh" } } as any);

    const { api } = require("../src/shared/api");
    const { useAppStore } = require("../src/shared/store");
    const authStorage = require("../src/shared/authStorage");
    useAppStore.getState().setAccessToken("old");

    const requestSpy = jest
      .spyOn(api, "request")
      .mockResolvedValueOnce({ data: "ok" } as any);

    const rejected = (api as any).interceptors.response.handlers[0].rejected;

    const error = {
      config: { headers: {} },
      response: { status: 401 },
    };

    const result = await rejected(error);
    expect(result.data).toBe("ok");

    expect(requestSpy).toHaveBeenCalledTimes(1);
    const calledConfig = requestSpy.mock.calls[0][0] as { headers?: Record<string, string> };
    expect(calledConfig.headers?.Authorization).toBe("Bearer new-access");
    expect(authStorage.saveRefreshToken).toHaveBeenCalledWith("new-refresh");
  });


  it("rejects when refresh token is missing", async () => {
    jest.spyOn(axios, "isAxiosError").mockReturnValue(true);
    (loadRefreshToken as jest.Mock).mockResolvedValueOnce(null);

    const { api } = require("../src/shared/api");
    const rejected = (api as any).interceptors.response.handlers[0].rejected;

    const err = { config: { headers: {} }, response: { status: 401 }, isAxiosError: true };
    await expect(rejected(err)).rejects.toBeTruthy();
  });

  it("rejects when request is already retried", async () => {
    jest.spyOn(axios, "isAxiosError").mockReturnValue(true);

    const { api } = require("../src/shared/api");
    const rejected = (api as any).interceptors.response.handlers[0].rejected;

    const err = {
      config: { _retry: true, headers: {} },
      response: { status: 401 },
      isAxiosError: true,
    };
    await expect(rejected(err)).rejects.toBeTruthy();
  });

  it("clears session on unauthorized when refresh fails", async () => {
    jest.spyOn(axios, "isAxiosError").mockReturnValue(true);
    (loadRefreshToken as jest.Mock).mockResolvedValueOnce("refresh-token");
    jest.spyOn(axios, "post").mockRejectedValue(new Error("refresh failed"));

    const { api } = require("../src/shared/api");
    const { useAppStore } = require("../src/shared/store");
    const authStorage = require("../src/shared/authStorage");
    const clearSessionSpy = jest.spyOn(useAppStore.getState(), "clearSession");
    const rejected = (api as any).interceptors.response.handlers[0].rejected;

    const err = { config: { headers: {} }, response: { status: 401 }, isAxiosError: true };
    await expect(rejected(err)).rejects.toBeTruthy();
    expect(authStorage.clearAuthTokens).toHaveBeenCalled();
    expect(clearSessionSpy).toHaveBeenCalled();
  });

  it("expires session after repeated retryable refresh failures", async () => {
    jest.spyOn(axios, "isAxiosError").mockImplementation((error: any) => Boolean(error?.isAxiosError));
    const timeoutError: any = new Error("timeout");
    timeoutError.isAxiosError = true;
    timeoutError.code = "ECONNABORTED";
    jest.spyOn(axios, "post").mockRejectedValue(timeoutError);

    const { api } = require("../src/shared/api");
    const { useAppStore } = require("../src/shared/store");
    const rejected = (api as any).interceptors.response.handlers[0].rejected;

    const error = { config: { headers: {} }, response: { status: 401 }, isAxiosError: true };
    await expect(rejected(error)).rejects.toBeTruthy();
    expect(useAppStore.getState().authStatus).toBe("expired");
  });

  it("rejects when refresh response has no access token", async () => {
    jest.spyOn(axios, "isAxiosError").mockReturnValue(true);
    jest.spyOn(axios, "post").mockResolvedValueOnce({ data: {} } as any);

    const { api } = require("../src/shared/api");
    const rejected = (api as any).interceptors.response.handlers[0].rejected;
    const error = { config: { headers: {} }, response: { status: 401 }, isAxiosError: true };

    await expect(rejected(error)).rejects.toBeTruthy();
  });

  it("passes through non-401 errors", async () => {
    jest.spyOn(axios, "isAxiosError").mockReturnValue(true);
    const { api } = require("../src/shared/api");
    const rejected = (api as any).interceptors.response.handlers[0].rejected;
    const err = { config: { headers: {} }, response: { status: 500 }, isAxiosError: true };
    await expect(rejected(err)).rejects.toBe(err);
  });


  it("request interceptor sets baseURL and auth header when token exists", async () => {
    const { api } = require("../src/shared/api");
    const { useAppStore } = require("../src/shared/store");
    useAppStore.getState().setAccessToken("token-123");

    const fulfilled = (api as any).interceptors.request.handlers[0].fulfilled;
    const config = fulfilled({ headers: {} });

    expect(config.baseURL).toBe(appConfig.apiBaseUrl);
    expect(config.headers.Authorization).toBe("Bearer token-123");
  });

  it("request interceptor keeps headers object when token missing", async () => {
    const { api } = require("../src/shared/api");
    const { useAppStore } = require("../src/shared/store");
    useAppStore.getState().setAccessToken(null);

    const fulfilled = (api as any).interceptors.request.handlers[0].fulfilled;
    const config = fulfilled({});

    expect(config.baseURL).toBe(appConfig.apiBaseUrl);
    expect(config.headers).toBeUndefined();
  });

  it("loginWithSSO posts provider payload", async () => {
    const { api, loginWithSSO } = require("../src/shared/api");
    const postSpy = jest.spyOn(api, "post").mockResolvedValueOnce({
      data: { access_token: "a", refresh_token: "r" },
    } as any);

    await expect(loginWithSSO("google", "id-token-1")).resolves.toEqual({
      access_token: "a",
      refresh_token: "r",
    });

    expect(postSpy).toHaveBeenCalledWith("/auth/sso", {
      provider: "google",
      id_token: "id-token-1",
    });
  });
});
