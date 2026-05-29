import React from "react";
import { StyleSheet, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { Button, Card, Text } from "react-native-paper";
import { RootStackParamList } from "../../navigation/types";
import { fetchLessonById, fetchUserProgress } from "../../shared/api";
import { colors } from "../../shared/theme";
import { MetricBar, Screen, SectionCard } from "../../shared/ui";
import { t } from "../../shared/i18n";

export function LessonScreen({
  route,
  navigation,
}: NativeStackScreenProps<RootStackParamList, "Lesson">) {
  const lessonQuery = useQuery({
    queryKey: ["lessons", route.params.lessonId],
    queryFn: () => fetchLessonById(route.params.lessonId),
    staleTime: 60_000,
  });

  const progressQuery = useQuery({
    queryKey: ["users", "me", "progress"],
    queryFn: fetchUserProgress,
    staleTime: 30_000,
  });

  if (lessonQuery.isLoading) {
    return (
      <Screen>
        <SectionCard>
          <Card.Content>
            <Text style={styles.practiceText}>{t("common.loading")}</Text>
          </Card.Content>
        </SectionCard>
      </Screen>
    );
  }

  if (lessonQuery.isError || !lessonQuery.data) {
    return (
      <Screen>
        <SectionCard>
          <Card.Content style={{ gap: 10 }}>
            <Text style={styles.practiceText}>{t("common.na")}</Text>
            <Button
              mode="outlined"
              textColor={colors.text}
              onPress={() => lessonQuery.refetch()}
            >
              {t("common.retry")}
            </Button>
          </Card.Content>
        </SectionCard>
      </Screen>
    );
  }

  const lesson = lessonQuery.data;

  return (
    <Screen>
      <SectionCard>
        <Card.Content style={styles.headerCard}>
          <Text style={styles.level}>{lesson.level}</Text>
          <Text style={styles.title}>{lesson.title}</Text>
          <Text style={styles.prompt}>{lesson.prompt}</Text>
          <View style={styles.badges}>
            <Text style={styles.badge}>{lesson.duration_minutes} min</Text>
            <Text style={styles.badge}>{lesson.xp} XP</Text>
            <Text style={styles.badge}>{t("lesson.speaking")}</Text>
          </View>
        </Card.Content>
      </SectionCard>

      <SectionCard>
        <Card.Content style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>{t("lesson.focus_skills")}</Text>
          <MetricBar
            label={t("lesson.pronunciation")}
            value={progressQuery.data?.pronunciation_score ?? 0}
          />
          <MetricBar
            label={t("lesson.stress_rhythm")}
            value={progressQuery.data?.fluency_score ?? 0}
          />
          <MetricBar
            label={t("lesson.confidence")}
            value={progressQuery.data?.confidence_score ?? 0}
          />
        </Card.Content>
      </SectionCard>

      <SectionCard>
        <Card.Content style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>
            {t("lesson.what_you_will_practice")}
          </Text>
          <Text style={styles.practiceText}>• {t("lesson.practice_1")}</Text>
          <Text style={styles.practiceText}>• {t("lesson.practice_2")}</Text>
          <Text style={styles.practiceText}>• {t("lesson.practice_3")}</Text>
        </Card.Content>
      </SectionCard>

      <Button
        mode="contained"
        buttonColor={colors.primary}
        textColor="#04111F"
        onPress={() =>
          navigation.navigate("Practice", {
            lessonId: lesson.id,
            prompt: lesson.prompt,
          })
        }
      >
        Start practice
      </Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerCard: {
    gap: 10,
  },
  level: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
  },
  prompt: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 4,
  },
  badge: {
    color: colors.muted,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    overflow: "hidden",
  },
  sectionBlock: {
    gap: 14,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  practiceText: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
});
