import React, { useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SegmentedButtons, Text, TextInput } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import { RootStackParamList } from '../../navigation/types';
import { confirmPasswordReset, loginWithEmail, loginWithSSO, registerWithEmail, requestPasswordReset, resendVerification, verifyEmail } from '../../shared/api';
import { appConfig } from '../../shared/config';
import { colors as themeColors } from '../../shared/theme';
import { useAppStore } from '../../shared/store';
import { saveAccessToken, saveRefreshToken } from '../../shared/authStorage';
import { t } from '../../shared/i18n';

WebBrowser.maybeCompleteAuthSession();

export function AuthScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Auth'>) {
  const setAccessToken = useAppStore((s) => s.setAccessToken);
  const accessToken = useAppStore((s) => s.accessToken);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [showVerifyStep, setShowVerifyStep] = useState(false);
  const [showResetStep, setShowResetStep] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [appleAuthAvailable, setAppleAuthAvailable] = useState(false);

  const proxyRedirectUri = 'https://auth.expo.io/@manhkien198/mobile';
  const [request, , promptAsync] = Google.useAuthRequest({
    clientId: appConfig.googleExpoClientId || appConfig.googleWebClientId || undefined,
    redirectUri: proxyRedirectUri,
    scopes: ['openid', 'profile', 'email'],
  });

  React.useEffect(() => {
    if (accessToken) navigation.replace('Home');
  }, [accessToken, navigation]);

  React.useEffect(() => {
    let mounted = true;
    const loadAppleAvailability = async () => {
      if (Platform.OS !== 'ios') {
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
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      Alert.alert(t('auth.validation'), t('auth.invalid_email'));
      return null;
    }
    if (!password || password.length < 8) {
      Alert.alert(t('auth.validation'), t('auth.password_min'));
      return null;
    }
    if (mode === 'signup') {
      if (!fullName.trim()) {
        Alert.alert(t('auth.validation'), t('auth.enter_full_name'));
        return null;
      }
      if (password !== confirmPassword) {
        Alert.alert(t('auth.validation'), t('auth.password_mismatch'));
        return null;
      }
    }
    return { email: normalizedEmail, password };
  };

  const completeAuth = async (tokenPair: { accessToken: string; refreshToken?: string }) => {
    setAccessToken(tokenPair.accessToken);
    await saveAccessToken(tokenPair.accessToken);
    if (tokenPair.refreshToken) await saveRefreshToken(tokenPair.refreshToken);
    navigation.replace('Home');
  };

  const handleEmailAuth = async () => {
    const payload = validateForm();
    if (!payload) return;
    try {
      setIsLoading(true);
      if (mode === 'signup') {
        const registerResult = await registerWithEmail(payload);
        if (registerResult.verificationToken) setVerificationToken(registerResult.verificationToken);
        setShowVerifyStep(true);
        Alert.alert(t('auth.verify_email'), t('auth.verify_email_sent'));
        return;
      }
      const auth = await loginWithEmail(payload);
      await completeAuth({ accessToken: auth.access_token, refreshToken: auth.refresh_token });
    } catch (error: any) {
      const msg = error?.response?.data?.detail || 'Unable to authenticate.';
      Alert.alert(t('auth.error'), String(msg));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSSO = async () => {
    if (!appConfig.googleWebClientId && !appConfig.googleExpoClientId) {
      Alert.alert(t('auth.validation'), t('auth.google_missing'));
      return;
    }
    try {
      setIsLoading(true);
      const result = await promptAsync();
      if (result.type !== 'success') return;
      const tokenForSSO =
        (result as any)?.authentication?.idToken ||
        (result as any)?.params?.id_token ||
        (result as any)?.authentication?.accessToken;
      if (!tokenForSSO) {
        Alert.alert(t('auth.error'), t('auth.no_google_token'));
        return;
      }
      const auth = await loginWithSSO('google', tokenForSSO);
      await completeAuth({ accessToken: auth.access_token, refreshToken: auth.refresh_token });
    } catch (error: any) {
      const msg = error?.response?.data?.detail || error?.message || 'Google sign-in failed.';
      Alert.alert(t('auth.error'), String(msg));
    } finally {
      setIsLoading(false);
    }
  };

  const handleAppleSSO = async () => {
    if (Platform.OS !== 'ios') {
      Alert.alert(t('auth.unavailable'), t('auth.apple_ios_only'));
      return;
    }
    if (!appleAuthAvailable) {
      Alert.alert(t('auth.validation'), t('auth.apple_unavailable'));
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
        Alert.alert(t('auth.error'), t('auth.no_apple_token'));
        return;
      }
      const auth = await loginWithSSO('apple', credential.identityToken);
      await completeAuth({ accessToken: auth.access_token, refreshToken: auth.refresh_token });
    } catch (error: any) {
      if (error?.code === 'ERR_REQUEST_CANCELED') return;
      const msg = error?.response?.data?.detail || error?.message || 'Apple sign-in failed.';
      Alert.alert(t('auth.error'), String(msg));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!verificationToken.trim()) {
      Alert.alert(t('auth.validation'), t('auth.enter_verification_token'));
      return;
    }
    try {
      setIsLoading(true);
      await verifyEmail(verificationToken.trim());
      const auth = await loginWithEmail({ email: email.trim().toLowerCase(), password });
      await completeAuth({ accessToken: auth.access_token, refreshToken: auth.refresh_token });
    } catch (error: any) {
      const msg = error?.response?.data?.detail || 'Verification failed.';
      Alert.alert(t('auth.verify_failed'), String(msg));
    } finally {
      setIsLoading(false);
    }
  };



  const handleRequestReset = async () => {
    if (!email.trim()) {
      Alert.alert(t('auth.validation'), t('auth.enter_email_first'));
      return;
    }
    try {
      setIsLoading(true);
      await requestPasswordReset(email.trim().toLowerCase());
      setShowResetStep(true);
      Alert.alert(t('auth.reset_requested'), t('auth.reset_requested_msg'));
    } catch (error: any) {
      const msg = error?.response?.data?.detail || 'Unable to request password reset.';
      Alert.alert(t('auth.reset_failed'), String(msg));
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmReset = async () => {
    if (!resetToken.trim() || !newPassword.trim()) {
      Alert.alert(t('auth.validation'), t('auth.enter_reset_token_and_password'));
      return;
    }
    try {
      setIsLoading(true);
      await confirmPasswordReset({ token: resetToken.trim(), new_password: newPassword });
      setShowResetStep(false);
      Alert.alert(t('auth.reset_success'), t('auth.reset_success_msg'));
    } catch (error: any) {
      const msg = error?.response?.data?.detail || 'Unable to reset password.';
      Alert.alert(t('auth.reset_failed'), String(msg));
    } finally {
      setIsLoading(false);
    }
  };
  const handleResendVerification = async () => {
    try {
      setIsLoading(true);
      const res = await resendVerification(email.trim().toLowerCase());
      if (res.token) setVerificationToken(res.token);
      Alert.alert(t('auth.verify_email'), t('auth.verification_resent'));
    } catch (error: any) {
      const msg = error?.response?.data?.detail || 'Unable to resend verification.';
      Alert.alert(t('auth.resend_failed'), String(msg));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#0B1020', '#182347', '#281B52']} style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.badge}>{t('auth.hero_badge')}</Text>
        <Text style={styles.title}>{t('auth.hero_title')}</Text>
        <Text style={styles.subtitle}>{t('auth.hero_subtitle')}</Text>
      </View>
      <View style={styles.ctaGroup}>
        {!showVerifyStep ? (
          <SegmentedButtons
            value={mode}
            onValueChange={(value) => setMode(value as 'signin' | 'signup')}
            buttons={[{ value: 'signin', label: t('auth.mode_sign_in') }, { value: 'signup', label: t('auth.mode_sign_up') }]}
          />
        ) : null}

        {mode === 'signup' && !showVerifyStep ? (
          <TextInput mode="outlined" label={t('auth.full_name')} value={fullName} onChangeText={setFullName} autoCapitalize="words" style={styles.input} />
        ) : null}

        {!showVerifyStep ? (
          <TextInput mode="outlined" label={t('auth.email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" style={styles.input} />
        ) : null}

        {!showVerifyStep ? (
          <TextInput mode="outlined" label={t('auth.password')} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" style={styles.input} />
        ) : null}

        {mode === 'signup' && !showVerifyStep ? (
          <TextInput mode="outlined" label={t('auth.confirm_password')} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry autoCapitalize="none" style={styles.input} />
        ) : null}

        {!showVerifyStep && !showResetStep ? (
          <Text onPress={handleEmailAuth} style={styles.primaryBtn}>
            {isLoading ? t('common.loading') : mode === 'signin' ? t('auth.sign_in') : t('auth.sign_up')}
          </Text>
        ) : null}

        {!showVerifyStep && !showResetStep ? (
          <Text onPress={handleRequestReset} style={styles.secondaryBtn}>{t('auth.forgot_password')}</Text>
        ) : null}

        {showResetStep ? (
          <>
            <TextInput mode="outlined" label={t('auth.reset_token')} value={resetToken} onChangeText={setResetToken} autoCapitalize="none" style={styles.input} />
            <TextInput mode="outlined" label={t('auth.new_password')} value={newPassword} onChangeText={setNewPassword} secureTextEntry autoCapitalize="none" style={styles.input} />
            <Text onPress={handleConfirmReset} style={styles.primaryBtn}>
              {isLoading ? t('common.loading') : t('auth.confirm_reset')}
            </Text>
            <Text onPress={() => setShowResetStep(false)} style={styles.secondaryBtn}>{t('auth.back_to_sign_in')}</Text>
          </>
        ) : null}

        {showVerifyStep ? (
          <>
            <TextInput mode="outlined" label={t('auth.verification_token')} value={verificationToken} onChangeText={setVerificationToken} autoCapitalize="none" style={styles.input} />
            <Text onPress={handleVerify} style={styles.primaryBtn}>
              {isLoading ? t('common.loading') : t('auth.verify_email')}
            </Text>
            <Text onPress={handleResendVerification} style={styles.secondaryBtn}>{t('auth.resend_verification')}</Text>
          </>
        ) : null}

        <Text onPress={handleGoogleSSO} style={styles.secondaryBtn}>{isLoading || !request ? 'Google (disabled)' : t('auth.google_sign_in')}</Text>
        <Text onPress={handleAppleSSO} style={styles.secondaryBtn}>{isLoading || !appleAuthAvailable ? 'Apple (disabled)' : t('auth.apple_sign_in')}</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'space-between' },
  hero: { marginTop: 84, gap: 16 },
  badge: { color: themeColors.primary, letterSpacing: 1, fontSize: 12, fontWeight: '800' },
  title: { color: themeColors.text, fontSize: 34, lineHeight: 42, fontWeight: '800' },
  subtitle: { color: themeColors.muted, fontSize: 15, lineHeight: 22 },
  ctaGroup: { gap: 12, marginBottom: 36 },
  input: { backgroundColor: 'transparent' },
  primaryBtn: {
    backgroundColor: themeColors.primary,
    color: '#04111F',
    fontWeight: '800',
    textAlign: 'center',
    paddingVertical: 12,
    borderRadius: 10,
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: themeColors.border,
    color: themeColors.text,
    textAlign: 'center',
    paddingVertical: 12,
    borderRadius: 10,
  },
});
