import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Card, Text } from "react-native-paper";
import { MetricBar, Screen, ScorePill, SectionCard } from "../../shared/ui";
import { SkeletonCard } from "../../shared/Skeleton";
import { fetchUserHistory, fetchUserProgress } from "../../shared/api";
import { useAppColors } from "../../shared/useAppColors";
import { t } from "../../shared/i18n";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../navigation/types";

type ProgressState = {
  streak: number;
  xp: number;
  level: string;
  pronunciation_score: number;
  fluency_score: number;
  confidence_score: number;
  weak_sounds: string[];
  session_count: number;
};

const initialState: ProgressState = {
  streak: 0,
  xp: 0,
  level: "-",
  pronunciation_score: 0,
  fluency_score: 0,
  confidence_score: 0,
  weak_sounds: [],
  session_count: 0,
};

export function ProgressScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, "Progress">) {
  const colors = useAppColors();
  const s = styles(colors);

  const [state, setState] = useState<ProgressState>(initialState);
  const [historyCount, setHistoryCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoadError(null);
        const [progress, history] = await Promise.all([
          fetchUserProgress(),
          fetchUserHistory(),
        ]);
        if (!mounted) return;
        setState({
          streak: progress.streak ?? 0,
          xp: progress.xp ?? 0,
          level: progress.level ?? "-",
          pronunciation_score: progress.pronunciation_score ?? 0,
          fluency_score: progress.fluency_score ?? 0,
          confidence_score: progress.confidence_score ?? 0,
          weak_sounds: progress.weak_sounds ?? [],
          session_count: progress.session_count ?? 0,
        });
        setHistoryCount(progress.session_count ?? history.items?.length ?? 0);
      } catch {
        setLoadError(t("progress.load_error"));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const sounds = useMemo(
    () => state.weak_sounds.slice(0, 3),
    [state.weak_sounds],
  );

  return (
    <Screen>
      {loading ? <SkeletonCard /> : null}

      <SectionCard>
        <Card.Content style={s.summary}>
          <Text style={s.title}>{t("progress.title")}</Text>
          <View style={s.pillRow}>
            <ScorePill
              label={t("progress.streak")}
              value={t("progress.days", { count: state.streak })}
            />
            <ScorePill label={t("home.xp")} value={`${state.xp}`} />
            <ScorePill label={t("progress.level")} value={state.level} />
          </View>
          <Text style={s.line}>
            {t("progress.completed_sessions", { count: historyCount })}
          </Text>
          {loadError ? (
            <Text style={[s.line, { color: colors.warning }]}>{loadError}</Text>
          ) : null}
        </Card.Content>
      </SectionCard>

      <SectionCard>
        <Card.Content style={s.block}>
          <Text style={s.sectionTitle}>{t("progress.weekly_improvement")}</Text>
          <MetricBar
            label={t("progress.pronunciation")}
            value={state.pronunciation_score}
          />
          <MetricBar
            label={t("progress.fluency")}
            value={state.fluency_score}
          />
          <MetricBar
            label={t("progress.confidence")}
            value={state.confidence_score}
          />
        </Card.Content>
      </SectionCard>

      <SectionCard>
        <Card.Content style={s.block}>
          <Text style={s.sectionTitle}>{t("progress.priority_sounds")}</Text>
          {sounds.map((sound) => (
            <Text key={sound} style={s.line}>
              • {sound}
            </Text>
          ))}
        </Card.Content>
      </SectionCard>

      <Button
        mode="outlined"
        textColor={colors.text}
        onPress={() => navigation.navigate("History")}
      >
        View history
      </Button>
      <Button
        mode="text"
        textColor={colors.primary}
        onPress={() => navigation.navigate("Trends")}
      >
        View trends
      </Button>
    </Screen>
  );
}

const styles = (colors: any) =>
  StyleSheet.create({
    summary: { gap: 14 },
    title: { color: colors.text, fontSize: 24, fontWeight: "800" },
    pillRow: { flexDirection: "row", gap: 10 },
    block: { gap: 14 },
    sectionTitle: { color: colors.text, fontSize: 18, fontWeight: "700" },
    line: { color: colors.muted, fontSize: 15, lineHeight: 22 },
    loadingBlock: { minHeight: 70, justifyContent: "center" },
    loadingText: { color: colors.muted, fontSize: 14 },
  });
