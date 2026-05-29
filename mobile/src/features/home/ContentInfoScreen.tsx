import React, { useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import { Card, Text } from "react-native-paper";
import { Screen, SectionCard } from "../../shared/ui";
import { fetchContentVersion } from "../../shared/api";
import { useAppColors } from "../../shared/useAppColors";
import { t } from "../../shared/i18n";
import type { AppColors } from "../../shared/theme";

export function ContentInfoScreen() {
  const colors = useAppColors();
  const s = styles(colors);

  const [version, setVersion] = useState<{
    version?: string;
    checksum?: string;
    updated_at?: string;
  }>({});

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await fetchContentVersion();
        if (mounted) setVersion(data || {});
      } catch {
        if (mounted) setVersion({});
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
          <Text style={s.title}>{t("content.title")}</Text>
          <Text style={s.line}>
            {t("content.version")}: {version.version || t("content.na")}
          </Text>
          <Text style={s.line}>
            {t("content.checksum")}: {version.checksum || t("content.na")}
          </Text>
          <Text style={s.line}>
            {t("content.updated")}: {version.updated_at || t("content.na")}
          </Text>
        </Card.Content>
      </SectionCard>
    </Screen>
  );
}

const styles = (colors: AppColors) =>
  StyleSheet.create({
    block: { gap: 8 },
    title: { color: colors.text, fontSize: 24, fontWeight: "800" },
    line: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  });
