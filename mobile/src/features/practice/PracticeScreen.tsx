import React, { useMemo, useRef, useState } from "react";
import { Animated, Platform, StyleSheet, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ActivityIndicator, Button, Text } from "react-native-paper";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import { RootStackParamList } from "../../navigation/types";
import { haptic } from "../../shared/haptics";
import { showToast } from "../../shared/toast";
import { t } from "../../shared/i18n";
import { useAppColors } from "../../shared/useAppColors";
import { Screen, SectionCard } from "../../shared/ui";
import { useAppStore } from "../../shared/store";
import type { AppColors } from "../../shared/theme";
import {
  classifyNetworkIssue,
  createPracticeSession,
  fetchPracticeResult,
  requestPracticeScore,
  uploadPracticeAudio,
  type NetworkIssueKind,
} from "../../shared/api";

export async function pollPracticeResult(
  sessionId: string,
  deps: {
    fetchResult: (id: string) => Promise<Awaited<ReturnType<typeof fetchPracticeResult>>>;
    sleep: (ms: number) => Promise<unknown>;
    isCancelled: () => boolean;
    tFn: (key: Parameters<typeof t>[0]) => string;
    maxAttempts?: number;
  },
) {
  const maxAttempts = deps.maxAttempts ?? 24;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (deps.isCancelled()) throw new Error(deps.tFn("practice.cancelled"));
    const result = await deps.fetchResult(sessionId);
    if (result.status === "done") return result;
    if (result.status === "failed")
      throw new Error(result.error || deps.tFn("practice.failed"));
    await deps.sleep(1500);
  }
  throw new Error(deps.tFn("practice.timeout"));
}

export function mapPracticeSubmitError(
  error: unknown,
  issue: NetworkIssueKind,
  tFn: (key: Parameters<typeof t>[0]) => string,
) {
  const fallback =
    issue === "offline"
      ? tFn("practice.no_internet")
      : issue === "timeout"
        ? tFn("practice.request_timeout")
        : tFn("toast.scoring_failed");

  return error && typeof error === "object" && "message" in error
    ? String((error as { message?: unknown }).message ?? fallback)
    : fallback;
}

