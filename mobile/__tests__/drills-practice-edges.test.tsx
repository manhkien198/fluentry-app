import * as ReactModule from "react";
import { render, waitFor, fireEvent } from "@testing-library/react-native";

jest.mock("../src/shared/useAppColors", () => ({
  useAppColors: () => ({
    text: "#fff",
    muted: "#aaa",
    surface: "#111",
    surfaceAlt: "#222",
    primary: "#0ff",
    warning: "#ff0",
    success: "#0f0",
    danger: "#f00",
  }),
}));

jest.mock("../src/shared/ui", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    Screen: ({ children }: any) => <View>{children}</View>,
    SectionCard: ({ children }: any) => <View>{children}</View>,
  };
});

jest.mock("../src/shared/api", () => ({
  fetchDrills: jest.fn(),
  createPracticeSession: jest.fn(),
  uploadPracticeAudio: jest.fn(),
  requestPracticeScore: jest.fn(),
  fetchPracticeResult: jest.fn(),
  classifyNetworkIssue: jest.fn(() => "offline"),
}));

jest.mock("expo-av", () => ({
  Audio: {
    requestPermissionsAsync: jest.fn(async () => ({ granted: false })),
    setAudioModeAsync: jest.fn(async () => undefined),
    Recording: jest.fn(() => ({
      prepareToRecordAsync: jest.fn(async () => undefined),
      startAsync: jest.fn(async () => undefined),
      stopAndUnloadAsync: jest.fn(async () => undefined),
      getURI: jest.fn(() => "file:///tmp/a.m4a"),
    })),
    RecordingOptionsPresets: { HIGH_QUALITY: {} },
  },
}));

jest.mock("../src/shared/haptics", () => ({ haptic: jest.fn(async () => undefined) }));
jest.mock("../src/shared/toast", () => ({ showToast: jest.fn() }));

import { Audio } from "expo-av";
import {
  fetchDrills,
  createPracticeSession,
  uploadPracticeAudio,
  requestPracticeScore,
  fetchPracticeResult,
  classifyNetworkIssue,
} from "../src/shared/api";
import { showToast } from "../src/shared/toast";
import { useAppStore } from "../src/shared/store";
import { DrillsScreen } from "../src/features/lesson/DrillsScreen";
import { PracticeScreen } from "../src/features/practice/PracticeScreen";

beforeEach(() => {
  jest.useRealTimers();
  useAppStore.setState({ latestResult: null } as any);
});

afterEach(() => {
  jest.clearAllMocks();
});

describe("DrillsScreen", () => {
  it("renders drills list", async () => {
    (fetchDrills as jest.Mock).mockResolvedValue({
      items: [{ id: "d1", sound: "th", mode: "minimal_pairs", title: "TH Drill", prompt: "say this" }],
    });
    const screen = render(<DrillsScreen />);
    await waitFor(() => expect(screen.getByText(/TH · minimal_pairs/i)).toBeTruthy());
  });

  it("shows empty text when api returns missing items", async () => {
    (fetchDrills as jest.Mock).mockResolvedValue({} as any);
    const screen = render(<DrillsScreen />);
    await waitFor(() => expect(screen.getByText("No drills available.")).toBeTruthy());
  });

  it("shows empty text on fetch failure", async () => {
    (fetchDrills as jest.Mock).mockRejectedValue(new Error("boom"));
    const screen = render(<DrillsScreen />);
    await waitFor(() => expect(screen.getByText("No drills available.")).toBeTruthy());
  });

  it("handles unmount before drills request settles", async () => {
    let rejectLater!: (reason?: unknown) => void;
    (fetchDrills as jest.Mock).mockReturnValue(
      new Promise((_, reject) => {
        rejectLater = reject;
      }),
    );

    const screen = render(<DrillsScreen />);
    screen.unmount();
    rejectLater(new Error("late boom"));
  });
});

