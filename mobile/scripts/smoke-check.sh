#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "[1/4] Check critical files"
for f in \
  "$ROOT/.env.example" \
  "$ROOT/src/shared/api.ts" \
  "$ROOT/src/shared/authStorage.ts" \
  "$ROOT/src/features/auth/AuthScreen.tsx" \
  "$ROOT/src/features/settings/SettingsScreen.tsx" \
  "$ROOT/App.tsx"; do
  [ -f "$f" ] || { echo "Missing: $f"; exit 1; }
done

echo "[2/4] Check env placeholders"
grep -q "EXPO_PUBLIC_API_BASE_URL" "$ROOT/.env.example"
grep -q "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID" "$ROOT/.env.example"
grep -q "EXPO_PUBLIC_APPLE_SERVICE_ID" "$ROOT/.env.example"

echo "[3/4] TypeScript"
"$ROOT/node_modules/.bin/tsc" --noEmit -p "$ROOT/tsconfig.json"

echo "[4/4] Auth endpoints references"
grep -q "/auth/login" "$ROOT/src/shared/api.ts"
grep -q "/auth/sso" "$ROOT/src/shared/api.ts"
grep -q "/auth/refresh" "$ROOT/src/shared/api.ts"

echo "Smoke check passed"
