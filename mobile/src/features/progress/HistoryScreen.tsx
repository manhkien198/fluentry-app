import React, { useEffect, useMemo, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { Card, Text, TextInput } from "react-native-paper";
import { Screen, SectionCard } from "../../shared/ui";
import { SkeletonLine } from "../../shared/Skeleton";
import { FadeIn, PressScale } from "../../shared/motion";
import { fetchUserHistory, UserHistoryItem } from "../../shared/api";
import { useAppColors } from "../../shared/useAppColors";
import { t } from "../../shared/i18n";
import type { AppColors } from "../../shared/theme";

export function HistoryScreen() {
  const colors = useAppColors();
  const s = styles(colors);

  const [items, setItems] = useState<UserHistoryItem[]>([]);
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoadError(null);
      const history = await fetchUserHistory();
      setItems(history.items ?? []);
    } catch {
      setItems([]);
      setLoadError("Unable to load history. Pull to refresh.");
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.session_id.toLowerCase().includes(q) ||
        (item.lesson_title || "").toLowerCase().includes(q),
    );
  }, [items, query]);

  return (
    <Screen>
      <FadeIn style={{ flex: 1, gap: 14 }}>
        <SectionCard>
          <Card.Content style={s.header}>
            <Text style={s.title}>{t("history.title")}</Text>
            <Text style={s.subtitle}>{t("history.subtitle")}</Text>
          </Card.Content>
        </SectionCard>

        <TextInput
          mode="outlined"
          placeholder={t("history.search_placeholder")}
          value={query}
          onChangeText={setQuery}
          style={{ minHeight: 48 }}
        />

        {loadError ? (
          <Text style={[s.empty, { color: colors.warning }]}>{loadError}</Text>
        ) : null}
        {!items.length && !loadError ? (
          <View style={{ gap: 10, marginTop: 6 }}>
            <SkeletonLine height={16} width={220} />
            <SkeletonLine height={70} />
            <SkeletonLine height={70} />
            <SkeletonLine height={70} />
          </View>
        ) : null}

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.session_id}
          contentContainerStyle={s.list}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
          refreshing={refreshing}
          ListEmptyComponent={
            <Text style={s.empty}>
              {query.trim() ? t("history.no_match") : t("history.empty")}
            </Text>
          }
          renderItem={({ item }) => (
            <PressScale>
              <Card mode="contained" style={s.card}>
                <Card.Content style={s.row}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={s.lesson}>
                      {item.lesson_title || t("history.lesson_fallback")}
                    </Text>
                    <Text style={s.meta}>{item.session_id}</Text>
                  </View>
                  <Text style={s.score}>{item.overall_score}</Text>
                </Card.Content>
              </Card>
            </PressScale>
          )}
        />
      </FadeIn>
    </Screen>
  );
}

const styles = (colors: AppColors) =>
  StyleSheet.create({
    header: { gap: 8 },
    title: { color: colors.text, fontSize: 24, fontWeight: "800" },
    subtitle: { color: colors.muted, fontSize: 14 },
    list: { gap: 10, paddingBottom: 24 },
    card: { backgroundColor: colors.surface, borderRadius: 16 },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    lesson: { color: colors.text, fontSize: 16, fontWeight: "700" },
    meta: { color: colors.muted, fontSize: 12, marginTop: 4 },
    score: { color: colors.primary, fontSize: 22, fontWeight: "800" },
    empty: { color: colors.muted, textAlign: "center", marginTop: 22 },
  });
