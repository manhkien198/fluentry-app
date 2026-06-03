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

describe("shared/api functions", () => {
  afterEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
  });

  it("fetchLessons returns items", async () => {
    const { api, fetchLessons } = require("../src/shared/api");
    jest.spyOn(api, "get").mockResolvedValueOnce({
      data: { items: [{ id: "1" }, { id: "2" }] },
    } as any);

    await expect(fetchLessons()).resolves.toEqual([{ id: "1" }, { id: "2" }]);
  });

  it("fetchLessonById returns API value when request succeeds", async () => {
    const { api, fetchLessonById } = require("../src/shared/api");
    jest.spyOn(api, "get").mockResolvedValueOnce({
      data: { id: "a", title: "T" },
    } as any);

    await expect(fetchLessonById("a")).resolves.toEqual({ id: "a", title: "T" });
  });

  it("fetchLessonById falls back to fetchLessons when direct fetch fails", async () => {
    const { api, fetchLessonById } = require("../src/shared/api");
    jest.spyOn(api, "get")
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({ data: { items: [{ id: "b", title: "B" }] } } as any);

    await expect(fetchLessonById("b")).resolves.toEqual({ id: "b", title: "B" });
  });

  it("fetchLessonById throws when missing in fallback list", async () => {
    const { api, fetchLessonById } = require("../src/shared/api");
    jest.spyOn(api, "get")
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({ data: { items: [{ id: "x" }] } } as any);

    await expect(fetchLessonById("missing")).rejects.toThrow("Lesson not found");
  });

  it("requestPracticeScore retries once on timeout then succeeds", async () => {
    jest.spyOn(axios, "isAxiosError").mockReturnValue(true);
    const { api, requestPracticeScore } = require("../src/shared/api");

    const err: any = new Error("timeout");
    err.code = "ECONNABORTED";

    jest.spyOn(api, "post")
      .mockRejectedValueOnce(err)
      .mockResolvedValueOnce({ data: { ok: true } } as any);

    await expect(requestPracticeScore("s1")).resolves.toEqual({ ok: true });
    expect(api.post).toHaveBeenCalledTimes(2);
  });

  it("uploadPracticeAudio retries and returns response", async () => {
    jest.spyOn(axios, "isAxiosError").mockReturnValue(true);
    const { api, uploadPracticeAudio } = require("../src/shared/api");
    (global as any).FormData = class {
      append(_k: string, _v: unknown) {}
    };

    const err: any = new Error("timeout");
    err.code = "ECONNABORTED";

    jest.spyOn(api, "post")
      .mockRejectedValueOnce(err)
      .mockResolvedValueOnce({ data: { uploaded: true } } as any);

    await expect(uploadPracticeAudio("s1", "file://a.m4a")).resolves.toEqual({ uploaded: true });
    expect(api.post).toHaveBeenCalledTimes(2);
  });

  it("fetchPracticeResult returns payload", async () => {
    const { api, fetchPracticeResult } = require("../src/shared/api");
    jest.spyOn(api, "get").mockResolvedValueOnce({
      data: { session_id: "s", status: "processing" },
    } as any);
    await expect(fetchPracticeResult("s")).resolves.toEqual({ session_id: "s", status: "processing" });
  });

  it("auth endpoints post and return data", async () => {
    const { api, loginWithEmail, registerWithEmail } = require("../src/shared/api");
    jest.spyOn(api, "post")
      .mockResolvedValueOnce({ data: { access_token: "a" } } as any)
      .mockResolvedValueOnce({ data: { access_token: "b", refresh_token: "r" } } as any);

    await expect(loginWithEmail({ email: "e", password: "p" })).resolves.toEqual({ access_token: "a" });
    await expect(registerWithEmail({ email: "e", password: "p" })).resolves.toEqual({ access_token: "b", refresh_token: "r" });
  });

  it("user endpoints get and return data", async () => {
    const { api, fetchUserProgress, fetchUserHistory } = require("../src/shared/api");
    jest.spyOn(api, "get")
      .mockResolvedValueOnce({ data: { streak: 1, xp: 2 } } as any)
      .mockResolvedValueOnce({ data: { items: [{ session_id: "s" }] } } as any);

    await expect(fetchUserProgress()).resolves.toEqual({ streak: 1, xp: 2 });
    await expect(fetchUserHistory()).resolves.toEqual({ items: [{ session_id: "s" }] });
  });

  it("drills/content endpoints get and return data", async () => {
    const { api, fetchDrills, fetchContentVersion } = require("../src/shared/api");
    jest.spyOn(api, "get")
      .mockResolvedValueOnce({ data: { items: [{ id: "d" }] } } as any)
      .mockResolvedValueOnce({ data: { version: "1" } } as any);

    await expect(fetchDrills({ sound: "s" })).resolves.toEqual({ items: [{ id: "d" }] });
    expect(api.get).toHaveBeenNthCalledWith(1, "/drills", { params: { sound: "s" } });
    await expect(fetchContentVersion()).resolves.toEqual({ version: "1" });
  });

  it("covers utility helpers and practice session creation", async () => {
    const { api, createPracticeSession, getErrorMessage, classifyNetworkIssue } = require("../src/shared/api");

    jest.spyOn(api, "post").mockResolvedValueOnce({ data: { session_id: "s-1" } } as any);
    await expect(createPracticeSession({ lesson_id: "l1", expected_text: "hello" })).resolves.toEqual({ session_id: "s-1" });

    expect(getErrorMessage({ message: "plain error" })).toBe("plain error");
    expect(getErrorMessage({})).toBeNull();

    const timeoutErr: any = { isAxiosError: true, code: "ECONNABORTED" };
    const offlineErr: any = { isAxiosError: true, response: undefined };
    const serverErr: any = { isAxiosError: true, response: { status: 503 } };
    const unknownErr: any = { isAxiosError: true, response: { status: 400 } };

    jest.spyOn(axios, "isAxiosError").mockImplementation((e: any) => Boolean(e?.isAxiosError));
    expect(classifyNetworkIssue(timeoutErr)).toBe("timeout");
    expect(classifyNetworkIssue(offlineErr)).toBe("offline");
    expect(classifyNetworkIssue(serverErr)).toBe("server");
    expect(classifyNetworkIssue(unknownErr)).toBe("unknown");
    expect(classifyNetworkIssue(new Error("x"))).toBe("unknown");
  });
});
