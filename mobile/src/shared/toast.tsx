import React from "react";
import { StyleSheet } from "react-native";
import { Snackbar } from "react-native-paper";
import { create } from "zustand";
import { t } from "./i18n";
import { useAppColors } from "./useAppColors";

type ToastState = {
  visible: boolean;
  message: string;
  kind: "info" | "success" | "error";
  show: (message: string, kind?: ToastState["kind"]) => void;
  hide: () => void;
};

const useToastStore = create<ToastState>((set) => ({
  visible: false,
  message: "",
  kind: "info",
  show: (message, kind = "info") => set({ visible: true, message, kind }),
  hide: () => set({ visible: false }),
}));

export function showToast(message: string, kind: ToastState["kind"] = "info") {
  useToastStore.getState().show(message, kind);
}

export function ToastHost() {
  const colors = useAppColors();
  const { visible, message, kind, hide } = useToastStore();

  const background =
    kind === "error"
      ? colors.danger
      : kind === "success"
        ? colors.success
        : colors.surfaceAlt;
  const textColor = kind === "info" ? colors.text : "#071019";

  const styles = StyleSheet.create({
    snack: { backgroundColor: background, borderRadius: 14 },
    text: { color: textColor, fontWeight: "700" },
  });

  return (
    <Snackbar
      visible={visible}
      onDismiss={hide}
      duration={2400}
      style={styles.snack}
      action={{ label: t("common.ok"), onPress: hide, textColor }}
    >
      {message}
    </Snackbar>
  );
}
