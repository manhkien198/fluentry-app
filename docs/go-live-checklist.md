# Go-live checklist

## 1) Quality gate
- [ ] Backend tests pass with coverage report
- [ ] Mobile tests pass with coverage report
- [ ] TypeScript typecheck passes
- [ ] SonarQube scan passes quality gate
- [ ] Mobile critical E2E flow passes (`mobile/.maestro/critical-flow.yaml`)

## 2) Production configuration
- [ ] `APP_ENV=production` configured on backend
- [ ] `CORS_ALLOW_ORIGINS` set to explicit domains only
- [ ] Mobile `EXPO_PUBLIC_API_BASE_URL` set to production API URL
- [ ] Secrets are stored in CI/host secret manager

## 2.1) Production required env (backend)
- [ ] `JWT_SECRET` is set and length is at least 32 characters
- [ ] `METRICS_TOKEN` is set (do not expose `/metrics` without token/network controls)
- [ ] `SEED_CONTENT_ENABLED=false` (avoid auto-seeding lesson/drill demo content in production)
- [ ] If `SSO_VERIFY_SIGNATURE=true`, set:
  - [ ] `SSO_GOOGLE_AUDIENCE`
  - [ ] `SSO_APPLE_AUDIENCE`

## 3) Runtime hardening
- [ ] `/health` and `/ready` endpoints monitored
- [ ] Request logs centralized and searchable
- [ ] Timeout/retry behavior verified for practice flow

## 4) Observability
- [ ] Analytics events visible in dashboard
- [ ] Failure events (`practice_score_failed`) alerting configured
- [ ] `/metrics` protected via `METRICS_TOKEN` and private network routing

## 5) Release execution
- [ ] Tag release version
- [ ] Roll out backend
- [ ] Roll out mobile build
- [ ] Run post-deploy smoke tests
- [ ] Verify practice upload/scoring retry UX on unstable network (timeout/offline/server)
- [ ] Dependency audits pass (`pip-audit`, `npm audit --audit-level=high`)
