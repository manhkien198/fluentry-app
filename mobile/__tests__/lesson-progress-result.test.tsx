import { render, fireEvent, waitFor } from "@testing-library/react-native";

jest.mock("@tanstack/react-query", () => ({
  useQuery: jest.fn(),
}));

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
  const { View, Text } = require("react-native");
  return {
    Screen: ({ children }: any) => <View>{children}</View>,
    SectionCard: ({ children }: any) => <View>{children}</View>,
    ScorePill: ({ label, value }: any) => <Text>{`${label}:${value}`}</Text>,
    MetricBar: ({ label, value }: any) => <Text>{`${label}:${value}`}</Text>,
  };
});

jest.mock("../src/shared/Skeleton", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return { SkeletonCard: () => <Text>Skeleton</Text> };
});

jest.mock("../src/shared/api", () => ({
  fetchUserProgress: jest.fn(),
  fetchUserHistory: jest.fn(),
  fetchLessonById: jest.fn(),
}));

import { useQuery } from "@tanstack/react-query";
import { useAppStore } from "../src/shared/store";
import { fetchUserProgress, fetchUserHistory, fetchLessonById } from "../src/shared/api";
import { LessonScreen } from "../src/features/lesson/LessonScreen";
import { ProgressScreen } from "../src/features/progress/ProgressScreen";
import { ResultScreen } from "../src/features/result/ResultScreen";

describe("LessonScreen", () => {
  beforeEach(() => {
    (useQuery as jest.Mock).mockReset();
  });

  it("shows loading state", () => {
    (useQuery as jest.Mock)
      .mockReturnValueOnce({ isLoading: true })
      .mockReturnValueOnce({ data: { pronunciation_score: 0, fluency_score: 0, confidence_score: 0 } });

    const screen = render(
      <LessonScreen
        navigation={{ navigate: jest.fn() } as any}
        route={{ params: { lessonId: "l1" } } as any}
      />,
    );

    expect(screen.getByText("Loading...")).toBeTruthy();
  });

  it("shows error and retry", () => {
    const refetch = jest.fn();
    (useQuery as jest.Mock)
      .mockReturnValueOnce({ isLoading: false, isError: true, data: null, refetch })
      .mockReturnValueOnce({ data: { pronunciation_score: 0, fluency_score: 0, confidence_score: 0 } });

    const screen = render(
      <LessonScreen
        navigation={{ navigate: jest.fn() } as any}
        route={{ params: { lessonId: "l1" } } as any}
      />,
    );

    fireEvent.press(screen.getByText("Retry"));
    expect(refetch).toHaveBeenCalled();
  });

  it("handles empty lesson id in query key path", () => {
    (useQuery as jest.Mock)
      .mockReturnValueOnce({ isLoading: false, isError: true, data: null, refetch: jest.fn() })
      .mockReturnValueOnce({ data: { pronunciation_score: 0, fluency_score: 0, confidence_score: 0 } });

    const screen = render(
      <LessonScreen
        navigation={{ navigate: jest.fn() } as any}
        route={{ params: { lessonId: "" } } as any}
      />,
    );

    expect(screen.getByText("n/a")).toBeTruthy();
  });

  it("navigates to practice on success", () => {
    (useQuery as jest.Mock)
      .mockReturnValueOnce({
        isLoading: false,
        isError: false,
        data: { id: "l1", level: "A1", title: "Intro", prompt: "hello", duration_minutes: 10, xp: 20 },
      })
      .mockReturnValueOnce({ data: { pronunciation_score: 60, fluency_score: 70, confidence_score: 80 } });

    const navigation = { navigate: jest.fn() } as any;
    const screen = render(
      <LessonScreen navigation={navigation} route={{ params: { lessonId: "l1" } } as any} />,
    );

    expect(screen.getByText("Pronunciation:60")).toBeTruthy();
    expect(screen.getByText("Stress & rhythm:70")).toBeTruthy();
    expect(screen.getByText("Confidence:80")).toBeTruthy();

    fireEvent.press(screen.getByText("Start practice"));
    expect(navigation.navigate).toHaveBeenCalledWith("Practice", { lessonId: "l1", prompt: "hello" });
  });

  it("uses zero fallback for missing progress scores", () => {
    (useQuery as jest.Mock)
      .mockReturnValueOnce({
        isLoading: false,
        isError: false,
        data: { id: "l1", level: "A1", title: "Intro", prompt: "hello", duration_minutes: 10, xp: 20 },
      })
      .mockReturnValueOnce({ data: {} });

    const screen = render(
      <LessonScreen navigation={{ navigate: jest.fn() } as any} route={{ params: { lessonId: "l1" } } as any} />,
    );

    expect(screen.getByText("Pronunciation:0")).toBeTruthy();
    expect(screen.getByText("Stress & rhythm:0")).toBeTruthy();
    expect(screen.getByText("Confidence:0")).toBeTruthy();
  });


  it("passes lessonId into lesson queryFn", async () => {
    const queryFnHolder: { fn?: () => Promise<unknown> } = {};
    (useQuery as jest.Mock)
      .mockImplementationOnce(({ queryFn }: any) => {
        queryFnHolder.fn = queryFn;
        return {
          isLoading: false,
          isError: false,
          data: { id: "l1", level: "A1", title: "Intro", prompt: "hello", duration_minutes: 10, xp: 20 },
        };
      })
      .mockReturnValueOnce({ data: { pronunciation_score: 60, fluency_score: 70, confidence_score: 80 } });

    (fetchLessonById as jest.Mock).mockResolvedValueOnce({ id: "l1" });

    render(<LessonScreen navigation={{ navigate: jest.fn() } as any} route={{ params: { lessonId: "l1" } } as any} />);

    await queryFnHolder.fn?.();
    expect(fetchLessonById).toHaveBeenCalledWith("l1");
  });

});

