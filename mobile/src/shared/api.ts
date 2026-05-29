import axios from "axios";
import { appConfig } from "./config";
import { useAppStore } from "./store";
import {
  clearAuthTokens,
  loadRefreshToken,
  saveAccessToken,
  saveRefreshToken,
} from "./authStorage";

export const api = axios.create({
  baseURL: appConfig.apiBaseUrl,
  timeout: 10000,
});

const scoreRequestConfig = { timeout: 180000 };
const resultRequestConfig = { timeout: 180000 };
let refreshInFlight: Promise<string | null> | null = null;

function isRetryableError(error: unknown) {
  if (axios.isAxiosError(error))
    return !error.response || error.code === "ECONNABORTED";
  if (typeof error === "object" && error !== null)
    return (error as { code?: string }).code === "ECONNABORTED";
  return false;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 1,
  baseDelayMs = 500,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === retries || !isRetryableError(error)) throw error;
      await delay(baseDelayMs * (attempt + 1));
    }
  }
  throw lastError;
}

export type NetworkIssueKind = "timeout" | "offline" | "server" | "unknown";

export function getErrorMessage(error: unknown): string | null {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { detail?: unknown; message?: unknown }
      | undefined;
    const detail = data?.detail;
    if (typeof detail === "string" && detail.trim()) return detail;
    const message = data?.message;
    if (typeof message === "string" && message.trim()) return message;
  }

  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }

  return null;
}

export function classifyNetworkIssue(error: unknown): NetworkIssueKind {
  if (!axios.isAxiosError(error)) return "unknown";
  if (error.code === "ECONNABORTED") return "timeout";
  if (!error.response) return "offline";
  if (error.response.status >= 500) return "server";
  return "unknown";
}

async function tryRefreshAccessToken() {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshToken = await loadRefreshToken();
    if (!refreshToken) return null;

    useAppStore.getState().setAuthStatus("refreshing", "Refreshing session...");

    let attempts = 0;
    const maxAttempts = 3;
    while (attempts < maxAttempts) {
      attempts += 1;
      try {
        const response = await axios.post<AuthResponse>(
          `${appConfig.apiBaseUrl}/auth/refresh`,
          {
            refresh_token: refreshToken,
          },
        );
        const nextAccessToken = response.data.access_token;
        if (!nextAccessToken) return null;

        useAppStore.getState().setAccessToken(nextAccessToken);
        useAppStore.getState().setAuthStatus("authenticated", null);
        await saveAccessToken(nextAccessToken);
        if (response.data.refresh_token)
          await saveRefreshToken(response.data.refresh_token);
        return nextAccessToken;
      } catch (error) {
        const retryable = isRetryableError(error);
        if (!retryable || attempts >= maxAttempts) break;
        await delay(300 * 2 ** attempts);
      }
    }

    useAppStore
      .getState()
      .setAuthStatus(
        "expired",
        "Session refresh failed. Please sign in again.",
      );
    return null;
  })();

  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

api.interceptors.request.use((config) => {
  const { accessToken } = useAppStore.getState();
  config.baseURL = appConfig.apiBaseUrl;
  if (accessToken) {
    (config.headers as any) = config.headers ?? {};
    (config.headers as any).Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest: any = error?.config;
    const isUnauthorized =
      axios.isAxiosError(error) && error.response?.status === 401;

    if (isUnauthorized && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      const nextAccessToken = await tryRefreshAccessToken();
      if (nextAccessToken) {
        originalRequest.headers = originalRequest.headers ?? {};
        originalRequest.headers.Authorization = `Bearer ${nextAccessToken}`;
        return api.request(originalRequest);
      }
    }

    if (isUnauthorized) {
      try {
        await clearAuthTokens();
      } finally {
        useAppStore.getState().clearSession();
      }
    }

    return Promise.reject(error);
  },
);

export type Lesson = {
  id: string;
  title: string;
  level: string;
  duration_minutes: number;
  xp: number;
  prompt: string;
};
export type PracticeWord = { text: string; score: number; status: string };
export type PracticeAnalysis = {
  alignment_status: string;
  word_count: number;
  estimated_duration_ms: number;
  phoneme_preview: { word: string; phonemes: string[] }[];
  audio_path: string | null;
  audio_detected: boolean;
  engine_meta?: Record<string, unknown>;
};
export type PracticePhoneme = {
  symbol: string;
  word: string | null;
  start_ms: number;
  end_ms: number;
  duration_ms: number;
  score: number;
  status: string;
  issue: string | null;
  tip: string | null;
};
export type WordFeedbackSpan = {
  start: number;
  end: number;
  severity: "warning" | "danger";
};
export type WordFeedback = { word: string; spans: WordFeedbackSpan[] };
export type PracticeResult = {
  session_id: string;
  overall_score: number;
  pronunciation_score: number;
  fluency_score: number;
  words: PracticeWord[];
  phonemes: PracticePhoneme[];
  word_feedback?: WordFeedback[];
  tips: string[];
  analysis: PracticeAnalysis;
};
export type PracticeResultResponse =
  | { session_id: string; status: "processing" }
  | { session_id: string; status: "failed"; error?: string | null }
  | ({ session_id: string; status: "done" } & PracticeResult);

export type AuthResponse = {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  user?: { id: string; email: string; display_name: string };
};
export type EmailAuthPayload = { email: string; password: string };

export async function fetchLessons() {
  const response = await api.get<{ items: Lesson[] }>("/lessons");
  return response.data.items;
}

export async function fetchLessonById(lessonId: string) {
  try {
    const response = await api.get<Lesson>(`/lessons/${lessonId}`);
    return response.data;
  } catch {
    const lessons = await fetchLessons();
    const lesson = lessons.find((item) => item.id === lessonId);
    if (!lesson) {
      throw new Error("Lesson not found");
    }
    return lesson;
  }
}

export async function createPracticeSession(payload: {
  lesson_id: string;
  expected_text: string;
}) {
  const response = await api.post<{ session_id: string }>(
    "/practice/sessions",
    payload,
  );
  return response.data;
}

export async function uploadPracticeAudio(sessionId: string, fileUri: string) {
  const formData = new FormData();
  formData.append("file", {
    uri: fileUri,
    name: "recording.m4a",
    type: "audio/m4a",
  } as any);

  return withRetry(
    async () => {
      const response = await api.post(
        `/practice/sessions/${sessionId}/upload-audio`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
          timeout: 60000,
        },
      );
      return response.data;
    },
    2,
    700,
  );
}

