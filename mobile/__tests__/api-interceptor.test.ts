import axios from "axios";

jest.mock("../src/shared/authStorage", () => ({
  clearAuthTokens: jest.fn(async () => undefined),
  loadRefreshToken: jest.fn(async () => "refresh-token"),
  saveAccessToken: jest.fn(async () => undefined),
  saveRefreshToken: jest.fn(async () => undefined),
}));

describe("shared/api interceptor", () => {
  afterEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
  });

  it("refreshes on 401 and retries request with new token", async () => {
    jest.spyOn(axios, "isAxiosError").mockReturnValue(true);
    jest
      .spyOn(axios, "post")
      .mockResolvedValueOnce({ data: { access_token: "new-access" } } as any);

    const { api } = require("../src/shared/api");
    const { useAppStore } = require("../src/shared/store");
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
    const calledConfig = requestSpy.mock.calls[0][0];
    expect(calledConfig.headers.Authorization).toBe("Bearer new-access");
  });
});
