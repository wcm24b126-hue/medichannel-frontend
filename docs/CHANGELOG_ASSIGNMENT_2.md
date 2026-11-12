# MediChannel — Change Log (Assignment 2)

## Frontend (branch `frontend-html-app`)

| Commit | Change |
|--------|--------|
| `fa10bcb` | Brand-link fix + review docs |
| `f252510` | BFF client, vendored STOMP, realtime config route, CSP, centred auth cards, search/results/booking panels, doctor console, consultation room, split promo layout |
| `e5efdc9` | Add missing session search/list containers |
| `852583e` | Doctor availability status badge + booking restriction; notification polling, toast, badge, consult join gate |
| `05d7e44` | Separate patient/doctor consultation views (consult is CUSTOMER-only) |
| `39f99c4` | Hide index view by default + CSS guard for hidden views |
| `be564b1` | Remove duplicated booking block that rendered above header |
| `02961fc` | Add `@netlify/plugin-nextjs` so the deploy serves the app instead of 404 |

## Backend (branch `main`, fast-forwarded from `feat/demo-realtime`)

| Commit | Change |
|--------|--------|
| `bdf2a97` | Queue DTOs/services, complete-and-advance, derived status, typing STOMP destination, chat read-only rule, 1000-char limit, q + consultationType search, WS ticket endpoint, dual JWT decoders, DemoDataSeeder |
| `5e3dc15` | Fix date-filtered session search (Postgres typed params), seed today's sessions late-day, queue broadcasts after payment & auto-start |

## Files modified this session

**Frontend:**
- `public/mediclinic-system.html` — added `hidden` to index view, CSS guard, consult nav role restriction
- `public/mediclinic-app.js` — availability badge, notification polling, consult join gate
- `public/mediclinic-api.js` — notification methods
- `netlify.toml` — added Next.js plugin
- `package.json` / `package-lock.json` — added `@netlify/plugin-nextjs`

**Backend:**
- `src/main/java/com/medichannel/repository/DoctorSessionRepository.java` — CAST to string
- `src/main/java/com/medichannel/service/DoctorSessionService.java` — LocalDate→String
- `src/main/java/com/medichannel/service/AppointmentService.java` — broadcast auto-start status
- `src/main/java/com/medichannel/service/PaymentService.java` — broadcast queue after payment
- `src/main/java/com/medichannel/config/DemoDataSeeder.java` — fallback slots for today
- `docs/DEPLOYMENT_GUIDE.md` + `render-staging.yaml` — staging blueprint docs

## Documentation created
- `docs/ASSIGNMENT_2_AUDIT_REPORT.md`
- `docs/REQUIREMENTS_TRACEABILITY_MATRIX.md`
- `docs/TEST_EXECUTION_REPORT.md`
- `docs/SECURITY_AUDIT_REPORT.md`
- `docs/DATABASE_PERSISTENCE_REPORT.md`
- `docs/DEPLOYMENT_CHECKLIST.md`
- `docs/CHANGELOG_ASSIGNMENT_2.md`
- `docs/OPENCODE_PROGRESS.md`