import React, { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  ActivityIndicator,
  Button,
  Text,
  TextInput,
} from "react-native-paper";
import { Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import { RootStackParamList } from "../../navigation/types";
import {
  classifyNetworkIssue,
  confirmPasswordReset,
  getErrorMessage,
  loginWithEmail,
  loginWithSSO,
  registerWithEmail,
  requestPasswordReset,
} from "../../shared/api";
import { appConfig } from "../../shared/config";
import { spacing, typography } from "../../shared/theme";
import { useAppStore } from "../../shared/store";
import { useAppColors } from "../../shared/useAppColors";
import { saveAccessToken, saveRefreshToken } from "../../shared/authStorage";
import { SectionCard } from "../../shared/ui";
import { showToast } from "../../shared/toast";
import { t } from "../../shared/i18n";

WebBrowser.maybeCompleteAuthSession();

function extractSsoToken(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const maybeAuth = (result as { authentication?: unknown }).authentication;
  if (maybeAuth && typeof maybeAuth === "object") {
    const idToken = (maybeAuth as { idToken?: unknown }).idToken;
    if (typeof idToken === "string" && idToken) return idToken;
    const accessToken = (maybeAuth as { accessToken?: unknown }).accessToken;
    if (typeof accessToken === "string" && accessToken) return accessToken;
  }

  const params = (result as { params?: unknown }).params;
  if (params && typeof params === "object") {
    const idToken = (params as { id_token?: unknown }).id_token;
    if (typeof idToken === "string" && idToken) return idToken;
  }

  return null;
}

export function AuthScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, "Auth">) {
  const colors = useAppColors();
  const setAccessToken = useAppStore((s) => s.setAccessToken);
  const accessToken = useAppStore((s) => s.accessToken);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showResetStep, setShowResetStep] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackKind, setFeedbackKind] = useState<"error" | "success" | "">("");

  const proxyRedirectUri = "https://auth.expo.io/@manhkien198/mobile";
  const [request, , promptAsync] = Google.useAuthRequest({
    clientId:
      appConfig.googleExpoClientId || appConfig.googleWebClientId || undefined,
    redirectUri: proxyRedirectUri,
    scopes: ["openid", "profile", "email"],
  });

  React.useEffect(() => {
    if (accessToken) navigation.replace("Home");
  }, [accessToken, navigation]);

  const setFieldError = (key: string, message = "") => {
    setFieldErrors((current) => {
      if (!message && !current[key]) return current;
      if (!message) {
        const next = { ...current };
        delete next[key];
        return next;
      }
      return { ...current, [key]: message };
    });
  };

  const clearFeedback = () => {
    setFeedbackMessage("");
    setFeedbackKind("");
  };

  const showFeedback = (message: string, kind: "error" | "success") => {
    setFeedbackMessage(message);
    setFeedbackKind(kind);
  };

  const getAuthDiagnosticMessage = (
    error: unknown,
    fallback: string,
    action: "sign in" | "sign up" | "google sign-in" | "verify" | "reset request" | "reset confirm" | "resend verification",
  ) => {
    const message = getErrorMessage(error) || fallback;
    const issue = classifyNetworkIssue(error);
    if (issue === "offline") {
      return `Network error while trying to ${action}. API: ${appConfig.apiBaseUrl}`;
    }
    if (issue === "timeout") {
      return `Request timed out while trying to ${action}. API: ${appConfig.apiBaseUrl}`;
    }
    if (issue === "server") {
      return `${message} (server error from ${appConfig.apiBaseUrl})`;
    }
    return String(message);
  };

  const handleFieldChange = (key: string, setter: (value: string) => void) =>
    (value: string) => {
      setter(value);
      setFieldError(key);
      clearFeedback();
    };

  const validateForm = () => {
    const normalizedEmail = email.trim().toLowerCase();
    const nextErrors: Record<string, string> = {};

    if (
      !normalizedEmail ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    ) {
      nextErrors.email = t("auth.invalid_email");
    }
    if (!password || password.length < 8) {
      nextErrors.password = t("auth.password_min");
    }
    if (mode === "signup") {
      if (!fullName.trim()) nextErrors.fullName = t("auth.enter_full_name");
      if (password !== confirmPassword) {
        nextErrors.confirmPassword = t("auth.password_mismatch");
      }
    }

    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      showFeedback(Object.values(nextErrors)[0], "error");
      return null;
    }

    return { email: normalizedEmail, password };
  };

  const completeAuth = async (tokenPair: {
    accessToken: string;
    refreshToken?: string;
  }) => {
    setAccessToken(tokenPair.accessToken);
    await saveAccessToken(tokenPair.accessToken);
    if (tokenPair.refreshToken) await saveRefreshToken(tokenPair.refreshToken);
    showToast(mode === "signup" ? t("auth.sign_up") : t("auth.sign_in"), "success");
    navigation.replace("Home");
  };

  const handleEmailAuth = async () => {
    clearFeedback();
    const payload = validateForm();
    if (!payload) return;

    try {
      setIsLoading(true);
      if (mode === "signup") {
        const auth = await registerWithEmail(payload);
        await completeAuth({
          accessToken: auth.access_token,
          refreshToken: auth.refresh_token,
        });
        return;
      }
      const auth = await loginWithEmail(payload);
      await completeAuth({
        accessToken: auth.access_token,
        refreshToken: auth.refresh_token,
      });
    } catch (error: unknown) {
      const msg = getAuthDiagnosticMessage(
        error,
        "Unable to authenticate.",
        mode === "signup" ? "sign up" : "sign in",
      );
      showFeedback(msg, "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSSO = async () => {
    clearFeedback();
    if (!appConfig.googleWebClientId && !appConfig.googleExpoClientId) {
      showFeedback(t("auth.google_missing"), "error");
      return;
    }

    try {
      setIsLoading(true);
      const result = await promptAsync();
      if (result.type !== "success") return;
      const tokenForSSO = extractSsoToken(result);
      if (!tokenForSSO) {
        showFeedback(t("auth.no_google_token"), "error");
        return;
      }
      const auth = await loginWithSSO("google", tokenForSSO);
      await completeAuth({
        accessToken: auth.access_token,
        refreshToken: auth.refresh_token,
      });
    } catch (error: unknown) {
      const msg = getAuthDiagnosticMessage(error, "Google sign-in failed.", "google sign-in");
      showFeedback(msg, "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestReset = async () => {
    clearFeedback();
    if (!email.trim()) {
      const message = t("auth.enter_email_first");
      setFieldErrors({ email: message });
      showFeedback(message, "error");
      return;
    }

    try {
      setIsLoading(true);
      await requestPasswordReset(email.trim().toLowerCase());
      setShowResetStep(true);
      showFeedback(t("auth.reset_requested_msg"), "success");
    } catch (error: unknown) {
      const msg = getAuthDiagnosticMessage(error, "Unable to request password reset.", "reset request");
      showFeedback(msg, "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmReset = async () => {
    clearFeedback();
    const nextErrors: Record<string, string> = {};
    if (!resetToken.trim()) {
      nextErrors.resetToken = t("auth.enter_reset_token_and_password");
    }
    if (!newPassword.trim()) {
      nextErrors.newPassword = t("auth.enter_reset_token_and_password");
    }
    if (Object.keys(nextErrors).length) {
      setFieldErrors(nextErrors);
      showFeedback(t("auth.enter_reset_token_and_password"), "error");
      return;
    }

    try {
      setIsLoading(true);
      await confirmPasswordReset({
        token: resetToken.trim(),
        new_password: newPassword,
      });
      setShowResetStep(false);
      showFeedback(t("auth.reset_success_msg"), "success");
      showToast(t("auth.reset_success_msg"), "success");
    } catch (error: unknown) {
      const msg = getAuthDiagnosticMessage(error, "Unable to reset password.", "reset confirm");
      showFeedback(msg, "error");
    } finally {
      setIsLoading(false);
    }
  };

  const paperText = colors.text;
  const paperMuted = colors.muted;
  const paperOutline = colors.border;
  const paperSurface = colors.surface;
  const isFormDisabled = isLoading;
  const inputError = (key: string) => Boolean(fieldErrors[key]);
  const helperVisible = Boolean(feedbackMessage);
  const helperTone = feedbackKind === "success" ? colors.success : colors.danger;

  const styles = StyleSheet.create({
    container: { flex: 1 },
    content: {
      flexGrow: 1,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xxl,
      paddingBottom: spacing.xxl,
      gap: spacing.lg,
      alignItems: "center",
    },
    shell: {
      width: "100%",
      maxWidth: 600,
      gap: spacing.lg,
    },
    logoMark: {
      width: 52,
      height: 52,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
    },
    logoMarkText: {
      color: "#04111F",
      ...typography.subtitle,
      fontWeight: "900",
    },
    cardBrandRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      marginBottom: spacing.xs,
    },
    logoCopy: { flex: 1, gap: 3 },
    brandLine: {
      color: colors.primary,
      letterSpacing: 1.2,
      ...typography.caption,
      fontWeight: "900",
    },
    brandTitle: { color: colors.text, ...typography.subtitle },
    authCard: {
      width: "100%",
      alignSelf: "center",
      maxWidth: 600,
      borderRadius: 24,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
      shadowColor: "#000",
      shadowOpacity: 0.08,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 2,
    },
    authCardInner: {
      padding: spacing.lg,
      gap: spacing.md,
    },
    tabShell: {
      backgroundColor: colors.surface,
      borderRadius: 999,
      padding: 4,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: "#000",
      shadowOpacity: 0.08,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
    tabRow: {
      flexDirection: "row",
      backgroundColor: colors.surfaceAlt,
      borderRadius: 999,
      padding: 2,
      gap: 2,
      borderWidth: 0,
    },
    tab: {
      flex: 1,
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 999,
      borderWidth: 1,
      borderColor: "transparent",
    },
    tabActive: {
      backgroundColor: colors.primary,
      borderColor: "rgba(255,255,255,0.12)",
      shadowColor: colors.primary,
      shadowOpacity: 0.16,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    tabInactive: { backgroundColor: "transparent" },
    tabLabel: {
      ...typography.label,
      fontWeight: "800",
      letterSpacing: 0.1,
    },
    tabLabelActive: { color: "#04111F" },
    tabLabelInactive: { color: colors.muted },
    sectionHeader: { gap: spacing.xs, marginBottom: spacing.xs },
    sectionEyebrow: {
      color: colors.primary,
      ...typography.caption,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    sectionTitle: {
      color: colors.text,
      ...typography.subtitle,
    },
    sectionDescription: {
      color: colors.muted,
      ...typography.body,
    },
    input: { backgroundColor: colors.surface },
    formGroup: { gap: spacing.xs },
    fieldError: { color: colors.danger, ...typography.caption },
    actionGroup: { gap: spacing.sm },
    feedbackBox: {
      width: "100%",
      borderWidth: 1,
      borderRadius: 16,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    feedbackText: {
      ...typography.body,
      fontWeight: "700",
    },
    loadingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      alignSelf: "center",
    },
    loadingText: {
      color: colors.muted,
      ...typography.body,
    },
  });

  return (
    <LinearGradient
      colors={[colors.background, colors.surfaceAlt, colors.surface]}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.shell}>
          {helperVisible ? (
            <View
              style={[
                styles.feedbackBox,
                { borderColor: helperTone, backgroundColor: `${helperTone}14` },
              ]}
            >
              <Text style={[styles.feedbackText, { color: helperTone }]}>
                {feedbackMessage}
              </Text>
            </View>
          ) : null}

          {isLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.loadingText}>Loading...</Text>
            </View>
          ) : null}

          {!showResetStep ? (
            <View style={styles.authCard}>
              <View style={styles.authCardInner}>
                <View style={styles.cardBrandRow}>
                  <View style={styles.logoMark}>
                    <Text style={styles.logoMarkText}>FL</Text>
                  </View>
                  <View style={styles.logoCopy}>
                    <Text style={styles.brandLine}>FLUENTRY</Text>
                    <Text style={styles.brandTitle}>
                      {mode === "signin" ? "Welcome back" : "Create your account"}
                    </Text>
                  </View>
                </View>

                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionEyebrow}>Email</Text>
                </View>

                <View style={styles.formGroup}>
                  <View style={styles.tabShell}>
                    <View style={styles.tabRow}>
                      <Pressable accessibilityRole="button" onPress={() => setMode("signin")} style={[styles.tab, mode === "signin" ? styles.tabActive : styles.tabInactive]}>
                        <Text style={[styles.tabLabel, mode === "signin" ? styles.tabLabelActive : styles.tabLabelInactive]}>{t("auth.mode_sign_in")}</Text>
                      </Pressable>
                      <Pressable accessibilityRole="button" onPress={() => setMode("signup")} style={[styles.tab, mode === "signup" ? styles.tabActive : styles.tabInactive]}>
                        <Text style={[styles.tabLabel, mode === "signup" ? styles.tabLabelActive : styles.tabLabelInactive]}>{t("auth.mode_sign_up")}</Text>
                      </Pressable>
                    </View>
                  </View>

                  {mode === "signup" ? (
                    <>
                      <TextInput mode="outlined" label={t("auth.full_name")} value={fullName} onChangeText={handleFieldChange("fullName", setFullName)} autoCapitalize="words" style={styles.input} error={inputError("fullName")} textColor={paperText} outlineColor={paperOutline} activeOutlineColor={colors.primary} placeholderTextColor={paperMuted} theme={{ colors: { onSurfaceVariant: paperMuted, background: paperSurface } }} />
                      {fieldErrors.fullName ? <Text style={styles.fieldError}>{fieldErrors.fullName}</Text> : null}
                    </>
                  ) : null}

                  <TextInput mode="outlined" label={t("auth.email")} value={email} onChangeText={handleFieldChange("email", setEmail)} autoCapitalize="none" keyboardType="email-address" style={styles.input} error={inputError("email")} textColor={paperText} outlineColor={paperOutline} activeOutlineColor={colors.primary} placeholderTextColor={paperMuted} theme={{ colors: { onSurfaceVariant: paperMuted, background: paperSurface } }} />
                  {fieldErrors.email ? <Text style={styles.fieldError}>{fieldErrors.email}</Text> : null}

                  <TextInput mode="outlined" label={t("auth.password")} value={password} onChangeText={handleFieldChange("password", setPassword)} secureTextEntry autoCapitalize="none" style={styles.input} error={inputError("password")} textColor={paperText} outlineColor={paperOutline} activeOutlineColor={colors.primary} placeholderTextColor={paperMuted} theme={{ colors: { onSurfaceVariant: paperMuted, background: paperSurface } }} />
                  {fieldErrors.password ? <Text style={styles.fieldError}>{fieldErrors.password}</Text> : null}

                  {mode === "signup" ? (
                    <>
                      <TextInput mode="outlined" label={t("auth.confirm_password")} value={confirmPassword} onChangeText={handleFieldChange("confirmPassword", setConfirmPassword)} secureTextEntry autoCapitalize="none" style={styles.input} error={inputError("confirmPassword")} textColor={paperText} outlineColor={paperOutline} activeOutlineColor={colors.primary} placeholderTextColor={paperMuted} theme={{ colors: { onSurfaceVariant: paperMuted, background: paperSurface } }} />
                      {fieldErrors.confirmPassword ? <Text style={styles.fieldError}>{fieldErrors.confirmPassword}</Text> : null}
                    </>
                  ) : null}
                </View>

                <View style={styles.actionGroup}>
                  <Button mode="contained" buttonColor={colors.primary} textColor="#04111F" disabled={isFormDisabled} loading={isLoading} onPress={handleEmailAuth}>
                    {mode === "signin" ? t("auth.sign_in") : t("auth.sign_up")}
                  </Button>

                  {mode === "signin" ? (
                    <Button mode="outlined" textColor={colors.text} disabled={isFormDisabled || !request} onPress={handleGoogleSSO}>
                      {isFormDisabled || !request ? "Google (disabled)" : t("auth.google_sign_in")}
                    </Button>
                  ) : null}

                  <Button mode="outlined" textColor={colors.text} disabled={isFormDisabled} onPress={handleRequestReset}>
                    {t("auth.forgot_password")}
                  </Button>
                </View>
              </View>
            </View>
          ) : null}

          {showResetStep ? (
            <View style={styles.authCard}>
              <View style={styles.authCardInner}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionEyebrow}>Password reset</Text>
                  <Text style={styles.sectionTitle}>Set a new password</Text>
                  <Text style={styles.sectionDescription}>{t("auth.enter_reset_token_and_password")}</Text>
                </View>

                <View style={styles.formGroup}>
                  <TextInput mode="outlined" label={t("auth.reset_token")} value={resetToken} onChangeText={handleFieldChange("resetToken", setResetToken)} autoCapitalize="none" style={styles.input} error={inputError("resetToken")} textColor={paperText} outlineColor={paperOutline} activeOutlineColor={colors.primary} placeholderTextColor={paperMuted} theme={{ colors: { onSurfaceVariant: paperMuted, background: paperSurface } }} />
                  {fieldErrors.resetToken ? <Text style={styles.fieldError}>{fieldErrors.resetToken}</Text> : null}
                  <TextInput mode="outlined" label={t("auth.new_password")} value={newPassword} onChangeText={handleFieldChange("newPassword", setNewPassword)} secureTextEntry autoCapitalize="none" style={styles.input} error={inputError("newPassword")} textColor={paperText} outlineColor={paperOutline} activeOutlineColor={colors.primary} placeholderTextColor={paperMuted} theme={{ colors: { onSurfaceVariant: paperMuted, background: paperSurface } }} />
                  {fieldErrors.newPassword ? <Text style={styles.fieldError}>{fieldErrors.newPassword}</Text> : null}
                </View>

                <View style={styles.actionGroup}>
                  <Button mode="contained" buttonColor={colors.primary} textColor="#04111F" disabled={isFormDisabled} loading={isLoading} onPress={handleConfirmReset}>
                    {t("auth.confirm_reset")}
                  </Button>
                  <Button mode="outlined" textColor={colors.text} disabled={isFormDisabled} onPress={() => setShowResetStep(false)}>
                    {t("auth.back_to_sign_in")}
                  </Button>
                </View>
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </LinearGradient>
  );
}
