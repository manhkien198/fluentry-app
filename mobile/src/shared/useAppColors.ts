import { useMemo } from "react";
import { resolveColors } from "./theme";
import { useAppStore } from "./store";

export function useAppColors() {
  const themeMode = useAppStore((s) => s.themeMode);
  return useMemo(() => resolveColors(themeMode), [themeMode]);
}
