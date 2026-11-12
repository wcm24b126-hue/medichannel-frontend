# MediChannel — Deployment Checklist (IT404050 Assignment 2)

## Render (backend)
- Service: `medichannel-backend` (Singapore, Docker from `render.yaml`)
- Branch: `main` (auto-deploy on commit)
- Health check: `/actuator/health` → `{"status":"UP"}`
- Build: `./mvnw -DskipTests package` via `Dockerfile`
- Required env vars (NAMES only):
  - `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` (Neon connection)
  - `JWT_SECRET`, `ENCRYPTION_KEY`, `HMAC_SECRET` (32+ chars each)
  - `APP_FRONTEND_ORIGIN` (exact Netlify URL, no wildcard)
  - `APP_DEMO_SEED=true`, `APP_DEMO_PASSWORD=MediDemo#2026!` (to populate Neon)
  - `PORT=8080`
- WebSocket: `/ws` (STOMP), allowed origin from `APP_FRONTEND_ORIGIN`
- CORS: frontend origin only

## Netlify (frontend)
- Site: `medichannel` (id `b8e3e76b-b3df-47f4-a813-9f6cfc8b96f1`)
- Branch: `frontend-html-app`
- Build: `npm run lint && npm run build`; publish `.next`
- Plugin: `@netlify/plugin-nextjs` (added in `02961fc`)
- Required env vars: `API_URL=https://medichannel-backend.onrender.com`, `NODE_VERSION=22`
- WebSocket config route: `/api/realtime/config` returns the backend WS URL

## Neon (database)
- Project: `twilight-poetry-29539364`, branch `production`
- Flyway runs at startup; 9 migrations V1–V9
- Use direct (non-pooled) endpoint for Flyway
- Isolate dev/test on a separate Neon branch (see `render-staging.yaml`)

## WebSocket configuration
- Endpoint: `/ws` (SockJS + STOMP)
- Broker prefixes: `/app`, `/topic`, `/queue`
- Auth: short-lived 60s JWT ticket with `scope=ws`
- Reconnect: automatic with exponential backoff

## Migration process
- Forward-only migrations (never edit applied ones)
- Test against disposable local DB first
- Production: never run destructive tests

## Production security
- HTTPS everywhere, wss:// for WebSockets
- HSTS in production
- CSP hash-locked for inline scripts
- `X-Frame-Options: DENY`, `COOP: same-origin`
- No secrets in source or Git history