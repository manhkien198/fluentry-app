import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Card, Text } from "react-native-paper";
import { Screen, SectionCard, ScorePill, MetricBar } from "../../shared/ui";
import { SkeletonLine } from "../../shared/Skeleton";
import { api } from "../../shared/api";
import { useAppColors } from "../../shared/useAppColors";
import { t } from "../../shared/i18n";
import { spacing, typography, radius } from "../../shared/theme";
import type { AppColors } from "../../shared/theme";

type TrendsPayload = {
  trend?: { overall?: number[]; pronunciation?: number[]; fluency?: number[] };
  consistency?: number[];
  achievements?: { id: string; title: string; value: string }[];
  today_minutes?: number;
  daily_target_minutes?: number;
};

export function TrendsScreen() {
  const colors = useAppColors();
  const s = styles(colors);

  const [data, setData] = useState<TrendsPayload>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const response = await api.get<TrendsPayload>("/users/me/trends");
        if (mounted) setData(response.data || {});
      } catch {
        if (mounted) setData({});
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const overall = (data.trend?.overall || []).slice(-5);
  const pronunciation = (data.trend?.pronunciation || []).slice(-5);
  const fluency = (data.trend?.fluency || []).slice(-5);

  return (
    <Screen>
      <SectionCard>
        <Card.Content style={s.block}>
          <Text style={s.title}>{t("trends.title")}</Text>
          <View style={s.pillRow}>
            <ScorePill
              label={t("progress.minutes", { count: data.today_minutes ?? 0 })}
              value={t("trends.today_minutes", {
                today: data.today_minutes ?? 0,
                target: data.daily_target_minutes ?? 15,
              })}
            />
            <ScorePill
              label={t("progress.days", { count: data.consistency?.slice(-1)[0] ?? 0 })}
              value={t("common.yes")}
            />
          </View>
          {loading ? (
            <View style={{ gap: spacing.sm }}>
              <SkeletonLine height={14} width={180} />
              <SkeletonLine height={14} width={"90%"} />
            </View>
          ) : null}
        </Card.Content>
      </SectionCard>

      <SectionCard>
        <Card.Content style={s.block}>
          <Text style={s.subtitle}>{t("trends.score_trends_latest")}</Text>
          <MetricBar
            label={t("trends.overall_values", {
              value: overall.join(", ") || t("common.na"),
            })}
            value={overall.at(-1) ?? 0}
          />
          <MetricBar
            label={t("trends.pronunciation_values", {
              value: pronunciation.join(", ") || t("common.na"),
            })}
            value={pronunciation.at(-1) ?? 0}
          />
          <MetricBar
            label={t("trends.fluency_values", {
              value: fluency.join(", ") || t("common.na"),
            })}
            value={fluency.at(-1) ?? 0}
          />
        </Card.Content>
      </SectionCard>

      <SectionCard>
        <Card.Content style={s.block}>
          <Text style={s.subtitle}>{t("trends.achievements")}</Text>
          <View style={s.achievements}>
            {(data.achievements || []).map((a) => (
              <View key={a.id} style={s.achievementCard}>
                <Text style={s.achievementTitle}>{a.title}</Text>
                <Text style={s.achievementValue}>{a.value}</Text>
              </View>
            ))}
            {!(data.achievements || []).length ? (
              <Text style={s.line}>{t("trends.no_achievements")}</Text>
            ) : null}
          </View>
        </Card.Content>
      </SectionCard>

      <SectionCard>
        <Card.Content style={s.block}>
          <Text style={s.subtitle}>{t("trends.score_trends_latest")}</Text>
          <MetricBar
            label={t("trends.overall_values", {
              value: overall.join(", ") || t("common.na"),
            })}
            value={overall.at(-1) ?? 0}
          />
          <MetricBar
            label={t("trends.pronunciation_values", {
              value: pronunciation.join(", ") || t("common.na"),
            })}
            value={pronunciation.at(-1) ?? 0}
          />
          <MetricBar
            label={t("trends.fluency_values", {
              value: fluency.join(", ") || t("common.na"),
            })}
            value={fluency.at(-1) ?? 0}
          />
        </Card.Content>
      </SectionCard>

      <SectionCard>
        <Card.Content style={s.block}>
          <Text style={s.subtitle}>{t("trends.achievements")}</Text>
          <View style={s.achievements}>
            {(data.achievements || []).map((a) => (
              <View key={a.id} style={s.achievementCard}>
                <Text style={s.achievementTitle}>{a.title}</Text>
                <Text style={s.achievementValue}>{a.value}</Text>
              </View>
            ))}
            {!(data.achievements || []).length ? (
              <Text style={s.line}>{t("trends.no_achievements")}</Text>
            ) : null}
          </View>
        </Card.Content>
      </SectionCard>
    </Screen>
  );
}

const styles = (colors: AppColors) =>
  StyleSheet.create({
    block: { gap: spacing.sm + 2 },
    title: { color: colors.text, ...typography.title },
    subtitle: { color: colors.text, ...typography.subtitle },
    line: { color: colors.muted, ...typography.body },
    pillRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
    achievements: { gap: spacing.sm },
    achievementCard: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      gap: spacing.xs,
    },
    achievementTitle: { color: colors.text, ...typography.body, fontWeight: "700" },
    achievementValue: { color: colors.primary, ...typography.label, fontWeight: "800" },
  });
