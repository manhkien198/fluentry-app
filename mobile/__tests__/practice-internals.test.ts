import { mapPracticeSubmitError, pollPracticeResult } from "../src/features/practice/PracticeScreen";

describe("practice internals", () => {
  const tFn = (key: string) => {
    const map: Record<string, string> = {
      "practice.cancelled": "Scoring cancelled.",
      "practice.failed": "Scoring failed.",
      "practice.timeout": "Scoring took too long. Please retry.",
      "practice.no_internet": "No internet connection. Check your network and retry.",
      "practice.request_timeout": "Request timed out. Please try again.",
      "toast.scoring_failed": "Scoring failed. Please try again.",
    };
    return map[key] || key;
  };

  it("pollPracticeResult returns done result", async () => {
    const done = { session_id: "s1", status: "done", overall_score: 1, pronunciation_score: 1, fluency_score: 1, words: [], phonemes: [], tips: [], analysis: { alignment_status: "ok", word_count: 1, estimated_duration_ms: 1, phoneme_preview: [], audio_path: null, audio_detected: true } } as any;
    await expect(
      pollPracticeResult("s1", {
        fetchResult: jest.fn(async () => done),
        sleep: jest.fn(async () => undefined),
        isCancelled: () => false,
        tFn,
      }),
    ).resolves.toEqual(done);
  });

  it("pollPracticeResult throws failed error with backend message", async () => {
    await expect(
      pollPracticeResult("s1", {
        fetchResult: jest.fn(async () => ({ session_id: "s1", status: "failed", error: "engine fail" } as any)),
        sleep: jest.fn(async () => undefined),
        isCancelled: () => false,
        tFn,
      }),
    ).rejects.toThrow("engine fail");
  });

  it("pollPracticeResult throws failed fallback when no backend error", async () => {
    await expect(
      pollPracticeResult("s1", {
        fetchResult: jest.fn(async () => ({ session_id: "s1", status: "failed", error: null } as any)),
        sleep: jest.fn(async () => undefined),
        isCancelled: () => false,
        tFn,
      }),
    ).rejects.toThrow("Scoring failed.");
  });

  it("pollPracticeResult throws cancelled when cancellation is true", async () => {
    await expect(
      pollPracticeResult("s1", {
        fetchResult: jest.fn(async () => ({ session_id: "s1", status: "processing" } as any)),
        sleep: jest.fn(async () => undefined),
        isCancelled: () => true,
        tFn,
      }),
    ).rejects.toThrow("Scoring cancelled.");
  });

  it("pollPracticeResult throws timeout after max attempts", async () => {
    const sleep = jest.fn(async () => undefined);
    await expect(
      pollPracticeResult("s1", {
        fetchResult: jest.fn(async () => ({ session_id: "s1", status: "processing" } as any)),
        sleep,
        isCancelled: () => false,
        tFn,
        maxAttempts: 2,
      }),
    ).rejects.toThrow("Scoring took too long. Please retry.");
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("mapPracticeSubmitError maps offline/timeout/unknown", () => {
    expect(mapPracticeSubmitError({}, "offline", tFn)).toBe("No internet connection. Check your network and retry.");
    expect(mapPracticeSubmitError({}, "timeout", tFn)).toBe("Request timed out. Please try again.");
    expect(mapPracticeSubmitError({}, "unknown", tFn)).toBe("Scoring failed. Please try again.");
  });

  it("mapPracticeSubmitError prefers error.message and handles undefined", () => {
    expect(mapPracticeSubmitError({ message: "boom" }, "unknown", tFn)).toBe("boom");
    expect(mapPracticeSubmitError({ message: undefined }, "unknown", tFn)).toBe("Scoring failed. Please try again.");
  });
});
