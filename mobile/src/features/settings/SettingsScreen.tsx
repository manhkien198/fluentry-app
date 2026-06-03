import React from "react";
import { StyleSheet, View } from "react-native";
import {
  Button,
  Card,
  SegmentedButtons,
  Switch,
  Text,
} from "react-native-paper";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Screen, SectionCard } from "../../shared/ui";
import { appConfig } from "../../shared/config";
import { clearAuthTokens } from "../../shared/authStorage";
import { haptic } from "../../shared/haptics";
import { showToast } from "../../shared/toast";
import {
  saveHapticsEnabled,
  saveLocale,
  saveThemeMode,
} from "../../shared/settingsStorage";
import { useAppColors } from "../../shared/useAppColors";
import { useAppStore } from "../../shared/store";
import { t } from "../../shared/i18n";
import { RootStackParamList } from "../../navigation/types";
import { radius, spacing } from "../../shared/theme";
import type { AppColors } from "../../shared/theme";

export function SettingsScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, "Settings">) {
  const colors = useAppColors();
  const themeMode = useAppStore((state) => state.themeMode);
  const setThemeMode = useAppStore((state) => state.setThemeMode);
  const clearSession = useAppStore((state) => state.clearSession);
  const hapticsEnabled = useAppStore((state) => state.hapticsEnabled);
  const setHapticsEnabled = useAppStore((state) => state.setHapticsEnabled);
  const locale = useAppStore((state) => state.locale);
  const setLocale = useAppStore((state) => state.setLocale);

  const s = styles(colors);

  return (
    <Screen>
      <SectionCard>
        <Card.Content style={s.block}>
          <Text style={s.title}>{t("settings.title")}</Text>
          <Text style={s.line}>{t("settings.subtitle")}</Text>
        </Card.Content>
      </SectionCard>

      <SectionCard>
        <Card.Content style={s.block}>
          <Text style={s.sectionTitle}>{t("settings.theme")}</Text>
          <SegmentedButtons
            value={themeMode}
            onValueChange={async (value) => {
              const mode = value as "light" | "dark";
              setThemeMode(mode);
              await saveThemeMode(mode);
            }}
            buttons={[
              { label: t("settings.theme_dark"), value: "dark" },
              { label: t("settings.theme_light"), value: "light" },
            ]}
          />
        </Card.Content>
      </SectionCard>

      <SectionCard>
        <Card.Content style={s.block}>
          <Text style={s.sectionTitle}>{t("settings.language")}</Text>
          <SegmentedButtons
            value={locale}
            onValueChange={async (value) => {
              const next = value as "en" | "vi";
              setLocale(next);
              await saveLocale(next);
            }}
            buttons={[
              { label: t("settings.lang_en"), value: "en" },
              { label: t("settings.lang_vi"), value: "vi" },
            ]}
          />
        </Card.Content>
      </SectionCard>

      <SectionCard>
        <Card.Content style={s.block}>
          <Text style={s.sectionTitle}>{t("settings.haptics")}</Text>
          <View style={s.row}>
            <Text style={s.line}>{t("settings.haptics_description")}</Text>
            <Switch
              value={hapticsEnabled}
              onValueChange={async (value) => {
                setHapticsEnabled(value);
                await saveHapticsEnabled(value);
              }}
            />
          </View>
        </Card.Content>
      </SectionCard>

      <SectionCard>
        <Card.Content style={s.block}>
          <Text style={s.sectionTitle}>{t("settings.api_sso_config")}</Text>
          <View style={s.valueBox}>
            <Text style={s.value}>
              {t("settings.api_value", { value: appConfig.apiBaseUrl })}
            </Text>
            <Text style={s.value}>
              {t("settings.google_configured", {
                value:
                  appConfig.googleWebClientId || appConfig.googleExpoClientId
                    ? t("common.yes")
                    : t("common.no"),
              })}
            </Text>
          </View>
        </Card.Content>
      </SectionCard>

      <SectionCard>
        <Card.Content style={s.block}>
          <Text style={s.sectionTitle}>{t("settings.session")}</Text>
          <Button
            mode="contained-tonal"
            buttonColor={colors.surfaceAlt}
            textColor={colors.danger}
            contentStyle={{ height: 50 }}
            onPress={async () => {
              await clearAuthTokens();
              showToast(t("toast.signed_out"), "info");
              await haptic("medium");
              clearSession();
              navigation.replace("Auth");
            }}
          >
            {t("settings.sign_out")}
          </Button>
        </Card.Content>
      </SectionCard>
    </Screen>
  );
}

const styles = (colors: AppColors) =>
  StyleSheet.create({
    block: { gap: 14 },
    title: { color: colors.text, fontSize: 24, fontWeight: "800" },
    sectionTitle: { color: colors.text, fontSize: 18, fontWeight: "800" },
    line: { color: colors.muted, fontSize: 15, lineHeight: 22 },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: spacing.md,
    },
    valueBox: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.lg,
      padding: spacing.md,
      gap: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    value: { color: colors.text, fontSize: 13, lineHeight: 20 },
  });
