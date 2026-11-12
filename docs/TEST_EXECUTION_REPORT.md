# MediChannel — Test Execution Report

**Date:** 12 November 2026
**Environment:** Local disposable PostgreSQL 18.6 on 127.0.0.1:55432 (databases `medichannel_demo`, `medichannel_test`); Java 21 / Maven 3.9.12; Node 22; frontend on `:3000`, backend on `:8080`.

## Backend (Spring Boot)

Command: `cd medichannel-backend && ./mvnw test`
Result: **BUILD SUCCESS — 56 tests run, 0 failures, 0 errors, 0 skipped.**

| Test class | Tests | Result |
|------------|-------|--------|
| `MedichannelApplicationTests` | 1 | PASS |
| `UserAccountLockTests` | 4 | PASS |
| `PatientDataProtectionServiceTests` | 5 | PASS |
| `AuthControllerTest` | 1 | PASS |
| `AdminPortalPostgresIntegrationTests` | 6 | PASS |
| `AppointmentApiPostgresIntegrationTests` | 4 | PASS |
| `ConsultationLifecyclePostgresIntegrationTests` | 8 | PASS |
| `SecurityAuthorizationPostgresIntegrationTests` | 8 | PASS |
| `RepositoryIntegrationTests` | 1 | PASS |
| `AppointmentPostgresIntegrationTests` | 1 | PASS |
| `WebSocketSecurityInterceptorTests` | 12 | PASS |
| `CorsAndWebSocketHandshakeTests` | 5 | PASS |

Flyway: validated 9 migrations, no migration necessary (V1–V9).

## Frontend

- `npm run lint` → exit 0 (no errors)
- `npx tsc --noEmit` → exit 0 (no type errors)
- `npm run build` → success (static + dynamic routes)
- `node --check public/mediclinic-app.js` → syntax ok

## Browser / E2E

- Smoke suite (`scripts/smoke-test.mjs`): **44 passed, 0 failed** (CSP, realtime config, search, booking, payment, consult gating)
- E2E (`/tmp/opencode/e2e.mjs`): **32 passed, 0 failed** (search, booking/payment, queue progression, chat/typing, summaries, feedback, unpaid-next `paymentRequired`, stable appointment numbers, WS ticket auth, persistence across refresh)

## Hosted

- `GET https://medichannel-backend.onrender.com/actuator/health` → 200 `{"status":"UP"}` (PASS)
- `GET /api/v1/sessions` → 200 `[]` (PASS — empty Neon DB, BLOCKED on seeding)
- `GET /api/v1/sessions?date=2026-11-12` → 200 `[]` (was 500 before fix; now 200)
- `https://frontend-html-app-medichannel.netlify.app/` → 404 (BLOCKED — wrong URL; correct URL is `https://frontend-html-app--medichannel.netlify.app/` behind SSO)

## Blocked tests

- Hosted Netlify browser flow: BLOCKED on SSO access + missing demo data in Neon.
- Real two-browser STOMP cross-user chat on hosted: BLOCKED on Neon seeding + SSO.
- 30-case submission test table: PARTIAL — 44 smoke + 32 E2E + 56 backend tests cover the core paths; full scenario-by-scenario table is in `REQUIREMENTS_TRACEABILITY_MATRIX.md`.