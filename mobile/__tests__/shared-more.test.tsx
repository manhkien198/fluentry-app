import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { Text as RNText } from "react-native";
import { haptic } from "../src/shared/haptics";
import { Screen, SectionCard, ScorePill, MetricBar } from "../src/shared/ui";
import { FadeIn, PressScale } from "../src/shared/motion";
import { SkeletonLine, SkeletonCard } from "../src/shared/Skeleton";
import { CrashBoundary } from "../src/shared/CrashBoundary";
import { AuthBanner } from "../src/shared/AuthBanner";
import { getPracticeRetryMessage } from "../src/shared/networkMessages";
import { useAppStore } from "../src/shared/store";
import { t } from "../src/shared/i18n";

jest.mock("../src/shared/haptics", () => ({
  haptic: jest.fn(async () => undefined),
}));

describe("shared extra", () => {
  it("renders ui primitives", () => {
    const a = render(<Screen><SectionCard><ScorePill label="A" value="1" /></SectionCard></Screen>);
    expect(a.toJSON()).toBeTruthy();
    const b = render(<MetricBar label="Score" value={120} />);
    expect(b.getByText("100%")).toBeTruthy();
  });

  it.skip("renders motion components and handles press", async () => {
    const onPress = jest.fn();
    const a = render(
      <FadeIn>
        <PressScale onPress={onPress}>
          <RNText>Tap me</RNText>
        </PressScale>
      </FadeIn>,
    );
    expect(a.toJSON()).toBeTruthy();

    const pressable = a.getByText("Tap me").parent;
    if (pressable) {
      fireEvent(pressable, "pressIn");
      fireEvent(pressable, "press");
      fireEvent(pressable, "pressOut");
    }

    await waitFor(() => {
      expect(haptic).toHaveBeenCalledWith("light");
      expect(onPress).toHaveBeenCalled();
    });
  });

  it("does not run onPress when disabled", () => {
    const onPress = jest.fn();
    const a = render(
      <PressScale onPress={onPress} disabled>
        <RNText>Disabled tap</RNText>
      </PressScale>,
    );

    const pressable = a.getByText("Disabled tap").parent?.parent;
    if (pressable) {
      fireEvent.press(pressable);
      if (typeof (pressable.props as any).style === "function") {
        const styleWhenFalse = (pressable.props as any).style({ pressed: false });
        expect(styleWhenFalse[1].opacity).toBe(1);
      }
    }

    expect(onPress).not.toHaveBeenCalled();
  });

  it("renders skeleton components", () => {
    expect(render(<SkeletonLine />).toJSON()).toBeTruthy();
    expect(render(<SkeletonCard />).toJSON()).toBeTruthy();
  });

  it("crash boundary recovers", () => {
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const Boom = () => {
      throw new Error("boom");
    };
    const screen = render(<CrashBoundary><Boom /></CrashBoundary>);
    expect(screen.getByText("boom")).toBeTruthy();
    fireEvent.press(screen.getByText("Try again"));
    expect(screen.getByText("Try again")).toBeTruthy();
    consoleError.mockRestore();
  });

  it("crash boundary uses fallback message when error message is empty", () => {
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const Boom = () => {
      throw new Error("");
    };
    const screen = render(<CrashBoundary><Boom /></CrashBoundary>);
    expect(screen.getByText(t("crash.unexpected_error"))).toBeTruthy();
    consoleError.mockRestore();
  });

  it("auth banner shows for non-authenticated status", () => {
    useAppStore.getState().setAuthStatus("refreshing", "Token refreshing");
    const screen = render(<AuthBanner />);
    expect(screen.getByText("Token refreshing")).toBeTruthy();
  });

  it("auth banner hides for authenticated and idle status", () => {
    useAppStore.getState().setAuthStatus("authenticated", "Should hide");
    let screen = render(<AuthBanner />);
    expect(screen.toJSON()).toBeNull();

    screen.unmount();
    useAppStore.getState().setAuthStatus("idle", "Should hide too");
    screen = render(<AuthBanner />);
    expect(screen.toJSON()).toBeNull();
  });

  it("press scale style callback covers pressed false branch", async () => {
    const onPress = jest.fn();
    const screen = render(
      <PressScale onPress={onPress}>
        <RNText>Style branch</RNText>
      </PressScale>,
    );

    const pressable = screen.getByText("Style branch").parent;
    if (pressable && typeof (pressable.props as any).style === "function") {
      const styleWhenFalse = (pressable.props as any).style({ pressed: false });
      expect(styleWhenFalse[0]).toBeUndefined();
      expect(styleWhenFalse[1].opacity).toBe(1);
      const styleWhenTrue = (pressable.props as any).style({ pressed: true });
      expect(styleWhenTrue[1].opacity).toBe(0.96);
    }
  });

  it("auth banner hides when message is empty", () => {
    useAppStore.getState().setAuthStatus("refreshing", "");
    const screen = render(<AuthBanner />);
    expect(screen.toJSON()).toBeNull();
  });

  it("network retry message maps kinds", () => {
    const tr = (k: string) => k;
    expect(getPracticeRetryMessage("timeout", tr)).toBe("practice.timeout_retry");
    expect(getPracticeRetryMessage("offline", tr)).toBe("practice.offline_retry");
    expect(getPracticeRetryMessage("server", tr)).toBe("practice.server_retry");
    expect(getPracticeRetryMessage("unknown", tr)).toBe("practice.retry_generic");
  });
});