describe("ProgressScreen", () => {
  beforeEach(() => {
    (fetchUserProgress as jest.Mock).mockReset();
    (fetchUserHistory as jest.Mock).mockReset();
  });

  it("loads progress with fallback values and supports history/trends nav", async () => {
    (fetchUserProgress as jest.Mock).mockResolvedValue({
      streak: undefined,
      xp: undefined,
      level: undefined,
      pronunciation_score: undefined,
      fluency_score: undefined,
      confidence_score: undefined,
      weak_sounds: undefined,
      session_count: undefined,
    });
    (fetchUserHistory as jest.Mock).mockResolvedValue({ items: [{ session_id: "s1" }] });

    const navigation = { navigate: jest.fn() } as any;
    const screen = render(<ProgressScreen navigation={navigation} route={{} as any} />);

    await waitFor(() => {
      expect(screen.getByText("View history")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("View history"));
    fireEvent.press(screen.getByText("View trends"));

    expect(navigation.navigate).toHaveBeenCalledWith("History");
    expect(navigation.navigate).toHaveBeenCalledWith("Trends");
  });

  it("uses history length when progress session_count is missing", async () => {
    (fetchUserProgress as jest.Mock).mockResolvedValue({
      streak: 1,
      xp: 10,
      level: "A1",
      pronunciation_score: 50,
      fluency_score: 52,
      confidence_score: 55,
      weak_sounds: [],
      session_count: undefined,
    });
    (fetchUserHistory as jest.Mock).mockResolvedValue({ items: [{ session_id: "s1" }, { session_id: "s2" }] });

    const screen = render(<ProgressScreen navigation={{ navigate: jest.fn() } as any} route={{} as any} />);
    await waitFor(() => expect(screen.getByText(/Completed sessions: 2/i)).toBeTruthy());
  });

  it("falls back to zero history count when history items missing", async () => {
    (fetchUserProgress as jest.Mock).mockResolvedValue({
      streak: 1,
      xp: 10,
      level: "A1",
      pronunciation_score: 50,
      fluency_score: 52,
      confidence_score: 55,
      weak_sounds: [],
      session_count: undefined,
    });
    (fetchUserHistory as jest.Mock).mockResolvedValue({});

    const screen = render(<ProgressScreen navigation={{ navigate: jest.fn() } as any} route={{} as any} />);
    await waitFor(() => expect(screen.getByText(/Completed sessions: 0/i)).toBeTruthy());
  });

  it("renders weak sounds list", async () => {
    (fetchUserProgress as jest.Mock).mockResolvedValue({
      streak: 2,
      xp: 30,
      level: "A2",
      pronunciation_score: 70,
      fluency_score: 72,
      confidence_score: 68,
      weak_sounds: ["th", "r"],
      session_count: 5,
    });
    (fetchUserHistory as jest.Mock).mockResolvedValue({ items: [{ session_id: "s1" }] });

    const screen = render(<ProgressScreen navigation={{ navigate: jest.fn() } as any} route={{} as any} />);
    await waitFor(() => expect(screen.getByText("• th")).toBeTruthy());
  });

  it("handles unmount before progress request settles", async () => {
    let resolveProgress!: (v: any) => void;
    (fetchUserProgress as jest.Mock).mockReturnValue(new Promise((resolve) => { resolveProgress = resolve; }));
    (fetchUserHistory as jest.Mock).mockResolvedValue({ items: [{ session_id: "s1" }] });

    const screen = render(<ProgressScreen navigation={{ navigate: jest.fn() } as any} route={{} as any} />);
    screen.unmount();
    resolveProgress({ streak: 1, xp: 1, level: "A1" });
  });

  it("loads progress and supports history/trends nav", async () => {
    (fetchUserProgress as jest.Mock).mockResolvedValue({
      streak: 2,
      xp: 30,
      level: "A2",
      pronunciation_score: 70,
      fluency_score: 72,
      confidence_score: 68,
      weak_sounds: ["th", "r"],
      session_count: 5,
    });
    (fetchUserHistory as jest.Mock).mockResolvedValue({ items: [{ session_id: "s1" }] });

    const navigation = { navigate: jest.fn() } as any;
    const screen = render(<ProgressScreen navigation={navigation} route={{} as any} />);

    await waitFor(() => {
      expect(screen.getByText("View history")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("View history"));
    fireEvent.press(screen.getByText("View trends"));

    expect(navigation.navigate).toHaveBeenCalledWith("History");
    expect(navigation.navigate).toHaveBeenCalledWith("Trends");
  });

  it("shows load error text", async () => {
    (fetchUserProgress as jest.Mock).mockRejectedValue(new Error("boom"));
    (fetchUserHistory as jest.Mock).mockResolvedValue({ items: [] });

    const screen = render(<ProgressScreen navigation={{ navigate: jest.fn() } as any} route={{} as any} />);

    await waitFor(() => {
      expect(screen.getByText("Unable to load progress.")).toBeTruthy();
    });
  });

  it("handles unmount before progress request settles", async () => {
    let release!: (value: any) => void;
    (fetchUserProgress as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    (fetchUserHistory as jest.Mock).mockResolvedValue({ items: [{ session_id: "s1" }] });

    const screen = render(<ProgressScreen navigation={{ navigate: jest.fn() } as any} route={{} as any} />);
    screen.unmount();
    await release({ streak: 1, xp: 1, level: "A1" });
  });
});

describe("ResultScreen", () => {
  it("shows fallback when no result", () => {
    useAppStore.setState({ latestResult: null } as any);
    const navigation = { replace: jest.fn(), navigate: jest.fn() } as any;
    const screen = render(<ResultScreen navigation={navigation} route={{} as any} />);

    fireEvent.press(screen.getByText("Back to home"));
    expect(navigation.replace).toHaveBeenCalledWith("Home");
  });

  it("renders result details and navigates", () => {
    useAppStore.setState({
      latestResult: {
        overall_score: 85,
        pronunciation_score: 84,
        fluency_score: 86,
        words: [{ text: "hello", score: 85, status: "good" }],
        tips: ["Tip one"],
        phonemes: [{ symbol: "HH", word: "hello", score: 80, tip: "steady" }],
        analysis: { alignment_status: "mfa", word_count: 2, estimated_duration_ms: 1200 },
      },
    } as any);

    const navigation = { replace: jest.fn(), navigate: jest.fn() } as any;
    const screen = render(<ResultScreen navigation={navigation} route={{} as any} />);

    fireEvent.press(screen.getAllByText("View progress")[0]);
    fireEvent.press(screen.getAllByText("Back to home")[0]);

    expect(navigation.navigate).toHaveBeenCalledWith("Progress");
    expect(navigation.navigate).toHaveBeenCalledWith("Home");
  });

  it("renders phoneme empty and non-good word branches", () => {
    useAppStore.setState({
      latestResult: {
        overall_score: 70,
        pronunciation_score: undefined,
        fluency_score: undefined,
        words: [{ text: "world", score: 40, status: "warning" }],
        tips: ["Tip two"],
        phonemes: [],
        analysis: { alignment_status: "", word_count: 0, estimated_duration_ms: 0 },
      },
    } as any);

    const navigation = { replace: jest.fn(), navigate: jest.fn() } as any;
    const screen = render(<ResultScreen navigation={navigation} route={{} as any} />);

    expect(screen.getByText(/No phoneme details yet\./)).toBeTruthy();
    expect(screen.getByText("world")).toBeTruthy();
    expect(screen.getByText(/Duration: 0 ms/)).toBeTruthy();
  });

  it("renders phoneme tip empty and fallback analysis values", () => {
    useAppStore.setState({
      latestResult: {
        overall_score: 60,
        pronunciation_score: 50,
        fluency_score: 70,
        words: [{ text: "cat", score: 50, status: "good" }],
        tips: ["Tip three"],
        phonemes: [{ symbol: "K", word: null, score: 55, tip: null }],
        analysis: undefined,
      },
    } as any);

    const navigation = { replace: jest.fn(), navigate: jest.fn() } as any;
    const screen = render(<ResultScreen navigation={navigation} route={{} as any} />);

    expect(screen.getByText(/K \(n\/a\) · 55%/)).toBeTruthy();
    expect(screen.getByText(/Alignment: n\/a/)).toBeTruthy();
    expect(screen.getByText(/Words detected: 0/)).toBeTruthy();
  });
});
