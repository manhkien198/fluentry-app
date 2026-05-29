# SpeakUp AI Mobile (Expo) — Production Handoff

This mobile app is an ELSA-like speaking coach client with:
- Email auth + Google SSO + Apple SSO
- Secure token storage (`expo-secure-store`)
- Auto session restore on app boot
- 401 handling + refresh-token retry/backoff
- Route guard (authenticated vs unauthenticated stack)
- Theme switch + settings panel

## 1) Quick start (local)

### Prerequisites
- Node.js 20+
- Expo CLI (optional, can use `npx expo`)
- iOS Simulator / Android Emulator (or physical devices)

### Install
```bash
cd /Users/neik/Desktop/elsa_clone/mobile
npm install
cp .env.example .env
```

### Fill environment variables
Edit `/Users/neik/Desktop/elsa_clone/mobile/.env`:
- `EXPO_PUBLIC_API_BASE_URL`
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`
- `EXPO_PUBLIC_APPLE_SERVICE_ID`
- `EXPO_PUBLIC_APPLE_REDIRECT_URI`

### Run
```bash
npm run start
# or
npm run ios
npm run android
```

## 2) Env matrix (what to set where)

### Core
- `EXPO_PUBLIC_API_BASE_URL`: Backend base URL (e.g. `https://api.yourdomain.com`)
- `EXPO_PUBLIC_APP_ENV`: `development` | `staging` | `production`

### Google SSO
- `EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID`: required for Expo Go flow
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`: recommended fallback for token retrieval
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`: required for standalone iOS build
- `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`: required for standalone Android build

### Apple SSO
- `EXPO_PUBLIC_APPLE_SERVICE_ID`: Apple Service ID used by backend validation
- `EXPO_PUBLIC_APPLE_REDIRECT_URI`: redirect URI registered in Apple Developer

## 3) Backend auth contract checklist

Backend should expose and return stable JSON shapes:

- `POST /auth/login`
  - request: `{ email, password }`
  - response: `{ access_token, refresh_token?, token_type? }`
- `POST /auth/register`
  - request: `{ email, password }`
  - response: `{ status, verificationToken? }`
- `POST /auth/verify-email`
  - request: `{ token }`
  - response: `{ status }`
- `POST /auth/resend-verification`
  - request: `{ email }`
  - response: `{ status, token? }`
- `POST /auth/sso`
  - request: `{ provider: 'google'|'apple', id_token }`
  - response: `{ access_token, refresh_token?, token_type? }`
- `POST /auth/refresh`
  - request: `{ refresh_token }`
  - response: `{ access_token, refresh_token? }`

If `/auth/refresh` is unavailable, app still works but user re-login is required after token expiry.

## 4) Production checks before release

Run:
```bash
cd /Users/neik/Desktop/elsa_clone/mobile
npm run typecheck
./scripts/smoke-check.sh
```

Verify manually:
1. Sign in with email works
2. Sign in with Google works on target platform
3. Sign in with Apple works on iOS device/simulator where available
4. Relaunch app keeps logged-in state
5. Force 401 from backend => app attempts refresh then recovers or logs out cleanly
6. Settings -> Sign out clears session and returns to Auth screen

## 5) Key files
- App root: `/Users/neik/Desktop/elsa_clone/mobile/App.tsx`
- Auth UI: `/Users/neik/Desktop/elsa_clone/mobile/src/features/auth/AuthScreen.tsx`
- Settings UI: `/Users/neik/Desktop/elsa_clone/mobile/src/features/settings/SettingsScreen.tsx`
- API + interceptors: `/Users/neik/Desktop/elsa_clone/mobile/src/shared/api.ts`
- Token storage: `/Users/neik/Desktop/elsa_clone/mobile/src/shared/authStorage.ts`
- Global store: `/Users/neik/Desktop/elsa_clone/mobile/src/shared/store.ts`
- Smoke script: `/Users/neik/Desktop/elsa_clone/mobile/scripts/smoke-check.sh`

## 6) Troubleshooting

- `Google (disabled)` button:
  - Missing Google client IDs in `.env`
- Immediate logout after login:
  - Backend token invalid or `/auth/refresh` contract mismatch
- SSO returns token but backend rejects:
  - Check backend verification against correct Google/Apple audience/client ID
- API not reachable from device:
  - Ensure mobile device can access `EXPO_PUBLIC_API_BASE_URL`

