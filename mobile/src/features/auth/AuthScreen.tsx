import React, { useState } from "react";
import { Alert, Platform, StyleSheet, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  Button,
  SegmentedButtons,
  Text,
  TextInput,
} from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import * as AppleAuthentication from "expo-apple-authentication";
import { RootStackParamList } from "../../navigation/types";
import {
  confirmPasswordReset,
  getErrorMessage,
  loginWithEmail,
  loginWithSSO,
  registerWithEmail,
  requestPasswordReset,
  resendVerification,
  verifyEmail,
} from "../../shared/api";
import { appConfig } from "../../shared/config";
import { spacing, typography } from "../../shared/theme";
import { useAppStore } from "../../shared/store";
import { useAppColors } from "../../shared/useAppColors";
import { saveAccessToken, saveRefreshToken } from "../../shared/authStorage";
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
  const [verificationToken, setVerificationToken] = useState("");
  const [showVerifyStep, setShowVerifyStep] = useState(false);
  const [showResetStep, setShowResetStep] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [appleAuthAvailable, setAppleAuthAvailable] = useState(false);

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

  React.useEffect(() => {
    let mounted = true;
    const loadAppleAvailability = async () => {
      if (Platform.OS !== "ios") {
        if (mounted) setAppleAuthAvailable(false);
        return;
      }
      try {
        const available = await AppleAuthentication.isAvailableAsync();
        if (mounted) setAppleAuthAvailable(available);
      } catch {
        if (mounted) setAppleAuthAvailable(false);
      }
    };
    loadAppleAvailability();
    return () => {
      mounted = false;
    };
  }, []);

  const validateForm = () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (
      !normalizedEmail ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    ) {
      Alert.alert(t("auth.validation"), t("auth.invalid_email"));
      return null;
    }
    if (!password || password.length < 8) {
      Alert.alert(t("auth.validation"), t("auth.password_min"));
      return null;
    }
    if (mode === "signup") {
      if (!fullName.trim()) {
        Alert.alert(t("auth.validation"), t("auth.enter_full_name"));
        return null;
      }
      if (password !== confirmPassword) {
        Alert.alert(t("auth.validation"), t("auth.password_mismatch"));
        return null;
      }
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
    navigation.replace("Home");
  };

  const handleEmailAuth = async () => {
    const payload = validateForm();
    if (!payload) return;
    try {
      setIsLoading(true);
      if (mode === "signup") {
        const registerResult = await registerWithEmail(payload);
        if (registerResult.verificationToken)
          setVerificationToken(registerResult.verificationToken);
        setShowVerifyStep(true);
        Alert.alert(t("auth.verify_email"), t("auth.verify_email_sent"));
        return;
      }
      const auth = await loginWithEmail(payload);
      await completeAuth({
        accessToken: auth.access_token,
        refreshToken: auth.refresh_token,
      });
    } catch (error: unknown) {
      const msg = getErrorMessage(error) || "Unable to authenticate.";
      Alert.alert(t("auth.error"), String(msg));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSSO = async () => {
    if (!appConfig.googleWebClientId && !appConfig.googleExpoClientId) {
      Alert.alert(t("auth.validation"), t("auth.google_missing"));
      return;
    }
    try {
      setIsLoading(true);
      const result = await promptAsync();
      if (result.type !== "success") return;
      const tokenForSSO = extractSsoToken(result);
      if (!tokenForSSO) {
        Alert.alert(t("auth.error"), t("auth.no_google_token"));
        return;
      }
      const auth = await loginWithSSO("google", tokenForSSO);
      await completeAuth({
        accessToken: auth.access_token,
        refreshToken: auth.refresh_token,
      });
    } catch (error: unknown) {
      const msg = getErrorMessage(error) || "Google sign-in failed.";
      Alert.alert(t("auth.error"), String(msg));
    } finally {
      setIsLoading(false);
    }
  };

  const handleAppleSSO = async () => {
    if (Platform.OS !== "ios") {
      Alert.alert(t("auth.unavailable"), t("auth.apple_ios_only"));
      return;
    }
    if (!appleAuthAvailable) {
      Alert.alert(t("auth.validation"), t("auth.apple_unavailable"));
      return;
    }
    try {
      setIsLoading(true);
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) {
        Alert.alert(t("auth.error"), t("auth.no_apple_token"));
        return;
      }
      const auth = await loginWithSSO("apple", credential.identityToken);
      await completeAuth({
        accessToken: auth.access_token,
        refreshToken: auth.refresh_token,
      });
    } catch (error: unknown) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code?: unknown }).code === "ERR_REQUEST_CANCELED"
      ) {
        return;
      }
      const msg = getErrorMessage(error) || "Apple sign-in failed.";
      Alert.alert(t("auth.error"), String(msg));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!verificationToken.trim()) {
      Alert.alert(t("auth.validation"), t("auth.enter_verification_token"));
      return;
    }
    try {
      setIsLoading(true);
      await verifyEmail(verificationToken.trim());
      const auth = await loginWithEmail({
        email: email.trim().toLowerCase(),
        password,
      });
      await completeAuth({
        accessToken: auth.access_token,
        refreshToken: auth.refresh_token,
      });
    } catch (error: unknown) {
      const msg = getErrorMessage(error) || "Verification failed.";
      Alert.alert(t("auth.verify_failed"), String(msg));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestReset = async () => {
    if (!email.trim()) {
      Alert.alert(t("auth.validation"), t("auth.enter_email_first"));
      return;
    }
    try {
      setIsLoading(true);
      await requestPasswordReset(email.trim().toLowerCase());
      setShowResetStep(true);
      Alert.alert(t("auth.reset_requested"), t("auth.reset_requested_msg"));
    } catch (error: unknown) {
      const msg = getErrorMessage(error) || "Unable to request password reset.";
      Alert.alert(t("auth.reset_failed"), String(msg));
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmReset = async () => {
    if (!resetToken.trim() || !newPassword.trim()) {
      Alert.alert(
        t("auth.validation"),
        t("auth.enter_reset_token_and_password"),
      );
      return;
    }
    try {
      setIsLoading(true);
      await confirmPasswordReset({
        token: resetToken.trim(),
        new_password: newPassword,
      });
      setShowResetStep(false);
      Alert.alert(t("auth.reset_success"), t("auth.reset_success_msg"));
    } catch (error: unknown) {
      const msg = getErrorMessage(error) || "Unable to reset password.";
      Alert.alert(t("auth.reset_failed"), String(msg));
    } finally {
      setIsLoading(false);
    }
  };
  const handleResendVerification = async () => {
    try {
      setIsLoading(true);
      const res = await resendVerification(email.trim().toLowerCase());
      if (res.token) setVerificationToken(res.token);
      Alert.alert(t("auth.verify_email"), t("auth.verification_resent"));
    } catch (error: unknown) {
      const msg = getErrorMessage(error) || "Unable to resend verification.";
      Alert.alert(t("auth.resend_failed"), String(msg));
    } finally {
      setIsLoading(false);
    }
  };

  const styles = StyleSheet.create({
    container: { flex: 1, padding: spacing.xxl, justifyContent: "space-between" },
    hero: { marginTop: 84, gap: spacing.lg },
    badge: {
      color: colors.primary,
      letterSpacing: 1,
      ...typography.caption,
      fontWeight: "800",
    },
    title: { color: colors.text, ...typography.display },
    subtitle: { color: colors.muted, ...typography.body },
    ctaGroup: { gap: spacing.md, marginBottom: 36 },
    input: { backgroundColor: "transparent" },
  });

  return (
    <LinearGradient
      colors={[colors.background, colors.surfaceAlt, colors.surface]}
      style={styles.container}
    >
      <View style={styles.hero}>
        <Text style={styles.badge}>{t("auth.hero_badge")}</Text>
        <Text style={styles.title}>{t("auth.hero_title")}</Text>
        <Text style={styles.subtitle}>{t("auth.hero_subtitle")}</Text>
      </View>
      <View style={styles.ctaGroup}>
        {!showVerifyStep ? (
          <SegmentedButtons
            value={mode}
            onValueChange={(value) => setMode(value as "signin" | "signup")}
            buttons={[
              { value: "signin", label: t("auth.mode_sign_in") },
              { value: "signup", label: t("auth.mode_sign_up") },
            ]}
          />
        ) : null}

        {mode === "signup" && !showVerifyStep ? (
          <TextInput
            mode="outlined"
            label={t("auth.full_name")}
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
            style={styles.input}
          />
        ) : null}

        {!showVerifyStep ? (
          <TextInput
            mode="outlined"
            label={t("auth.email")}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
          />
        ) : null}

        {!showVerifyStep ? (
          <TextInput
            mode="outlined"
            label={t("auth.password")}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            style={styles.input}
          />
        ) : null}

        {mode === "signup" && !showVerifyStep ? (
          <TextInput
            mode="outlined"
            label={t("auth.confirm_password")}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoCapitalize="none"
            style={styles.input}
          />
        ) : null}

        {!showVerifyStep && !showResetStep ? (
          <Button
            mode="contained"
            buttonColor={colors.primary}
            textColor="#04111F"
            disabled={isLoading}
            loading={isLoading}
            onPress={handleEmailAuth}
          >
            {mode === "signin" ? t("auth.sign_in") : t("auth.sign_up")}
          </Button>
        ) : null}

        {!showVerifyStep && !showResetStep ? (
          <Button
            mode="outlined"
            textColor={colors.text}
            disabled={isLoading}
            onPress={handleRequestReset}
          >
            {t("auth.forgot_password")}
          </Button>
        ) : null}

        {showResetStep ? (
          <>
            <TextInput
              mode="outlined"
              label={t("auth.reset_token")}
              value={resetToken}
              onChangeText={setResetToken}
              autoCapitalize="none"
              style={styles.input}
            />
            <TextInput
              mode="outlined"
              label={t("auth.new_password")}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              autoCapitalize="none"
              style={styles.input}
            />
            <Button
              mode="contained"
              buttonColor={colors.primary}
              textColor="#04111F"
              disabled={isLoading}
              loading={isLoading}
              onPress={handleConfirmReset}
            >
              {t("auth.confirm_reset")}
            </Button>
            <Button
              mode="outlined"
              textColor={colors.text}
              disabled={isLoading}
              onPress={() => setShowResetStep(false)}
            >
              {t("auth.back_to_sign_in")}
            </Button>
          </>
        ) : null}

        {showVerifyStep ? (
          <>
            <TextInput
              mode="outlined"
              label={t("auth.verification_token")}
              value={verificationToken}
              onChangeText={setVerificationToken}
              autoCapitalize="none"
              style={styles.input}
            />
            <Button
              mode="contained"
              buttonColor={colors.primary}
              textColor="#04111F"
              disabled={isLoading}
              loading={isLoading}
              onPress={handleVerify}
            >
              {t("auth.verify_email")}
            </Button>
            <Button
              mode="outlined"
              textColor={colors.text}
              disabled={isLoading}
              onPress={handleResendVerification}
            >
              {t("auth.resend_verification")}
            </Button>
          </>
        ) : null}

        <Button
          mode="outlined"
          textColor={colors.text}
          disabled={isLoading || !request}
          onPress={handleGoogleSSO}
        >
          {isLoading || !request ? "Google (disabled)" : t("auth.google_sign_in")}
        </Button>
        <Button
          mode="outlined"
          textColor={colors.text}
          disabled={isLoading || !appleAuthAvailable}
          onPress={handleAppleSSO}
        >
          {isLoading || !appleAuthAvailable
            ? "Apple (disabled)"
            : t("auth.apple_sign_in")}
        </Button>
      </View>
    </LinearGradient>
  );
}

