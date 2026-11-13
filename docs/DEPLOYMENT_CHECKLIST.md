# MediChannel — Deployment Checklist (IT404050 Assignment 2)

## Render (backend)
- Service: `medichannel-backend` (Singapore, Docker from `render.yaml`)
- Branch: `main` (auto-deploy on commit)
- Health check: `/actuator/health` → `{"status":"UP"}`
- Build: `./mvnw -DskipTests package` via `Dockerfile`
- Required environment variable names (set values only in the Render dashboard):
  - `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` (Neon connection)
  - `JWT_SECRET`, `ENCRYPTION_KEY`, `HMAC_SECRET` (Base64-encoded keys; never commit values)
  - `APP_FRONTEND_ORIGIN` (exact deployed frontend origin; no wildcard)
  - `APP_DEMO_SEED=false` (production: demo seeding must remain disabled)
  - `PORT=8080`
- Do not configure `APP_DEMO_PASSWORD` in production.
- WebSocket: `/ws` (STOMP), allowed origin from `APP_FRONTEND_ORIGIN`
- CORS: frontend origin only

## Netlify (frontend)
- Site: `medichannel`
- Branch: `frontend-html-app`
- Build: `npm run lint && npm run build`; publish using the configured Next.js adapter
- Plugin: `@netlify/plugin-nextjs`
- Required environment variables: `API_URL=https://medichannel-backend.onrender.com`, `NODE_VERSION=22`
- WebSocket config route: `/api/realtime/config` returns the backend WS URL

## Neon (database)
- Use the production database only for live application data.
- Use a separate Neon branch/database for development and destructive tests.
- Flyway migrations run at application startup; review every migration before production deployment.
- Use the direct (non-pooled) endpoint for Flyway.

## WebSocket configuration
- Endpoint: `/ws` (STOMP)
- Broker prefixes: `/app`, `/topic`, `/queue`
- Auth: short-lived 60-second JWT ticket with `scope=ws`
- Reconnect: automatic with exponential backoff
- Every subscription and message must be authorized server-side.

## Demo and test accounts
- Never publish demo usernames/passwords, password hashes, or live access details in GitHub.
- Do not seed demo users or demo appointments in production.
- Keep fictional test data in a separate development/staging database.
- Supply one test account per required role through the assignment submission form, not in source code or public documentation.
- If a demo credential has ever been committed, rotate it and deactivate existing accounts that use it. Removing the text from the latest commit does not invalidate an exposed password.

## Migration process
- Forward-only migrations (never edit applied ones).
- Test against a disposable local/staging database first.
- Never run destructive tests against production.

## Production security
- HTTPS everywhere; WSS for WebSockets.
- HSTS in production.
- CSP hash-locked for inline scripts; remove development-only origins from production directives.
- `X-Frame-Options: DENY`, `COOP: same-origin`, and `X-Content-Type-Options: nosniff`.
- Personal/medical API responses must use `Cache-Control: no-store`.
- No secrets in source, build output, logs, or Git history.
