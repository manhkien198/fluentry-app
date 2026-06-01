import axios from "axios";

jest.mock("../src/shared/config", () => ({
  appConfig: { apiBaseUrl: "https://example.test" },
}));

jest.mock("../src/shared/authStorage", () => ({
  clearAuthTokens: jest.fn(async () => undefined),
  loadRefreshToken: jest.fn(async () => null),
  saveAccessToken: jest.fn(async () => undefined),
  saveRefreshToken: jest.fn(async () => undefined),
}));

describe("shared/api additional paths", () => {
  afterEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
  });

  it("getErrorMessage reads detail/message/fallback message", () => {
    const { getErrorMessage } = require("../src/shared/api");

    jest.spyOn(axios, "isAxiosError").mockReturnValue(true);
    expect(getErrorMessage({ response: { data: { detail: "detail msg" } } })).toBe("detail msg");
    expect(getErrorMessage({ response: { data: { message: "message msg" } } })).toBe("message msg");

    jest.spyOn(axios, "isAxiosError").mockReturnValue(false);
    expect(getErrorMessage({ message: "plain error" })).toBe("plain error");
    expect(getErrorMessage({ message: "   " })).toBeNull();
  });

  it("classifyNetworkIssue handles timeout/offline/server/unknown", () => {
    const { classifyNetworkIssue } = require("../src/shared/api");

    jest.spyOn(axios, "isAxiosError").mockReturnValue(true);
    expect(classifyNetworkIssue({ isAxiosError: true, code: "ECONNABORTED" })).toBe("timeout");
    expect(classifyNetworkIssue({ isAxiosError: true, response: undefined })).toBe("offline");
    expect(classifyNetworkIssue({ isAxiosError: true, response: { status: 500 } })).toBe("server");
    expect(classifyNetworkIssue({ isAxiosError: true, response: { status: 400 } })).toBe("unknown");

    jest.spyOn(axios, "isAxiosError").mockReturnValue(false);
    expect(classifyNetworkIssue(new Error("x"))).toBe("unknown");
  });

  it("does not retry non-retryable uploadPracticeAudio error", async () => {
    const { api, uploadPracticeAudio } = require("../src/shared/api");
    (global as any).FormData = class {
      append(_k: string, _v: unknown) {}
    };

    jest.spyOn(axios, "isAxiosError").mockReturnValue(true);
    const err: any = new Error("bad request");
    err.response = { status: 400 };
    const postSpy = jest.spyOn(api, "post").mockRejectedValue(err);

    await expect(uploadPracticeAudio("s1", "file://x.m4a")).rejects.toBe(err);
    expect(postSpy).toHaveBeenCalledTimes(1);
  });

  it("retries upload when non-axios object has ECONNABORTED code", async () => {
    const { api, uploadPracticeAudio } = require("../src/shared/api");
    (global as any).FormData = class {
      append(_k: string, _v: unknown) {}
    };

    jest.spyOn(axios, "isAxiosError").mockReturnValue(false);
    const timeoutObj: any = { code: "ECONNABORTED" };
    const postSpy = jest
      .spyOn(api, "post")
      .mockRejectedValueOnce(timeoutObj)
      .mockResolvedValueOnce({ data: { uploaded: true } } as any);

    await expect(uploadPracticeAudio("s1", "file://x.m4a")).resolves.toEqual({ uploaded: true });
    expect(postSpy).toHaveBeenCalledTimes(2);
  });

  it("throws last error after retry exhaustion", async () => {
    const { api, fetchPracticeResult } = require("../src/shared/api");
    jest.spyOn(axios, "isAxiosError").mockReturnValue(true);
    const timeoutErr: any = new Error("timeout always");
    timeoutErr.code = "ECONNABORTED";

    const getSpy = jest.spyOn(api, "get").mockRejectedValue(timeoutErr);
    await expect(fetchPracticeResult("s-timeout")).rejects.toBe(timeoutErr);
    expect(getSpy).toHaveBeenCalledTimes(2);
  });

  it("handles unauthorized response without original request", async () => {
    jest.spyOn(axios, "isAxiosError").mockReturnValue(true);
    const { api } = require("../src/shared/api");
    const authStorage = require("../src/shared/authStorage");
    const { useAppStore } = require("../src/shared/store");
    const clearSessionSpy = jest.spyOn(useAppStore.getState(), "clearSession");

    const rejected = (api as any).interceptors.response.handlers[0].rejected;
    const err = { response: { status: 401 }, isAxiosError: true };

    await expect(rejected(err)).rejects.toBeTruthy();
    expect(authStorage.clearAuthTokens).toHaveBeenCalled();
    expect(clearSessionSpy).toHaveBeenCalled();
  });

  it("passes response interceptor success through", () => {
    const { api } = require("../src/shared/api");
    const fulfilled = (api as any).interceptors.response.handlers[0].fulfilled;
    const response = { data: { ok: 1 } };
    expect(fulfilled(response)).toBe(response);
  });

  it("returns null when refresh response has no access token", async () => {
    jest.spyOn(axios, "isAxiosError").mockReturnValue(true);
    const authStorage = require("../src/shared/authStorage");
    (authStorage.loadRefreshToken as jest.Mock).mockResolvedValueOnce("refresh-token");
    jest.spyOn(axios, "post").mockResolvedValueOnce({ data: {} } as any);

    const { api } = require("../src/shared/api");
    const { useAppStore } = require("../src/shared/store");
    const clearSessionSpy = jest.spyOn(useAppStore.getState(), "clearSession");
    const rejected = (api as any).interceptors.response.handlers[0].rejected;

    const err = { config: { headers: {}, url: "/x", method: "get" }, response: { status: 401 }, isAxiosError: true };
    await expect(rejected(err)).rejects.toBeTruthy();
    expect(clearSessionSpy).toHaveBeenCalled();
  });


  it("throws last error path via non-axios timeout object retries", async () => {
    const { api, fetchPracticeResult } = require("../src/shared/api");
    jest.spyOn(axios, "isAxiosError").mockReturnValue(false);
    const timeoutObj: any = { code: "ECONNABORTED" };

    const getSpy = jest.spyOn(api, "get").mockRejectedValue(timeoutObj);
    await expect(fetchPracticeResult("s-timeout-obj")).rejects.toBe(timeoutObj);
    expect(getSpy).toHaveBeenCalledTimes(2);
  });

  it("does not retry when non-axios object code is not timeout", async () => {
    const { api, fetchPracticeResult } = require("../src/shared/api");
    jest.spyOn(axios, "isAxiosError").mockReturnValue(false);
    const nonRetryableObj: any = { code: "EOTHER" };

    const getSpy = jest.spyOn(api, "get").mockRejectedValue(nonRetryableObj);
    await expect(fetchPracticeResult("s-non-retry")).rejects.toBe(nonRetryableObj);
    expect(getSpy).toHaveBeenCalledTimes(1);
  });

  it("does not retry when thrown value is a primitive", async () => {
    const { api, fetchPracticeResult } = require("../src/shared/api");
    jest.spyOn(axios, "isAxiosError").mockReturnValue(false);

    const getSpy = jest.spyOn(api, "get").mockRejectedValue("primitive-error");
    await expect(fetchPracticeResult("s-primitive")).rejects.toBe("primitive-error");
    expect(getSpy).toHaveBeenCalledTimes(1);
  });

  it("request and reset password functions call api", async () => {
    const { api, requestPasswordReset, confirmPasswordReset } = require("../src/shared/api");

    jest.spyOn(api, "post")
      .mockResolvedValueOnce({ data: { status: "sent" } } as any)
      .mockResolvedValueOnce({ data: { status: "ok" } } as any);

    await expect(requestPasswordReset("u@example.com")).resolves.toEqual({ status: "sent" });
    await expect(confirmPasswordReset({ token: "t", new_password: "secret123" })).resolves.toEqual({ status: "ok" });
  });

  it("fetchDrills and fetchContentVersion call api get", async () => {
    const { api, fetchDrills, fetchContentVersion } = require("../src/shared/api");

    jest.spyOn(api, "get")
      .mockResolvedValueOnce({ data: { items: [{ id: "d1" }] } } as any)
      .mockResolvedValueOnce({ data: { version: "v2" } } as any);

    await expect(fetchDrills({ mode: "minimal_pairs", limit: 5 })).resolves.toEqual({ items: [{ id: "d1" }] });
    await expect(fetchContentVersion()).resolves.toEqual({ version: "v2" });
  });
});