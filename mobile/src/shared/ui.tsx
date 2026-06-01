import React, { PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";
import { Card, ProgressBar, Text } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { radius, spacing, typography } from "./theme";
import { useAppColors } from "./useAppColors";

export function Screen({ children }: PropsWithChildren) {
  const colors = useAppColors();
  const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    inner: {
      flex: 1,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.lg,
      gap: spacing.md,
    },
  });
  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <View style={styles.inner}>{children}</View>
    </SafeAreaView>
  );
}

export function SectionCard({ children }: PropsWithChildren) {
  const colors = useAppColors();
  const styles = StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.xs,
    },
  });
  return (
    <Card style={styles.card} mode="contained">
      {children}
    </Card>
  );
}

export function ScorePill({ label, value }: { label: string; value: string }) {
  const colors = useAppColors();
  const styles = StyleSheet.create({
    pill: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      gap: 1,
      minWidth: 88,
    },
    pillLabel: { color: colors.muted, ...typography.caption },
    pillValue: { color: colors.text, fontSize: 17, fontWeight: "700" },
  });

  return (
    <View style={styles.pill}>
      <Text style={styles.pillLabel}>{label}</Text>
      <Text style={styles.pillValue}>{value}</Text>
    </View>
  );
}

export function MetricBar({ label, value }: { label: string; value: number }) {
  const colors = useAppColors();
  const safe = Math.max(0, Math.min(100, value));
  const styles = StyleSheet.create({
    metricWrap: { gap: spacing.sm },
    metricHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    metricLabel: { color: colors.text, ...typography.body, fontWeight: "600" },
    metricValue: { color: colors.primary, ...typography.label, fontWeight: "800" },
    progress: { height: 9, borderRadius: radius.full, backgroundColor: colors.border },
  });

  return (
    <View style={styles.metricWrap}>
      <View style={styles.metricHeader}>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={styles.metricValue}>{safe}%</Text>
      </View>
      <ProgressBar
        progress={safe / 100}
        color={colors.primary}
        style={styles.progress}
      />
    </View>
  );
}
