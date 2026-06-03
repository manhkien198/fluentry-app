const fallbackApiUrl = "http://103.45.234.100";

export const appConfig = {
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || fallbackApiUrl,
  appEnv: process.env.EXPO_PUBLIC_APP_ENV || "development",
  googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || "",
  googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || "",
  googleAndroidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || "",
  googleExpoClientId: process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID || "",
  enableMockFallback:
    String(process.env.EXPO_PUBLIC_ENABLE_MOCK_FALLBACK || "false") === "true",
};
