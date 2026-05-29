import axios from "axios";
import { classifyNetworkIssue, getErrorMessage } from "../src/shared/api";

describe("shared/api error helpers", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("getErrorMessage", () => {
    it("returns detail from axios response when present", () => {
      const error = {
        isAxiosError: true,
        response: { data: { detail: "Bad credentials" } },
      } as unknown;

      expect(getErrorMessage(error)).toBe("Bad credentials");
    });

    it("returns message from generic Error", () => {
      expect(getErrorMessage(new Error("boom"))).toBe("boom");
    });

    it("returns null when no message available", () => {
      expect(getErrorMessage({})).toBeNull();
      expect(getErrorMessage(null)).toBeNull();
    });
  });

  describe("classifyNetworkIssue", () => {
    it("returns timeout for ECONNABORTED", () => {
      const error = {
        isAxiosError: true,
        code: "ECONNABORTED",
      } as unknown;

      jest.spyOn(axios, "isAxiosError").mockReturnValueOnce(true);
      expect(classifyNetworkIssue(error)).toBe("timeout");
    });

    it("returns offline when no response", () => {
      const error = { isAxiosError: true } as unknown;
      jest.spyOn(axios, "isAxiosError").mockReturnValueOnce(true);
      expect(classifyNetworkIssue(error)).toBe("offline");
    });

    it("returns server for 5xx", () => {
      const error = {
        isAxiosError: true,
        response: { status: 503 },
      } as unknown;
      jest.spyOn(axios, "isAxiosError").mockReturnValueOnce(true);
      expect(classifyNetworkIssue(error)).toBe("server");
    });

    it("returns unknown for non-axios errors", () => {
      jest.spyOn(axios, "isAxiosError").mockReturnValueOnce(false);
      expect(classifyNetworkIssue(new Error("x"))).toBe("unknown");
    });
  });
});
