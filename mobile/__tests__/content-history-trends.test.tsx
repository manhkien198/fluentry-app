import { render, waitFor, fireEvent, act } from "@testing-library/react-native";
import { TextInput } from "react-native";

jest.mock("../src/shared/useAppColors", () => ({
  useAppColors: () => ({
    text: "#fff",
    muted: "#aaa",
    surface: "#111",
    surfaceAlt: "#222",
    primary: "#0ff",
    warning: "#ff0",
  }),
}));

jest.mock("../src/shared/ui", () => {
  const { View } = require("react-native");
  return {
    Screen: ({ children }: any) => <View>{children}</View>,
    SectionCard: ({ children }: any) => <View>{children}</View>,
  };
});

jest.mock("../src/shared/Skeleton", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return {
    SkeletonLine: () => <Text>SkeletonLine</Text>,
  };
});

jest.mock("../src/shared/motion", () => {
  const { View } = require("react-native");
  return {
    FadeIn: ({ children }: any) => <View>{children}</View>,
    PressScale: ({ children }: any) => <View>{children}</View>,
  };
});

jest.mock("../src/shared/api", () => ({
  fetchContentVersion: jest.fn(),
  fetchUserHistory: jest.fn(),
  api: { get: jest.fn() },
}));

import { ContentInfoScreen } from "../src/features/home/ContentInfoScreen";

beforeEach(() => {
  jest.useRealTimers();
});

afterEach(() => {
  jest.clearAllMocks();
});


import { HistoryScreen } from "../src/features/progress/HistoryScreen";
import { TrendsScreen } from "../src/features/progress/TrendsScreen";
import { fetchContentVersion, fetchUserHistory, api } from "../src/shared/api";

describe("ContentInfoScreen", () => {
  it("renders version payload", async () => {
    (fetchContentVersion as jest.Mock).mockResolvedValue({
      version: "v1",
      checksum: "abc",
      updated_at: "now",
    });
    const screen = render(<ContentInfoScreen />);
    await waitFor(() => expect(screen.getByText(/v1/)).toBeTruthy());
  });

  it("falls back to n/a when api fails", async () => {
    (fetchContentVersion as jest.Mock).mockRejectedValue(new Error("boom"));
    const screen = render(<ContentInfoScreen />);
    await waitFor(() => expect(screen.getAllByText(/n\/a/i).length).toBeGreaterThan(0));
  });

  it("uses empty object when content version resolves undefined", async () => {
    (fetchContentVersion as jest.Mock).mockResolvedValue(undefined);
    const screen = render(<ContentInfoScreen />);
    await waitFor(() => expect(screen.getAllByText(/n\/a/i).length).toBeGreaterThan(0));
  });

  it("handles unmount before content version resolves", async () => {
    let resolveLater!: (value: any) => void;
    (fetchContentVersion as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveLater = resolve;
      }),
    );

    const screen = render(<ContentInfoScreen />);
    screen.unmount();
    resolveLater({ version: "v-late" });
  });
});

describe("HistoryScreen", () => {
  it("renders history list and filters", async () => {
    (fetchUserHistory as jest.Mock).mockResolvedValue({
      items: [
        { session_id: "s1", lesson_title: "Intro", overall_score: 80 },
        { session_id: "s2", lesson_title: "Travel", overall_score: 75 },
        { session_id: "s3", lesson_title: "", overall_score: 70 },
      ],
    });
    const screen = render(<HistoryScreen />);

    await waitFor(() => expect(screen.getByText("Intro")).toBeTruthy());
    fireEvent.changeText(screen.UNSAFE_getByType(TextInput), "travel");
    expect(screen.getByText("Travel")).toBeTruthy();

    fireEvent.changeText(screen.UNSAFE_getByType(TextInput), "s3");
    expect(screen.getByText("Lesson")).toBeTruthy();
  });

  it("shows load error when fetch fails", async () => {
    (fetchUserHistory as jest.Mock).mockRejectedValue(new Error("boom"));
    const screen = render(<HistoryScreen />);
    await waitFor(() => {
      expect(screen.getByText("Unable to load history. Pull to refresh.")).toBeTruthy();
    });
  });

  it("refreshes history list on pull-to-refresh", async () => {
    (fetchUserHistory as jest.Mock)
      .mockResolvedValueOnce({ items: [{ session_id: "s1", lesson_title: "Intro", overall_score: 80 }] })
      .mockResolvedValueOnce({ items: [{ session_id: "s2", lesson_title: "Travel", overall_score: 75 }] });

    const screen = render(<HistoryScreen />);
    await waitFor(() => expect(screen.getByText("Intro")).toBeTruthy());

    const list = screen.UNSAFE_getByType(require("react-native").FlatList);
    await act(async () => {
      await list.props.onRefresh();
    });

    await waitFor(() => expect(screen.getByText("Travel")).toBeTruthy());
  });
});

describe("TrendsScreen", () => {
  it("renders trends payload and achievements", async () => {
    (api.get as jest.Mock).mockResolvedValue({
      data: {
        trend: { overall: [1, 2], pronunciation: [3], fluency: [4] },
        achievements: [{ id: "a1", title: "Streak", value: "3d" }],
        today_minutes: 5,
        daily_target_minutes: 15,
      },
    });
    const screen = render(<TrendsScreen />);

    await waitFor(() => expect(screen.getByText(/Streak/)).toBeTruthy());
  });

  it("renders no achievements fallback", async () => {
    (api.get as jest.Mock).mockRejectedValue(new Error("boom"));
    const screen = render(<TrendsScreen />);
    await waitFor(() => {
      expect(screen.getByText("No achievements yet.")).toBeTruthy();
    });
  });

  it("handles unmount before trends request resolves", async () => {
    let rejectLater!: (reason?: unknown) => void;
    (api.get as jest.Mock).mockReturnValue(
      new Promise((_, reject) => {
        rejectLater = reject;
      }),
    );

    const screen = render(<TrendsScreen />);
    screen.unmount();
    rejectLater(new Error("late"));
  });
});
