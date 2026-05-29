import React, { useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActivityIndicator, Button, Card, Text } from 'react-native-paper';
import { Audio } from 'expo-av';
import { RootStackParamList } from '../../navigation/types';
import { haptic } from '../../shared/haptics';
import { showToast } from '../../shared/toast';
import { t } from '../../shared/i18n';
import { useAppColors } from '../../shared/useAppColors';
import { Screen, SectionCard } from '../../shared/ui';
import { useAppStore } from '../../shared/store';
import {
  classifyNetworkIssue,
  createPracticeSession,
  fetchPracticeResult,
  requestPracticeScore,
  uploadPracticeAudio,
} from '../../shared/api';

export function PracticeScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'Practice'>) {
  const colors = useAppColors();
  const fade = useRef(new Animated.Value(0)).current;
  React.useEffect(() => { Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: true }).start(); }, [fade]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitStage, setSubmitStage] = useState<'idle' | 'creating' | 'uploading' | 'scoring' | 'polling'>('idle');
  const completePractice = useAppStore((state) => state.completePractice);
  const setLatestResult = useAppStore((state) => state.setLatestResult);
  const bars = useMemo(() => Array.from({ length: 24 }, (_, index) => 12 + ((index * 7) % 44)), []);
  const pollCancelledRef = useRef(false);
  const s = styles(colors);

  const toggleRecording = async () => {
    await haptic(isRecording ? 'medium' : 'light');
    setErrorMessage(null);
    try {
      if (!isRecording) {
        const perm = await Audio.requestPermissionsAsync();
        if (!perm.granted) {
          setErrorMessage(t('practice.mic_permission'));
          return;
        }
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        const rec = new Audio.Recording();
        await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        await rec.startAsync();
        setRecording(rec);
        setIsRecording(true);
        return;
      }

      if (recording) {
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        setAudioUri(uri ?? null);
      }
    } catch {
      setErrorMessage(t('practice.record_error'));
    } finally {
      setIsRecording(false);
      setRecording(null);
    }
  };

  const pollUntilDone = async (sessionId: string) => {
    const maxAttempts = 24;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      if (pollCancelledRef.current) throw new Error(t('practice.cancelled'));
      const result = await fetchPracticeResult(sessionId);
      if (result.status === 'done') return result;
      if (result.status === 'failed') throw new Error(result.error || t('practice.failed'));
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    throw new Error(t('practice.timeout'));
  };

  const handleSubmit = async () => {
    setErrorMessage(null);
    if (!audioUri) {
      setErrorMessage(t('practice.need_audio'));
      return;
    }

    try {
      pollCancelledRef.current = false;
      setIsSubmitting(true);
      setSubmitStage('creating');
      const session = await createPracticeSession({ lesson_id: route.params.lessonId, expected_text: route.params.prompt });
      setSubmitStage('uploading');
      await uploadPracticeAudio(session.session_id, audioUri);
      setSubmitStage('scoring');
      await requestPracticeScore(session.session_id);
      setSubmitStage('polling');
      const result = await pollUntilDone(session.session_id);
      if (result.status !== 'done') throw new Error('Scoring not finished.');

      setLatestResult(result);
      showToast(t('toast.scoring_complete'), 'success');
      await haptic('success');
      completePractice(session.session_id);
      navigation.replace('Result', { sessionId: session.session_id });
    } catch (error: any) {
      const issue = classifyNetworkIssue(error);
      const fallback = issue === 'offline' ? t('practice.no_internet') : issue === 'timeout' ? t('practice.request_timeout') : t('toast.scoring_failed');
      setErrorMessage(error?.message || fallback);
      showToast(String(error?.message || fallback), 'error');
      await haptic('error');
    } finally {
      setIsSubmitting(false);
      setSubmitStage('idle');
    }
  };

  return (
    <Screen>
      <Animated.View style={{ flex: 1, opacity: fade, gap: 14 }}>
      <SectionCard>
        <Card.Content style={s.block}>
          <Text style={s.label}>{t('practice.say_sentence')}</Text>
          <Text style={s.prompt}>{route.params.prompt}</Text>
          <Text style={s.helper}>{t('practice.helper')}</Text>
        </Card.Content>
      </SectionCard>

      <SectionCard>
        <Card.Content style={s.block}>
          <Text style={s.label}>{t('practice.live_waveform')}</Text>
          <View style={s.waveform}>
            {bars.map((height, index) => (
              <View key={index} style={[s.waveBar, { height, backgroundColor: isRecording ? colors.primary : colors.surfaceAlt }]} />
            ))}
          </View>
          <Button mode={isRecording ? 'contained' : 'outlined'} buttonColor={isRecording ? colors.danger : undefined} textColor={colors.text} onPress={toggleRecording}>
            {isRecording ? 'Stop recording' : audioUri ? 'Record again' : 'Start recording'}
          </Button>
          {audioUri ? <Text style={s.audioReady}>{t('practice.audio_ready')}</Text> : null}
        </Card.Content>
      </SectionCard>

      <View style={s.ctaWrap}>
        <Button mode="contained" buttonColor={colors.primary} textColor="#04111F" disabled={isSubmitting} onPress={handleSubmit}>
          {isSubmitting ? 'Scoring...' : 'Get pronunciation score'}
        </Button>
        {isSubmitting ? <ActivityIndicator color={colors.primary} /> : null}
        {isSubmitting ? <Text style={s.helper}>{t('practice.step_label', { value: submitStage })}</Text> : null}
        {errorMessage ? <Text style={s.error}>{errorMessage}</Text> : null}
        {isSubmitting ? (
          <Button mode="text" textColor={colors.text} onPress={() => { pollCancelledRef.current = true; setIsSubmitting(false); setSubmitStage('idle'); }}>Cancel</Button>
        ) : null}
        {errorMessage ? (
          <Button mode="outlined" textColor={colors.text} onPress={handleSubmit}>Retry scoring</Button>
        ) : null}
      </View>
      </Animated.View>
    </Screen>
  );
}

const styles = (colors: any) => StyleSheet.create({
  block: { gap: 14 },
  label: { color: colors.primary, fontSize: 13, fontWeight: '800' },
  prompt: { color: colors.text, fontSize: 28, lineHeight: 38, fontWeight: '700' },
  helper: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  waveform: { height: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  waveBar: { width: 8, borderRadius: 999 },
  audioReady: { color: colors.success, fontSize: 13 },
  error: { color: colors.danger, textAlign: 'center' },
  ctaWrap: { gap: 8, marginTop: 6, paddingBottom: 8 },
});
