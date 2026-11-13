# MediChannel — Deployment Checklist (IT404050 Assignment 2)

## Repositories and targets

| Component | Repository | Host |
| --- | --- | --- |
| Next.js frontend | `medichannel-frontend` | Netlify |
| Spring Boot API | `medichannel-backend` | Render (Docker) |
| PostgreSQL | Neon project | Neon |

Both repositories deploy from their `main` branch.

## Render (backend)

- Service: `medichannel-backend` (Singapore, Docker from the backend `render.yaml`)
- Branch: `main` (auto-deploy on commit)
- Health check: `/actuator/health` → `{"status":"UP"}`
- Build: `./mvnw -DskipTests package` via the backend `Dockerfile`
- Required env vars (names only):
  - `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` (Neon; `DB_URL` must be JDBC and include `sslmode=require`)
  - `JWT_SECRET`, `ENCRYPTION_KEY`, `HMAC_SECRET` (independent Base64-encoded 32+ byte keys)
  - `APP_FRONTEND_ORIGIN` (exact Netlify URL, no wildcard, no trailing slash)
  - `APP_ADMIN_EMAIL`, `APP_ADMIN_PASSWORD` (first-admin bootstrap; 8+ characters with a letter, a number and a symbol)
  - `APP_DEMO_SEED=false` in production (only enable in isolated staging with `APP_DEMO_PASSWORD=<STRONG_RANDOM_PASSWORD>`)
  - `PORT=8080` (Render also injects `PORT`)
- WebSocket: `/ws` (STOMP), allowed origin from `APP_FRONTEND_ORIGIN`
- CORS: frontend origin only

## Netlify (frontend)

- Site: `medichannel`
- Branch: `main`
- Build: `npm run lint && npm run build`; publish `.next`
- Plugin: `@netlify/plugin-nextjs`
- Node: 22 (set in `netlify.toml`)
- Required env vars:
  - `API_URL=https://medichannel-backend.onrender.com` (server-side only; no `NEXT_PUBLIC_` prefix)
- The CSP `connect-src` is derived from `API_URL` at build time, so set `API_URL` before the first deploy and rebuild after changing it.
- WebSocket config route: `/api/realtime/config` returns the backend WS URL derived from `API_URL`.

## Neon (database)

- Flyway runs at startup; the current migration set is V1–V15.
- Use the direct (non-pooled) endpoint for Flyway.
- Isolate dev/test on a separate Neon branch (see the backend `render-staging.yaml`).
- Never point local tests or demo seeding at the production branch.

## WebSocket configuration

- Endpoint: `/ws` (SockJS + STOMP)
- Broker prefixes: `/app`, `/topic`, `/queue`
- Auth: short-lived 60s JWT ticket with `scope=ws`
- Reconnect: automatic with exponential backoff

## Migration process

- Forward-only migrations (never edit applied ones)
- Test against a disposable local PostgreSQL database first
- Production: never run destructive tests

## Production security

- HTTPS everywhere, `wss://` for WebSockets
- HSTS in production
- CSP hash-locked for inline scripts
- `X-Frame-Options: DENY`, `COOP: same-origin`
- No secrets in source or Git history
- Audit logs and `/topic/audit-logs` are ADMIN-only
- Public ratings show only APPROVED reviews

## Post-deploy verification

1. `GET https://<backend>/actuator/health` returns `UP`.
2. `GET https://<netlify-site>/api/backend/wake` returns `{"status":"ready"}`.
3. `GET https://<netlify-site>/api/backend/doctors` returns the catalogue.
4. Register a patient, sign in, book an appointment, and confirm the queue card updates.
5. Sign in as ADMIN and confirm audit logs and notices load.
6. Confirm the browser console shows no CSP violations.
