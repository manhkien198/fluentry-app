import React, { useEffect, useState } from "react";
import { FlatList, StyleSheet } from "react-native";
import { Card, Text } from "react-native-paper";
import { Screen, SectionCard } from "../../shared/ui";
import { fetchDrills, DrillItem } from "../../shared/api";
import { useAppColors } from "../../shared/useAppColors";
import { t } from "../../shared/i18n";
import type { AppColors } from "../../shared/theme";

export function DrillsScreen() {
  const colors = useAppColors();
  const s = styles(colors);

  const [items, setItems] = useState<DrillItem[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const result = await fetchDrills({ limit: 30 });
        if (mounted) setItems(result.items || []);
      } catch {
        if (mounted) setItems([]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <Screen>
      <SectionCard>
        <Card.Content style={s.header}>
          <Text style={s.title}>{t("drills.title")}</Text>
          <Text style={s.sub}>{t("drills.subtitle")}</Text>
        </Card.Content>
      </SectionCard>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.list}
        ListEmptyComponent={<Text style={s.empty}>{t("drills.empty")}</Text>}
        renderItem={({ item }) => (
          <Card mode="contained" style={s.card}>
            <Card.Content style={s.body}>
              <Text style={s.sound}>
                {item.sound.toUpperCase()} · {item.mode}
              </Text>
              <Text style={s.name}>{item.title}</Text>
              <Text style={s.prompt}>{item.prompt}</Text>
            </Card.Content>
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = (colors: AppColors) =>
  StyleSheet.create({
    header: { gap: 8 },
    title: { color: colors.text, fontSize: 24, fontWeight: "800" },
    sub: { color: colors.muted, fontSize: 14 },
    list: { gap: 10, paddingBottom: 24 },
    card: { backgroundColor: colors.surface, borderRadius: 16 },
    body: { gap: 6 },
    sound: { color: colors.primary, fontSize: 12, fontWeight: "700" },
    name: { color: colors.text, fontSize: 16, fontWeight: "700" },
    prompt: { color: colors.muted, fontSize: 13, lineHeight: 19 },
    empty: { color: colors.muted, textAlign: "center", marginTop: 32 },
  });
