import React from "react";
import { StyleSheet, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Button, Card, Text } from "react-native-paper";
import { RootStackParamList } from "../../navigation/types";
import { useAppColors } from "../../shared/useAppColors";
import { MetricBar, Screen, ScorePill, SectionCard } from "../../shared/ui";
import { useAppStore } from "../../shared/store";
import { t } from "../../shared/i18n";

export function ResultScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, "Result">) {
  const colors = useAppColors();
  const latestResult = useAppStore((state) => state.latestResult);
  const s = styles(colors);
  if (!latestResult) {
    return (
      <Screen>
        <SectionCard>
          <Card.Content style={s.contentBlock}>
            <Text style={s.sectionTitle}>{t("common.na")}</Text>
            <Button
              mode="contained"
              buttonColor={colors.primary}
              textColor="#04111F"
              onPress={() => navigation.replace("Home")}
            >
              {t("result.back_home")}
            </Button>
          </Card.Content>
        </SectionCard>
      </Screen>
    );
  }

  const result = {
    overallScore: latestResult.overall_score,
    pronunciationScore: latestResult.pronunciation_score,
    fluencyScore: latestResult.fluency_score,
    confidenceScore:
      typeof latestResult.fluency_score === "number" &&
      typeof latestResult.pronunciation_score === "number"
        ? Math.round(
            (latestResult.fluency_score + latestResult.pronunciation_score) / 2,
          )
        : 0,
    words: latestResult.words,
    tips: latestResult.tips,
  };

  return (
    <Screen>
      <SectionCard>
        <Card.Content style={s.hero}>
          <Text style={s.heroLabel}>{t("result.title")}</Text>
          <Text style={s.heroScore}>{result.overallScore}</Text>
          <Text style={s.heroText}>{t("result.hero_text")}</Text>
          <View style={s.pillRow}>
            <ScorePill
              label={t("result.overall")}
              value={`${result.overallScore}`}
            />
            <ScorePill
              label={t("result.pron")}
              value={`${result.pronunciationScore}`}
            />
            <ScorePill
              label={t("result.fluency")}
              value={`${result.fluencyScore}`}
            />
          </View>
        </Card.Content>
      </SectionCard>

      <SectionCard>
        <Card.Content style={s.contentBlock}>
          <Text style={s.sectionTitle}>{t("result.detailed_metrics")}</Text>
          <MetricBar
            label={t("result.pron")}
            value={result.pronunciationScore}
          />
          <MetricBar label={t("result.fluency")} value={result.fluencyScore} />
          <MetricBar label={t("result.word_stress")} value={result.confidenceScore} />
        </Card.Content>
      </SectionCard>

      <SectionCard>
        <Card.Content style={s.contentBlock}>
          <Text style={s.sectionTitle}>{t("result.word_feedback")}</Text>
          <View style={s.wordWrap}>
            {result.words.map((word) => (
              <View
                key={word.text}
                style={[
                  s.wordChip,
                  {
                    borderColor:
                      word.status === "good" ? colors.success : colors.warning,
                  },
                ]}
              >
                <Text style={s.wordText}>{word.text}</Text>
                <Text
                  style={[
                    s.wordScore,
                    {
                      color:
                        word.status === "good"
                          ? colors.success
                          : colors.warning,
                    },
                  ]}
                >
                  {word.score}
                </Text>
              </View>
            ))}
          </View>
        </Card.Content>
      </SectionCard>

      <SectionCard>
        <Card.Content style={s.contentBlock}>
          <Text style={s.sectionTitle}>{t("result.phoneme_feedback")}</Text>
          {(latestResult?.phonemes || []).slice(0, 8).map((ph, idx) => (
            <Text key={`${ph.symbol}-${idx}`} style={s.tipText}>
              • {ph.symbol} ({ph.word || t("common.na")}) · {ph.score}%{" "}
              {ph.tip ? `— ${ph.tip}` : ""}
            </Text>
          ))}
          {!latestResult?.phonemes?.length ? (
            <Text style={s.tipText}>• {t("result.phoneme_none")}</Text>
          ) : null}
        </Card.Content>
      </SectionCard>

      <SectionCard>
        <Card.Content style={s.contentBlock}>
          <Text style={s.sectionTitle}>{t("result.analysis")}</Text>
          <Text style={s.tipText}>
            •{" "}
            {t("result.analysis_alignment", {
              value: latestResult?.analysis?.alignment_status || t("common.na"),
            })}
          </Text>
          <Text style={s.tipText}>
            •{" "}
            {t("result.analysis_words_detected", {
              count: latestResult?.analysis?.word_count ?? 0,
            })}
          </Text>
          <Text style={s.tipText}>
            •{" "}
            {t("result.analysis_duration_ms", {
              count: latestResult?.analysis?.estimated_duration_ms ?? 0,
            })}
          </Text>
        </Card.Content>
      </SectionCard>

      <SectionCard>
        <Card.Content style={s.contentBlock}>
          <Text style={s.sectionTitle}>{t("result.coaching_tips")}</Text>
          {result.tips.map((tip) => (
            <Text key={tip} style={s.tipText}>
              • {tip}
            </Text>
          ))}
        </Card.Content>
      </SectionCard>

      <Button
        mode="contained"
        buttonColor={colors.primary}
        textColor="#04111F"
        onPress={() => navigation.navigate("Progress")}
      >
        {t("result.view_progress")}
      </Button>
      <Button
        mode="text"
        textColor={colors.text}
        onPress={() => navigation.navigate("Home")}
      >
        {t("result.back_home")}
      </Button>
    </Screen>
  );
}

const styles = (colors: any) =>
  StyleSheet.create({
    hero: { gap: 14, alignItems: "center" },
    heroLabel: { color: colors.primary, fontSize: 13, fontWeight: "800" },
    heroScore: { color: colors.text, fontSize: 64, fontWeight: "900" },
    heroText: {
      color: colors.muted,
      fontSize: 15,
      lineHeight: 22,
      textAlign: "center",
    },
    pillRow: { flexDirection: "row", gap: 10 },
    contentBlock: { gap: 14 },
    sectionTitle: { color: colors.text, fontSize: 18, fontWeight: "700" },
    wordWrap: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
    wordChip: {
      borderWidth: 1,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: colors.surfaceAlt,
    },
    wordText: { color: colors.text, fontWeight: "700" },
    wordScore: { marginTop: 4, fontWeight: "700" },
    tipText: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  });
