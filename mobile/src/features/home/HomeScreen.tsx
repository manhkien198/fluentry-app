import React from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { Button, Card, Text } from "react-native-paper";
import { RootStackParamList } from "../../navigation/types";
import { fetchLessons, fetchUserProgress } from "../../shared/api";
import { useAppColors } from "../../shared/useAppColors";
import { t } from "../../shared/i18n";
import { ScorePill, Screen, SectionCard } from "../../shared/ui";
import { FadeIn, PressScale } from "../../shared/motion";
import { useAppStore } from "../../shared/store";

export function HomeScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, "Home">) {
  const colors = useAppColors();
  const { selectLesson } = useAppStore();

  const progressQuery = useQuery({
    queryKey: ["users", "me", "progress"],
    queryFn: fetchUserProgress,
    staleTime: 30_000,
  });

  const streak = progressQuery.data?.streak ?? 0;
  const xp = progressQuery.data?.xp ?? 0;

  const lessonsQuery = useQuery({
    queryKey: ["lessons"],
    queryFn: fetchLessons,
    staleTime: 60_000,
  });

  const lessons = lessonsQuery.data ?? [];

  const s = styles(colors);

  return (
    <Screen>
      <FadeIn style={{ flex: 1, gap: 14 }}>
        <SectionCard>
          <Card.Content style={s.heroContent}>
            <Text style={s.heroTitle}>{t("home.title")}</Text>
            <Text style={s.heroSubtitle}>{t("home.subtitle")}</Text>
            <Text style={s.heroHint}>{t("home.tip")}</Text>
            <View style={s.pillRow}>
              <ScorePill
                label={t("home.streak")}
                value={t("progress.days", { count: streak })}
              />
              <ScorePill label={t("home.xp")} value={`${xp}`} />
              <ScorePill label={t("home.goal")} value={t("home.goal_value")} />
            </View>
            <Button
              mode="contained"
              buttonColor={colors.primary}
              textColor="#04111F"
              onPress={() => {
                if (!lessons.length) return;
                selectLesson(lessons[0].id);
                navigation.navigate("Lesson", { lessonId: lessons[0].id });
              }}
            >
              {t("home.continue")}
            </Button>
          </Card.Content>
        </SectionCard>

        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>{t("home.recommended")}</Text>
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
            <Button
              compact
              textColor={colors.primary}
              onPress={() => navigation.navigate("Trends")}
            >
              {t("nav.trends")}
            </Button>
            <Button
              compact
              textColor={colors.primary}
              onPress={() => navigation.navigate("Drills")}
            >
              {t("nav.drills")}
            </Button>
            <Button
              compact
              textColor={colors.primary}
              onPress={() => navigation.navigate("ContentInfo")}
            >
              {t("nav.content")}
            </Button>
            <Button
              compact
              textColor={colors.primary}
              onPress={() => navigation.navigate("Settings")}
            >
              {t("nav.settings")}
            </Button>
          </View>
        </View>

        <FlatList
          data={lessons}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.listContent}
          renderItem={({ item }) => (
            <PressScale
              onPress={() => {
                selectLesson(item.id);
                navigation.navigate("Lesson", { lessonId: item.id });
              }}
            >
              <Card style={s.lessonCard} mode="contained">
                <Card.Content style={s.lessonContent}>
                  <View>
                    <Text style={s.lessonLevel}>{item.level}</Text>
                    <Text style={s.lessonTitle}>{item.title}</Text>
                    <Text style={s.lessonMeta}>
                      {t("progress.minutes", {
                        count: item.duration_minutes,
                      })}{" "}
                      · {item.xp} XP
                    </Text>
                  </View>
                  <Button mode="contained-tonal" textColor={colors.text}>
                    Start
                  </Button>
                </Card.Content>
              </Card>
            </PressScale>
          )}
          ListEmptyComponent={
            lessonsQuery.isLoading ? (
              <Text style={s.lessonMeta}>{t("common.loading")}</Text>
            ) : lessonsQuery.isError ? (
              <View style={{ gap: 10 }}>
                <Text style={s.lessonMeta}>{t("common.na")}</Text>
                <Button
                  mode="outlined"
                  textColor={colors.text}
                  onPress={() => lessonsQuery.refetch()}
                >
                  {t("common.retry")}
                </Button>
              </View>
            ) : (
              <Text style={s.lessonMeta}>{t("common.na")}</Text>
            )
          }
        />
      </FadeIn>
    </Screen>
  );
}

const styles = (colors: any) =>
  StyleSheet.create({
    heroContent: { gap: 18 },
    heroTitle: { color: colors.text, fontSize: 26, fontWeight: "800" },
    heroSubtitle: { color: colors.muted, fontSize: 15, lineHeight: 22 },
    heroHint: { color: colors.primary, fontSize: 12, fontWeight: "600" },
    pillRow: { flexDirection: "row", gap: 10 },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    sectionTitle: { color: colors.text, fontSize: 20, fontWeight: "700" },
    listContent: { gap: 14, paddingBottom: 24 },
    lessonCard: { backgroundColor: colors.surface, borderRadius: 22 },
    lessonContent: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    lessonLevel: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: "700",
      marginBottom: 6,
    },
    lessonTitle: { color: colors.text, fontSize: 18, fontWeight: "700" },
    lessonMeta: { color: colors.muted, marginTop: 8 },
  });
