import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, SegmentedButtons, Text, Button, Switch } from 'react-native-paper';
import { Screen, SectionCard } from '../../shared/ui';
import { useAppStore } from '../../shared/store';
import { appConfig } from '../../shared/config';
import { clearAuthTokens } from '../../shared/authStorage';
import { haptic } from '../../shared/haptics';
import { showToast } from '../../shared/toast';
import { saveHapticsEnabled, saveLocale, saveThemeMode } from '../../shared/settingsStorage';
import { useAppColors } from '../../shared/useAppColors';
import { t } from '../../shared/i18n';

export function SettingsScreen({ navigation }: any) {
  const colors = useAppColors();
  const themeMode = useAppStore((state) => state.themeMode);
  const setThemeMode = useAppStore((state) => state.setThemeMode);
  const clearSession = useAppStore((state) => state.clearSession);
  const hapticsEnabled = useAppStore((state) => state.hapticsEnabled);
  const setHapticsEnabled = useAppStore((state) => state.setHapticsEnabled);
  const locale = useAppStore((state) => state.locale);
  const setLocale = useAppStore((state) => state.setLocale);

  const styles = StyleSheet.create({
    block: { gap: 14 },
    title: { color: colors.text, fontSize: 24, fontWeight: '800' },
    sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
    line: { color: colors.muted, fontSize: 15, lineHeight: 22 },
    valueBox: { backgroundColor: colors.surfaceAlt, borderRadius: 12, padding: 12, gap: 8 },
    value: { color: colors.text, fontSize: 13 },
  });

  return (
    <Screen>
      <SectionCard>
        <Card.Content style={styles.block}>
          <Text style={styles.title}>{t('settings.title')}</Text>
          <Text style={styles.line}>{t('settings.subtitle')}</Text>
        </Card.Content>
      </SectionCard>

      <SectionCard>
        <Card.Content style={styles.block}>
          <Text style={styles.sectionTitle}>{t('settings.theme')}</Text>
          <SegmentedButtons
            value={themeMode}
            onValueChange={async (value) => { const mode = value as 'light' | 'dark'; setThemeMode(mode); await saveThemeMode(mode); }}
            buttons={[
              { label: t('settings.theme_dark'), value: 'dark' },
              { label: t('settings.theme_light'), value: 'light' },
            ]}
          />
        </Card.Content>
      </SectionCard>

      <SectionCard>
        <Card.Content style={styles.block}>
          <Text style={styles.sectionTitle}>{t('settings.language')}</Text>
          <SegmentedButtons
            value={locale}
            onValueChange={async (value) => { const next = value as 'en' | 'vi'; setLocale(next); await saveLocale(next); }}
            buttons={[{ label: t('settings.lang_en'), value: 'en' }, { label: t('settings.lang_vi'), value: 'vi' }]}
          />
        </Card.Content>
      </SectionCard>

      <SectionCard>
        <Card.Content style={styles.block}>
          <Text style={styles.sectionTitle}>{t('settings.api_sso_config')}</Text>
          <View style={styles.valueBox}>
            <Text style={styles.value}>{t('settings.api_value', { value: appConfig.apiBaseUrl })}</Text>
            <Text style={styles.value}>
              {t('settings.google_configured', { value: appConfig.googleWebClientId || appConfig.googleExpoClientId ? t('common.yes') : t('common.no') })}
            </Text>
            <Text style={styles.value}>
              {t('settings.apple_service_id', { value: appConfig.appleServiceId ? t('common.set') : t('common.missing') })}
            </Text>
          </View>
        </Card.Content>
      </SectionCard>

      <SectionCard>
        <Card.Content style={styles.block}>
          <Text style={styles.sectionTitle}>{t('settings.session')}</Text>
          <Button
            mode="outlined"
            textColor={colors.danger}
            onPress={async () => {
              await clearAuthTokens();
              showToast(t('toast.signed_out'), 'info');
              await haptic('medium');
              clearSession();
              navigation.replace('Auth');
            }}
          >
            {t('settings.sign_out')}
          </Button>
        </Card.Content>
      </SectionCard>

    </Screen>
  );
}
