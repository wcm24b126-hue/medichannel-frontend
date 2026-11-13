# MediChannel — OpenCode Progress

## Completed phases
- PHASE 1 (read brief + inspect repos): done — brief at `~/Documents/IT404050_Assignment_2_-_MediChannel_Brief.docx`, repos at `/home/ashan/projects/medichannel-{frontend,backend}`
- PHASE 2 (baseline): done — existing `docs/ASSIGNMENT_2_REVIEW.md` (64/100 audit), `FRONTEND_EVALUATION.md`, `WEB_SECURITY_REVIEW.md`
- PHASE 3 (defect list): done — see ASSIGNMENT_2_AUDIT_REPORT.md §4
- PHASE 4 (backend security/business logic): done — `SecurityConfig` admin-only POST /doctors, manager creation endpoint, WS auth/ticket, complete-and-advance, queue broadcasts
- PHASE 5 (DB models/migrations): done — V1–V9 migrations, encryption, constraints, triggers
- PHASE 6 (frontend API integrations): done — search, booking, payment, consult, notifications, availability badge
- PHASE 7 (WebSocket): done — STOMP chat, typing, notifications, queue broadcasts; WS ticket auth
- PHASE 8 (staff provisioning + audit): done (backend); UI mostly wired
- PHASE 9 (tests): done — 56 backend tests pass, lint/tsc/build pass, smoke 44/44, e2e 32/32
- PHASE 10 (fix failures): done — fixed 500 on date search, Netlify 404, duplicate booking block, layout, etc.
- PHASE 11 (reports): done — all 7 deliverable docs created

## Current branch and commit
- Frontend: `frontend-html-app` @ `02961fc` (pushed)
- Backend: `main` @ `5e3dc15` (pushed; fast-forwarded from `feat/demo-realtime`)

## Tests executed
- Backend `./mvnw test`: 56 pass, 0 fail
- Frontend `npm run lint`: pass; `npx tsc --noEmit`: pass; `npm run build`: pass
- Smoke: 44/44 pass; E2E: 32/32 pass
- Hosted health: Render UP; sessions endpoint empty (Neon not seeded)

## Modified files
See `CHANGELOG_ASSIGNMENT_2.md`.

## Outstanding defects
1. Neon DB has no demo data — needs `APP_DEMO_SEED=true` + `APP_DEMO_PASSWORD` on Render
2. Netlify site behind Team SSO (401) — needs SSO disable by team owner for public demo
3. No TTL cache for public lists (brief §7) — not implemented
4. Email/chat plaintext; address not collected — documented
5. No refresh tokens; no email verification
6. No OpenAPI spec
7. Admin cannot create MANAGER accounts yet — backend endpoint exists, UI partial
8. Group report, ERD, 30-case test table, slides, contribution section — not in repo

## Next exact actions
1. Ensure `APP_DEMO_SEED=false` on production. In staging only, seed with a securely generated `APP_DEMO_PASSWORD`, then remove it immediately after bootstrapping.
2. Set Netlify `API_URL` to the seeded service, redeploy
3. Disable Netlify Team SSO if public demo needed
4. Run full E2E against hosted URL once data is present
5. Write group report, ERD, test table, slides, contribution section (human deliverables)