export async function requestPracticeScore(sessionId: string) {
  return withRetry(
    async () => {
      const response = await api.post(
        `/practice/sessions/${sessionId}/score`,
        undefined,
        scoreRequestConfig,
      );
      return response.data;
    },
    1,
    700,
  );
}

export async function fetchPracticeResult(sessionId: string) {
  return withRetry(
    async () => {
      const response = await api.get<PracticeResultResponse>(
        `/practice/sessions/${sessionId}/result`,
        resultRequestConfig,
      );
      return response.data;
    },
    1,
    700,
  );
}

export async function loginWithEmail(payload: EmailAuthPayload) {
  const response = await api.post<AuthResponse>("/auth/login", payload);
  return response.data;
}

export async function registerWithEmail(payload: EmailAuthPayload) {
  const response = await api.post<{
    status: string;
    verificationToken?: string;
  }>("/auth/register", payload);
  return response.data;
}

export async function verifyEmail(token: string) {
  const response = await api.post<{ status: string }>("/auth/verify-email", {
    token,
  });
  return response.data;
}

export async function resendVerification(email: string) {
  const response = await api.post<{ status: string; token?: string }>(
    "/auth/resend-verification",
    { email },
  );
  return response.data;
}

export async function loginWithSSO(
  provider: "google" | "apple",
  idToken: string,
) {
  const response = await api.post<AuthResponse>("/auth/sso", {
    provider,
    id_token: idToken,
  });
  return response.data;
}

export type UserProgressResponse = {
  streak: number;
  xp: number;
  level: string;
  pronunciation_score: number;
  fluency_score: number;
  confidence_score: number;
  weak_sounds: string[];
  session_count: number;
};

export type UserHistoryItem = {
  session_id: string;
  overall_score: number;
  lesson_title: string;
};

export type UserHistoryResponse = {
  items: UserHistoryItem[];
};

export async function fetchUserProgress() {
  const response = await api.get<UserProgressResponse>("/users/me/progress");
  return response.data;
}

export async function fetchUserHistory() {
  const response = await api.get<UserHistoryResponse>("/users/me/history");
  return response.data;
}

export async function requestPasswordReset(email: string) {
  const response = await api.post<{ status: string }>("/auth/forgot-password", {
    email,
  });
  return response.data;
}

export async function confirmPasswordReset(payload: {
  token: string;
  new_password: string;
}) {
  const response = await api.post<{ status: string }>(
    "/auth/reset-password",
    payload,
  );
  return response.data;
}

export type DrillItem = {
  id: string;
  sound: string;
  mode: string;
  title: string;
  prompt: string;
  lesson_id: string;
};

export type DrillListResponse = {
  items: DrillItem[];
};

export async function fetchDrills(params?: {
  sound?: string;
  mode?: string;
  limit?: number;
}) {
  const response = await api.get<DrillListResponse>("/drills", { params });
  return response.data;
}

export async function fetchContentVersion() {
  const response = await api.get<{
    version?: string;
    checksum?: string;
    updated_at?: string;
  }>("/content/version");
  return response.data;
}