export function PracticeScreen({
  route,
  navigation,
}: NativeStackScreenProps<RootStackParamList, "Practice">) {
  const colors = useAppColors();
  const fade = useMemo(() => new Animated.Value(0), []);
  const canUseNativeDriver = Platform.OS !== "web";
  React.useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 260,
      useNativeDriver: canUseNativeDriver,
    }).start();
  }, [fade, canUseNativeDriver]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const recording = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitStage, setSubmitStage] = useState<
    "idle" | "creating" | "uploading" | "scoring" | "polling"
  >("idle");
  const completePractice = useAppStore((state) => state.completePractice);
  const setLatestResult = useAppStore((state) => state.setLatestResult);
  const bars = useMemo(
    () => Array.from({ length: 24 }, (_, index) => 12 + ((index * 7) % 44)),
    [],
  );
  const pollCancelledRef = useRef(false);
  const s = styles(colors);

  const toggleRecording = async () => {
    await haptic(isRecording ? "medium" : "light");
    setErrorMessage(null);
    try {
      if (!isRecording) {
        const perm = await AudioModule.requestRecordingPermissionsAsync();
        if (!perm.granted) {
          setErrorMessage(t("practice.mic_permission"));
          return;
        }
        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: true,
        });
        await recording.prepareToRecordAsync();
        recording.record();
        setIsRecording(true);
        return;
      }

      if (recording) {
        await recording.stop();
        setAudioUri(recording.uri ?? null);
      }
    } catch {
      setErrorMessage(t("practice.record_error"));
    } finally {
      setIsRecording(false);
    }
  };

  const pollUntilDone = async (sessionId: string) =>
    pollPracticeResult(sessionId, {
      fetchResult: fetchPracticeResult,
      /* istanbul ignore next */
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      isCancelled: () => pollCancelledRef.current,
      tFn: t,
    });

  const handleSubmit = async () => {
    setErrorMessage(null);
    if (!audioUri) {
      setErrorMessage(t("practice.need_audio"));
      return;
    }

    try {
      pollCancelledRef.current = false;
      setIsSubmitting(true);
      setSubmitStage("creating");
      const session = await createPracticeSession({
        lesson_id: route.params.lessonId,
        expected_text: route.params.prompt,
      });
      setSubmitStage("uploading");
      await uploadPracticeAudio(session.session_id, audioUri);
      setSubmitStage("scoring");
      await requestPracticeScore(session.session_id);
      setSubmitStage("polling");
      const result = await pollUntilDone(session.session_id);
      if (result.status !== "done") throw new Error("Scoring not finished.");

      setLatestResult(result);
      showToast(t("toast.scoring_complete"), "success");
      await haptic("success");
      completePractice(session.session_id);
      navigation.replace("Result", { sessionId: session.session_id });
    } catch (error: unknown) {
      const issue = classifyNetworkIssue(error);
      const message = mapPracticeSubmitError(error, issue, t);

      setErrorMessage(message);
      showToast(message, "error");
      await haptic("error");
    } finally {
      setIsSubmitting(false);
      setSubmitStage("idle");
    }
  };

  return (
    <Screen>
      <Animated.View style={{ flex: 1, opacity: fade, gap: 16 }}>
        <SectionCard>
          <View style={s.block}>
            <Text style={s.label}>{t("practice.step")}</Text>
            <Text style={s.prompt}>{route.params.prompt}</Text>
            <Text style={s.helper}>{t("practice.helper")}</Text>
          </View>
        </SectionCard>

        <SectionCard>
          <View style={s.block}>
            <Text style={s.label}>{t("practice.live_waveform")}</Text>
            <View style={s.waveform}>
              {bars.map((height, index) => (
                <View
                  key={index}
                  style={[
                    s.waveBar,
                    {
                      height,
                      backgroundColor: isRecording
                        ? colors.primary
                        : colors.surfaceAlt,
                    },
                  ]}
                />
              ))}
            </View>
            <Button
              mode={isRecording ? "contained" : "outlined"}
              buttonColor={isRecording ? colors.danger : undefined}
              textColor={colors.text}
              contentStyle={{ height: 50 }}
              onPress={toggleRecording}
            >
              {isRecording
                ? "Stop recording"
                : audioUri
                  ? "Record again"
                  : "Start recording"}
            </Button>
            {audioUri ? (
              <Text style={s.audioReady}>{t("practice.audio_ready")}</Text>
            ) : null}
          </View>
        </SectionCard>

        <SectionCard>
          <View style={s.ctaWrap}>
            <Button
              mode="contained"
              buttonColor={colors.primary}
              textColor="#04111F"
              disabled={isSubmitting}
              contentStyle={{ height: 52 }}
              onPress={handleSubmit}
            >
              {isSubmitting ? "Scoring..." : "Get pronunciation score"}
            </Button>
            {isSubmitting ? <ActivityIndicator color={colors.primary} /> : null}
            {isSubmitting ? (
              <Text style={s.helper}>
                {t("practice.step_label", { value: submitStage })}
              </Text>
            ) : null}
            {errorMessage ? <Text style={s.error}>{errorMessage}</Text> : null}
            {isSubmitting ? (
              <Button
                mode="text"
                textColor={colors.text}
                onPress={() => {
                  pollCancelledRef.current = true;
                  setIsSubmitting(false);
                  setSubmitStage("idle");
                }}
              >
                Cancel
              </Button>
            ) : null}
            {errorMessage ? (
              <Button
                mode="outlined"
                textColor={colors.text}
                onPress={handleSubmit}
              >
                Retry scoring
              </Button>
            ) : null}
          </View>
        </SectionCard>
      </Animated.View>
    </Screen>
  );
}

const styles = (colors: AppColors) =>
  StyleSheet.create({
    block: { gap: 14 },
    label: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: "800",
      letterSpacing: 0.5,
    },
    prompt: {
      color: colors.text,
      fontSize: 28,
      lineHeight: 38,
      fontWeight: "800",
    },
    helper: { color: colors.muted, fontSize: 15, lineHeight: 22 },
    waveform: {
      height: 84,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 6,
      paddingVertical: 6,
    },
    waveBar: { width: 8, borderRadius: 999 },
    audioReady: { color: colors.success, fontSize: 13, fontWeight: "700" },
    error: { color: colors.danger, textAlign: "center" },
    ctaWrap: { gap: 10, marginTop: 2, paddingBottom: 4 },
  });
