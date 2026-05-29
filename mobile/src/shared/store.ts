import { create } from "zustand";
import { PracticeResult } from "./api";

type OnboardingPayload = {
  goal: string;
  level: string;
  dailyMinutesTarget: number;
};

export type AuthStatus = "idle" | "refreshing" | "authenticated" | "expired";

type AppState = {
  themeMode: "light" | "dark";
  streak: number;
  xp: number;
  selectedLessonId: string;
  latestSessionId: string;
  accessToken: string | null;
  latestResult: PracticeResult | null;
  locale: "en" | "vi";
  onboardingDone: boolean;
  onboardingGoal: string;
  onboardingLevel: string;
  dailyMinutesTarget: number;
  authStatus: AuthStatus;
  authMessage: string | null;
  hapticsEnabled: boolean;
  setHapticsEnabled: (enabled: boolean) => void;
  selectLesson: (lessonId: string) => void;
  completePractice: (sessionId: string) => void;
  setAccessToken: (token: string | null) => void;
  clearSession: () => void;
  setLatestResult: (result: PracticeResult | null) => void;
  setLocale: (locale: "en" | "vi") => void;
  setThemeMode: (mode: "light" | "dark") => void;
  setAuthStatus: (status: AuthStatus, message?: string | null) => void;
  completeOnboarding: (payload: OnboardingPayload) => void;
  resetOnboarding: () => void;
};

export const useAppStore = create<AppState>((set) => ({
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
  selectLesson: (selectedLessonId) => set({ selectedLessonId }),
  completePractice: (latestSessionId) => set({ latestSessionId }),
  setAccessToken: (accessToken) =>
    set({
      accessToken,
      authStatus: accessToken ? "authenticated" : "idle",
      authMessage: null,
    }),
  clearSession: () =>
    set({
      accessToken: null,
      latestResult: null,
      authStatus: "expired",
      authMessage: "Session expired. Please sign in again.",
    }),
  setLatestResult: (latestResult) => set({ latestResult }),
  setLocale: (locale) => set({ locale }),
  setThemeMode: (themeMode) => set({ themeMode }),
  setAuthStatus: (authStatus, authMessage = null) =>
    set({ authStatus, authMessage }),
  setHapticsEnabled: (hapticsEnabled) => set({ hapticsEnabled }),
  completeOnboarding: ({ goal, level, dailyMinutesTarget }) =>
    set({
      onboardingDone: true,
      onboardingGoal: goal,
      onboardingLevel: level,
      dailyMinutesTarget,
    }),
  resetOnboarding: () =>
    set({
      onboardingDone: false,
      onboardingGoal: "daily",
      onboardingLevel: "beginner",
      dailyMinutesTarget: 15,
    }),
}));
