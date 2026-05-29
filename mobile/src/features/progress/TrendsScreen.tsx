import React, { useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import { Card, Text } from "react-native-paper";
import { Screen, SectionCard } from "../../shared/ui";
import { SkeletonLine } from "../../shared/Skeleton";
import { api } from "../../shared/api";
import { useAppColors } from "../../shared/useAppColors";
import { t } from "../../shared/i18n";
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

  return (
    <Screen>
      <SectionCard>
        <Card.Content style={s.block}>
          <Text style={s.title}>{t("trends.title")}</Text>
          <Text style={s.line}>
            {t("trends.today_minutes", {
              today: data.today_minutes ?? 0,
              target: data.daily_target_minutes ?? 15,
            })}
          </Text>
          {loading ? (
            <>
              <SkeletonLine height={14} width={180} />
              <SkeletonLine height={14} width={"90%"} />
            </>
          ) : null}
        </Card.Content>
      </SectionCard>

      <SectionCard>
        <Card.Content style={s.block}>
          <Text style={s.subtitle}>{t("trends.score_trends_latest")}</Text>
          <Text style={s.line}>
            {t("trends.overall_values", {
              value:
                (data.trend?.overall || []).slice(-5).join(", ") ||
                t("common.na"),
            })}
          </Text>
          <Text style={s.line}>
            {t("trends.pronunciation_values", {
              value:
                (data.trend?.pronunciation || []).slice(-5).join(", ") ||
                t("common.na"),
            })}
          </Text>
          <Text style={s.line}>
            {t("trends.fluency_values", {
              value:
                (data.trend?.fluency || []).slice(-5).join(", ") ||
                t("common.na"),
            })}
          </Text>
        </Card.Content>
      </SectionCard>

      <SectionCard>
        <Card.Content style={s.block}>
          <Text style={s.subtitle}>{t("trends.achievements")}</Text>
          {(data.achievements || []).map((a) => (
            <Text key={a.id} style={s.line}>
              • {a.title}: {a.value}
            </Text>
          ))}
          {!(data.achievements || []).length ? (
            <Text style={s.line}>{t("trends.no_achievements")}</Text>
          ) : null}
        </Card.Content>
      </SectionCard>
    </Screen>
  );
}

const styles = (colors: AppColors) =>
  StyleSheet.create({
    block: { gap: 10 },
    title: { color: colors.text, fontSize: 24, fontWeight: "800" },
    subtitle: { color: colors.text, fontSize: 18, fontWeight: "700" },
    line: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  });