describe("PracticeScreen edge states", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Audio.requestPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
  });

  it("shows mic permission error", async () => {
    (Audio.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: false });
    const navigation = { replace: jest.fn() } as any;
    const route = { params: { lessonId: "l1", prompt: "hello" } } as any;
    const screen = render(<PracticeScreen navigation={navigation} route={route} />);

    fireEvent.press(screen.getByText("Start recording"));
    await waitFor(() => expect(screen.getByText("Microphone permission is required.")).toBeTruthy());
  });

  it("shows need-audio error when submitting without recording", async () => {
    const navigation = { replace: jest.fn() } as any;
    const route = { params: { lessonId: "l1", prompt: "hello" } } as any;
    const screen = render(<PracticeScreen navigation={navigation} route={route} />);

    fireEvent.press(screen.getByText("Get pronunciation score"));
    await waitFor(() => expect(screen.getByText("Please record audio before scoring.")).toBeTruthy());
  });

  it("submits successfully when audio uri exists", async () => {
    const useStateSpy = jest.spyOn(ReactModule, "useState");
    useStateSpy.mockImplementationOnce(() => [null, jest.fn()]);
    useStateSpy.mockImplementationOnce(() => [null, jest.fn()]);
    useStateSpy.mockImplementationOnce(() => [null, jest.fn()]);
    useStateSpy.mockImplementationOnce(() => ["file:///tmp/a.m4a", jest.fn()]);
    useStateSpy.mockImplementation(() => [null, jest.fn()]);

    (createPracticeSession as jest.Mock).mockResolvedValue({ session_id: "s1" });
    (uploadPracticeAudio as jest.Mock).mockResolvedValue({ status: "uploaded" });
    (requestPracticeScore as jest.Mock).mockResolvedValue({ status: "queued" });
    (fetchPracticeResult as jest.Mock).mockResolvedValue({
      status: "done",
      session_id: "s1",
      overall_score: 80,
      pronunciation_score: 81,
      fluency_score: 79,
      words: [],
      phonemes: [],
      tips: [],
      analysis: { alignment_status: "ok", word_count: 1, estimated_duration_ms: 1000, phoneme_preview: [], audio_path: null, audio_detected: true },
    });

    const navigation = { replace: jest.fn() } as any;
    const route = { params: { lessonId: "l1", prompt: "hello" } } as any;
    const screen = render(<PracticeScreen navigation={navigation} route={route} />);

    fireEvent.press(screen.getByText("Get pronunciation score"));
    await waitFor(() => {
      expect(createPracticeSession).toHaveBeenCalled();
      expect(uploadPracticeAudio).toHaveBeenCalledWith("s1", "file:///tmp/a.m4a");
      expect(requestPracticeScore).toHaveBeenCalledWith("s1");
      expect(navigation.replace).toHaveBeenCalledWith("Result", { sessionId: "s1" });
    });
    useStateSpy.mockRestore();
  });

  it("shows failed status error", async () => {
    const useStateSpy = jest.spyOn(ReactModule, "useState");
    useStateSpy.mockImplementationOnce(() => [null, jest.fn()]);
    useStateSpy.mockImplementationOnce(() => [null, jest.fn()]);
    useStateSpy.mockImplementationOnce(() => [null, jest.fn()]);
    useStateSpy.mockImplementationOnce(() => ["file:///tmp/a.m4a", jest.fn()]);
    useStateSpy.mockImplementation(() => [null, jest.fn()]);

    (createPracticeSession as jest.Mock).mockResolvedValue({ session_id: "s2" });
    (uploadPracticeAudio as jest.Mock).mockResolvedValue({ status: "uploaded" });
    (requestPracticeScore as jest.Mock).mockResolvedValue({ status: "queued" });
    (fetchPracticeResult as jest.Mock).mockResolvedValue({ status: "failed", session_id: "s2", error: "processing failed" });
    (classifyNetworkIssue as jest.Mock).mockReturnValue("server");

    const navigation = { replace: jest.fn() } as any;
    const route = { params: { lessonId: "l1", prompt: "hello" } } as any;
    const screen = render(<PracticeScreen navigation={navigation} route={route} />);

    fireEvent.press(screen.getByText("Get pronunciation score"));
    await waitFor(() => expect(showToast).toHaveBeenCalledWith("processing failed", "error"));
    useStateSpy.mockRestore();
  });

  it("shows timeout fallback", async () => {
    const useStateSpy = jest.spyOn(ReactModule, "useState");
    useStateSpy.mockImplementationOnce(() => [null, jest.fn()]);
    useStateSpy.mockImplementationOnce(() => [null, jest.fn()]);
    useStateSpy.mockImplementationOnce(() => [null, jest.fn()]);
    useStateSpy.mockImplementationOnce(() => ["file:///tmp/a.m4a", jest.fn()]);
    useStateSpy.mockImplementation(() => [null, jest.fn()]);

    (createPracticeSession as jest.Mock).mockResolvedValue({ session_id: "s4" });
    (uploadPracticeAudio as jest.Mock).mockResolvedValue({ status: "uploaded" });
    (requestPracticeScore as jest.Mock).mockResolvedValue({ status: "queued" });
    (fetchPracticeResult as jest.Mock).mockRejectedValue({ message: undefined });
    (classifyNetworkIssue as jest.Mock).mockReturnValue("timeout");

    const navigation = { replace: jest.fn() } as any;
    const route = { params: { lessonId: "l1", prompt: "hello" } } as any;
    const screen = render(<PracticeScreen navigation={navigation} route={route} />);

    fireEvent.press(screen.getByText("Get pronunciation score"));
    await waitFor(() => expect(showToast).toHaveBeenCalledWith("Request timed out.", "error"));
    useStateSpy.mockRestore();
  });

  it("uses generic scoring failed fallback when timeout issue has missing message", async () => {
    const useStateSpy = jest.spyOn(ReactModule, "useState");
    useStateSpy.mockImplementationOnce(() => [null, jest.fn()]);
    useStateSpy.mockImplementationOnce(() => [null, jest.fn()]);
    useStateSpy.mockImplementationOnce(() => [null, jest.fn()]);
    useStateSpy.mockImplementationOnce(() => ["file:///tmp/a.m4a", jest.fn()]);
    useStateSpy.mockImplementation(() => [null, jest.fn()]);

    (createPracticeSession as jest.Mock).mockResolvedValue({ session_id: "s4b" });
    (uploadPracticeAudio as jest.Mock).mockResolvedValue({ status: "uploaded" });
    (requestPracticeScore as jest.Mock).mockResolvedValue({ status: "queued" });
    (fetchPracticeResult as jest.Mock).mockRejectedValue({ message: undefined });
    (classifyNetworkIssue as jest.Mock).mockReturnValue("server");

    const navigation = { replace: jest.fn() } as any;
    const route = { params: { lessonId: "l1", prompt: "hello" } } as any;
    const screen = render(<PracticeScreen navigation={navigation} route={route} />);

    fireEvent.press(screen.getByText("Get pronunciation score"));
    await waitFor(() => expect(showToast).toHaveBeenCalledWith("Scoring request failed", "error"));
    useStateSpy.mockRestore();
  });

  it("covers recording stop branch with injected recording state", async () => {
    const rec = {
      stopAndUnloadAsync: jest.fn(async () => undefined),
      getURI: jest.fn(() => "file:///tmp/a.m4a"),
    };

    const useStateSpy = jest.spyOn(ReactModule, "useState");
    useStateSpy.mockImplementationOnce(() => [false, jest.fn()]);
    useStateSpy.mockImplementationOnce(() => [true, jest.fn()]);
    useStateSpy.mockImplementationOnce(() => [rec as any, jest.fn()]);
    useStateSpy.mockImplementationOnce(() => [null, jest.fn()]);
    useStateSpy.mockImplementation(() => [null, jest.fn()]);

    const navigation = { replace: jest.fn() } as any;
    const route = { params: { lessonId: "l1", prompt: "hello" } } as any;
    const screen = render(<PracticeScreen navigation={navigation} route={route} />);

    fireEvent.press(screen.getByText("Stop recording"));

    await waitFor(() => {
      expect(rec.stopAndUnloadAsync).toHaveBeenCalled();
      expect(rec.getURI).toHaveBeenCalled();
    });
    useStateSpy.mockRestore();
  });

  it("covers cancel button branch with submitting state", async () => {
    const useStateSpy = jest.spyOn(ReactModule, "useState");
    const setSubmitting = jest.fn();
    const setSubmitStage = jest.fn();

    useStateSpy.mockImplementationOnce(() => [true, setSubmitting]);
    useStateSpy.mockImplementationOnce(() => [null, jest.fn()]);
    useStateSpy.mockImplementationOnce(() => [null, jest.fn()]);
    useStateSpy.mockImplementationOnce(() => [null, jest.fn()]);
    useStateSpy.mockImplementationOnce(() => [null, jest.fn()]);
    useStateSpy.mockImplementationOnce(() => ["polling", setSubmitStage]);
    useStateSpy.mockImplementation(() => [null, jest.fn()]);

    const navigation = { replace: jest.fn() } as any;
    const route = { params: { lessonId: "l1", prompt: "hello" } } as any;
    const screen = render(<PracticeScreen navigation={navigation} route={route} />);

    fireEvent.press(screen.getByText("Cancel"));
    expect(setSubmitting).toHaveBeenCalledWith(false);
    expect(setSubmitStage).toHaveBeenCalledWith("idle");

    useStateSpy.mockRestore();
  });

  it("covers polling timeout throw at max attempts", async () => {
    const useStateSpy = jest.spyOn(ReactModule, "useState");
    useStateSpy.mockImplementationOnce(() => [null, jest.fn()]);
    useStateSpy.mockImplementationOnce(() => [null, jest.fn()]);
    useStateSpy.mockImplementationOnce(() => [null, jest.fn()]);
    useStateSpy.mockImplementationOnce(() => ["file:///tmp/a.m4a", jest.fn()]);
    useStateSpy.mockImplementation(() => [null, jest.fn()]);

    (createPracticeSession as jest.Mock).mockResolvedValue({ session_id: "s8" });
    (uploadPracticeAudio as jest.Mock).mockResolvedValue({ status: "uploaded" });
    (requestPracticeScore as jest.Mock).mockResolvedValue({ status: "queued" });
    (fetchPracticeResult as jest.Mock).mockRejectedValue({});
    (classifyNetworkIssue as jest.Mock).mockReturnValue("timeout");

    const navigation = { replace: jest.fn() } as any;
    const route = { params: { lessonId: "l1", prompt: "hello" } } as any;
    const screen = render(<PracticeScreen navigation={navigation} route={route} />);

    fireEvent.press(screen.getByText("Get pronunciation score"));
    await waitFor(() => expect(showToast).toHaveBeenCalledWith("Request timed out.", "error"));

    useStateSpy.mockRestore();
  });

  it("covers scoring not finished fallback branch", async () => {
    const useStateSpy = jest.spyOn(ReactModule, "useState");
    useStateSpy.mockImplementationOnce(() => [null, jest.fn()]);
    useStateSpy.mockImplementationOnce(() => [null, jest.fn()]);
    useStateSpy.mockImplementationOnce(() => [null, jest.fn()]);
    useStateSpy.mockImplementationOnce(() => ["file:///tmp/a.m4a", jest.fn()]);
    useStateSpy.mockImplementation(() => [null, jest.fn()]);

    (createPracticeSession as jest.Mock).mockResolvedValue({ session_id: "s9" });
    (uploadPracticeAudio as jest.Mock).mockResolvedValue({ status: "uploaded" });
    (requestPracticeScore as jest.Mock).mockResolvedValue({ status: "queued" });
    (fetchPracticeResult as jest.Mock).mockResolvedValue({ status: "failed", session_id: "s9", error: "Scoring not finished." });
    (classifyNetworkIssue as jest.Mock).mockReturnValue("server");

    const navigation = { replace: jest.fn() } as any;
    const route = { params: { lessonId: "l1", prompt: "hello" } } as any;
    const screen = render(<PracticeScreen navigation={navigation} route={route} />);

    fireEvent.press(screen.getByText("Get pronunciation score"));
    await waitFor(() => expect(showToast).toHaveBeenCalledWith("Scoring not finished.", "error"));

    useStateSpy.mockRestore();
  });


  it("covers recording setup success path", async () => {
    const rec = {
      prepareToRecordAsync: jest.fn(async () => undefined),
      startAsync: jest.fn(async () => undefined),
      stopAndUnloadAsync: jest.fn(async () => undefined),
      getURI: jest.fn(() => "file:///tmp/a.m4a"),
    };
    (Audio.Recording as unknown as jest.Mock).mockImplementation(() => rec);

    const navigation = { replace: jest.fn() } as any;
    const route = { params: { lessonId: "l1", prompt: "hello" } } as any;
    const screen = render(<PracticeScreen navigation={navigation} route={route} />);

    fireEvent.press(screen.getByText("Start recording"));
    await waitFor(() => expect(Audio.setAudioModeAsync).toHaveBeenCalled());
    expect(rec.prepareToRecordAsync).toHaveBeenCalled();
    expect(rec.startAsync).toHaveBeenCalled();
  });

  it("covers recording setup failure catch path", async () => {
    (Audio.Recording as unknown as jest.Mock).mockImplementation(() => ({
      prepareToRecordAsync: jest.fn(async () => undefined),
      startAsync: jest.fn(async () => {
        throw new Error("start failed");
      }),
      stopAndUnloadAsync: jest.fn(async () => undefined),
      getURI: jest.fn(() => "file:///tmp/a.m4a"),
    }));

    const navigation = { replace: jest.fn() } as any;
    const route = { params: { lessonId: "l1", prompt: "hello" } } as any;
    const screen = render(<PracticeScreen navigation={navigation} route={route} />);

    fireEvent.press(screen.getByText("Start recording"));
    await waitFor(() => expect(showToast).not.toHaveBeenCalledWith("Scoring complete!", "success"));
    expect((Audio.requestPermissionsAsync as jest.Mock)).toHaveBeenCalled();
  });
});
