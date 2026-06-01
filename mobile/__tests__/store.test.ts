import { useAppStore } from "../src/shared/store";

describe("shared/store", () => {
  beforeEach(() => {
    useAppStore.setState({
      streak: 0,
      xp: 0,
      selectedLessonId: "",
      latestSessionId: "",
      accessToken: null,
      latestResult: null,
      locale: "en",
      themeMode: "dark",
      onboardingDone: false,
      onboardingGoal: "daily",
      onboardingLevel: "beginner",
      dailyMinutesTarget: 15,
      authStatus: "idle",
      authMessage: null,
      hapticsEnabled: true,
    } as any);
  });

  it("setAccessToken toggles auth status", () => {
    useAppStore.getState().setAccessToken("token");
    expect(useAppStore.getState().accessToken).toBe("token");
    expect(useAppStore.getState().authStatus).toBe("authenticated");

    useAppStore.getState().setAccessToken(null);
    expect(useAppStore.getState().accessToken).toBeNull();
    expect(useAppStore.getState().authStatus).toBe("idle");
  });

  it("clearSession clears token and marks expired", () => {
    useAppStore.getState().setAccessToken("token");
    useAppStore.getState().setLatestResult({ session_id: "s" } as any);

    useAppStore.getState().clearSession();
    expect(useAppStore.getState().accessToken).toBeNull();
    expect(useAppStore.getState().latestResult).toBeNull();
    expect(useAppStore.getState().authStatus).toBe("expired");
    expect(useAppStore.getState().authMessage).toContain("Session expired");
  });

  it("onboarding actions persist payload", () => {
    useAppStore.getState().completeOnboarding({
      goal: "travel",
      level: "intermediate",
      dailyMinutesTarget: 30,
    });
    expect(useAppStore.getState().onboardingDone).toBe(true);
    expect(useAppStore.getState().onboardingGoal).toBe("travel");
    expect(useAppStore.getState().onboardingLevel).toBe("intermediate");
    expect(useAppStore.getState().dailyMinutesTarget).toBe(30);

    useAppStore.getState().resetOnboarding();
    expect(useAppStore.getState().onboardingDone).toBe(false);
    expect(useAppStore.getState().onboardingGoal).toBe("daily");
    expect(useAppStore.getState().onboardingLevel).toBe("beginner");
    expect(useAppStore.getState().dailyMinutesTarget).toBe(15);
  });

  it("updates simple store fields", () => {
    useAppStore.getState().selectLesson("lesson-2");
    useAppStore.getState().completePractice("session-2");
    useAppStore.getState().setLocale("vi");
    useAppStore.getState().setThemeMode("light");
    useAppStore.getState().setAuthStatus("refreshing", "Refreshing token");
    useAppStore.getState().setHapticsEnabled(false);

    expect(useAppStore.getState().selectedLessonId).toBe("lesson-2");
    expect(useAppStore.getState().latestSessionId).toBe("session-2");
    expect(useAppStore.getState().locale).toBe("vi");
    expect(useAppStore.getState().themeMode).toBe("light");
    expect(useAppStore.getState().authStatus).toBe("refreshing");
    expect(useAppStore.getState().authMessage).toBe("Refreshing token");
    expect(useAppStore.getState().hapticsEnabled).toBe(false);
  });

  it("setAuthStatus defaults message to null", () => {
    useAppStore.getState().setAuthStatus("authenticated");
    expect(useAppStore.getState().authStatus).toBe("authenticated");
    expect(useAppStore.getState().authMessage).toBeNull();
  });
});

