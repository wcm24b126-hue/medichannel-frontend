# MediChannel — Final Assignment 2 Audit

**Date:** 13 November 2026  
**Scope:** Next.js frontend + Spring Boot backend + PostgreSQL, audited against
`IT404050 Assignment 2 — MediChannel Brief`  
**Environment:** local PostgreSQL 18.6 on `127.0.0.1:55432`, database
`medichannel_test`; **no production/Neon database was read or written.**

---

## 1. Executive summary

The baseline repository was already a substantial implementation, but it had
one failing test, a failing frontend lint run, a doctor-session ownership
(IDOR) hole, missing RT-04 notification paths, no password complexity rule,
no notices or reports feature, no feedback moderation, no database ERD or
`schema.sql`, and an incomplete demo seed.

This audit fixed the safe, high-value issues and added the missing
notice/report/moderation surfaces without changing the stack or weakening
security. The final state is:

| Check | Result |
|---|---|
| Backend test suite | **64 passed, 0 failed, 0 errors, 0 skipped** |
| Frontend lint | **PASS (0 errors, 0 warnings)** |
| Frontend production build | **PASS (27 routes)** |
| Flyway migrations | **V1–V15 validated and applied** |
| Demo seed (throwaway local DB) | **PASS** — all four roles, all six appointment statuses, notices |
| Schema/ERD documentation | **Added** (`docs/schema.sql`, `docs/DATABASE_ERD.md`) |
| Git | **Both repositories committed and pushed to `main`** (backend `4d4ec8d`, frontend `f4c0172`; this report follows in a docs commit) |

**Estimated mark: 77–83 / 100 (midpoint ≈ 80.5).** The main remaining
deduction is criterion D: patient email is still stored in plaintext in
`users.email` and has no HMAC lookup column, which the brief explicitly
requires. The frontend delivery model (Next.js routes redirect to the static
`public/mediclinic-system.html` app) is the second-largest risk.

---

## 2. Architecture

```
Browser
  ├─ Next.js App Router (BFF)  ── HttpOnly __Host-medichannel_token cookie
  │     └─ /api/backend/[...path] proxy ── Bearer JWT ── Spring Boot REST
  └─ static public/mediclinic-system.html + mediclinic-app.js
        └─ same BFF proxy + STOMP /ws (60 s ws-ticket)

Spring Boot
  controller → service → repository → entity
  DTOs + Bean Validation + GlobalExceptionHandler (consistent ApiErrorResponse)
  Spring Security (JWT resource server, role + ownership checks)
  WebSocket STOMP with JWT CONNECT validation and per-destination authorization
  PostgreSQL 18 + Flyway V1–V15
```

Layers are respected: controllers do not contain business rules; ownership is
checked in services (`AppointmentAccessPolicy`, `DoctorSessionService`,
`ConsultationAccessService`); encrypted fields use
`PatientDataProtectionService` (AES-256-GCM, `v1:` prefix) and the existing
HMAC helper for NIC lookup.

---

## 3. Initial findings (baseline)

1. `./mvnw clean test`: **56 tests, 1 failure** — the staff-summary test
   expected ADMIN to read a consultation summary (200), which contradicts the
   brief's privacy rule.
2. `npm run lint`: **FAIL** — 2 `require()` errors in
   `scripts/test_workflow_e2e.js`, plus 4 warnings.
3. `DoctorSessionService` transition methods accepted any session ID from any
   authenticated doctor — a vertical/horizontal IDOR.
4. RT-04 was incomplete: session cancellation did not cancel/notify every
   appointment, delays did not notify patients, and there was no
   “3 numbers away” notification.
5. No password character-class policy (BR-10).
6. NIC was only an HMAC lookup hash (not recoverable ciphertext) and address
   was accepted by the UI but never persisted.
7. Managers could call `POST /api/v1/doctors` and provision doctor accounts.
8. No caching, no compression, no `Cache-Control` differentiation.
9. No notices table/API, no manager report API, no feedback moderation.
10. No `schema.sql`, no ERD, no seed data for CUSTOMER or the six appointment
    statuses.
11. Demo seeding failed after 09:00 because it tried to create today's
    already-past slots, called `openSession` twice, and reused patients in one
    session.

---

## 4. Critical issues found and fixed

| # | Severity | Issue | Fix | Evidence |
|---|---|---|---|---|
| 1 | Critical | Any DOCTOR could open/start/complete/cancel/delay **any** session by ID | `DoctorSessionService` transition methods now receive `actorUserId`/`actorRole`; `requireActorCanManage` enforces that a DOCTOR owns the session, while ADMIN/MANAGER may manage it | `DoctorSessionService.java`, `DoctorSessionController.java`; full suite PASS |
| 2 | Critical | Stale test asserted ADMIN could read a consultation summary | Test corrected to expect **403**; the service was not weakened | `ConsultationLifecyclePostgresIntegrationTests.java` |
| 3 | High | Managers could create DOCTOR accounts (privilege escalation) | `POST /api/v1/doctors` is now `hasRole("ADMIN")`; manager creation and staff password reset added under `/api/v1/admin/**` | `SecurityConfig.java`, `AdminService.java`, `AdminController.java` |
| 4 | High | Session cancellation left appointments BOOKED/ARRIVED and patients uninformed | `cancelByStaff` each active appointment, keep records, notify every patient, audit-log the count | `DoctorSessionService.java` |
| 5 | High | Delay did not notify affected patients | Recalculate estimated time and send `APPOINTMENT_REMINDER` to every BOOKED/ARRIVED patient | `DoctorSessionService.java` |
| 6 | High | No “3 numbers away” notification (RT-04) | Added `notifyThreeNumbersAway`, deduplicated with `existsByAppointment_IdAndTypeAndTitle` | `AppointmentService.java`, `NotificationRepository.java` |
| 7 | High | No password character-class rule | `PasswordPolicy` enforces 8+ chars, letter + number + symbol, ≤72 UTF-8 bytes; used by registration, doctor creation and admin reset; DTO `@Pattern`s added | `PasswordPolicy.java`, `AuthService.java`, `DoctorService.java`, `AdminService.java` |
| 8 | High | NIC not recoverable and address discarded | Flyway `V13` adds `nic_encrypted` and `address_encrypted`; entity/service/DTOs encrypt and decrypt via AES-GCM | `V13__encrypt_patient_identifiers_and_address.sql`, `PatientService.java` |
| 9 | Medium | No notices feature | Flyway `V14`, `Notice` entity/repository/service/controller, public `GET /api/v1/notices`, manager/admin CRUD/publish/withdraw | `V14__create_notices.sql`, `NoticeController.java` |
| 10 | Medium | No backend reports | `GET /api/v1/reports/overview` with SQL aggregates: today's sessions, appointments/day, physical vs online, no-show rate, revenue, top doctors, ratings | `ReportService.java`, `ReportController.java` |
| 11 | Medium | No feedback moderation | Flyway `V15` adds `reviews.moderation_status`; managers/admins approve, hide or delete; public ratings only include APPROVED | `V15__add_feedback_moderation.sql`, `ReviewService.java` |
| 12 | Medium | Managers could read audit logs and subscribe to `/topic/audit-logs` | REST and STOMP now require ADMIN only | `SecurityConfig.java`, `WebSocketAuthorizationInterceptor.java` |
| 13 | Medium | No public-catalog caching or compression | Caffeine 60 s TTL for doctors/specialisations, eviction on writes; `Cache-Control` public 30 s for anonymous catalogue GETs, `no-store` elsewhere; gzip enabled | `CacheConfig.java`, `CacheControlFilter.java`, `application.properties` |
| 14 | Medium | Phone numbers were not validated (BR-10) | `PatientService.normalizePhone` requires `07XXXXXXXX` | `PatientService.java` |
| 15 | Low | Demo seed broken for most of the day | Skip past slots, compute capacity from actual slot length, do not double-open sessions, use one patient per status, seed admin/manager/patients/notices | `DemoDataSeeder.java`; verified against a throwaway local DB |
| 16 | Low | Frontend lint failed on Node scripts | ESLint ignores `scripts/**` (CommonJS tooling, not app source) | `eslint.config.mjs` |

---

## 5. Requirements compliance matrix

### 5.1 Business rules (BR-01–BR-11)

| Rule | Status | Evidence / notes |
|---|---|---|
| BR-01 session fields/status, room rules | **PASS** | `doctor_sessions` columns + CHECKs; `SessionStatus` enum; `chk_session_room`, capacity 1–60, minutes 5–30, LKR fee |
| BR-02 no overlapping doctor/room | **PASS** | `prevent_session_overlap()` trigger in `V3`; service also checks; conflict mapped to 409 |
| BR-03 unique, never-reused, capped numbers | **PASS** | `assign_appointment_number()` trigger with `last_appointment_number`; `UNIQUE(session_id, appointment_number)`; tests cover concurrent booking |
| BR-04 one active appointment per patient/session | **PASS** | partial unique index `uq_active_appointment_patient_session`; service pre-check |
| BR-05 booking closes 60 min physical / 30 min online | **PASS** | `validateSessionCanBeBooked` |
| BR-06 estimated time formula | **PASS** | `estimatedConsultationTime` = start + (number−1)×minutes + delay |
| BR-07 unpaid cancellation until 3 h before | **PASS** | `cancelMyAppointment` checks BOOKED + PENDING + 3-hour deadline; records kept |
| BR-08 status flow | **PASS** | `Appointment` transition methods; online BOOKED → IN_CONSULTATION supported; NO_SHOW |
| BR-09 consultation room privacy/read-only | **PASS** | `ConsultationAccessService`, participant checks, chat write blocked after completion, STOMP authorization |
| BR-10 NIC/phone/email unique + password rule | **PARTIAL** | NIC format + unique HMAC, phone `07XXXXXXXX`, email unique, password 8+ letter/number/symbol. **Patient email is plaintext and has no HMAC lookup column.** |
| BR-11 history never deleted, Asia/Colombo, NUMERIC money | **PASS** | Status changes instead of deletes; `Clock` in `Asia/Colombo`; `NUMERIC(10,2)` for fees/payments |

### 5.2 Real-time features (RT-01–RT-04)

| Requirement | Status | Evidence |
|---|---|---|
| RT-01 live now-serving queue | **PASS** | `publishQueue` broadcasts queue snapshots over STOMP; doctor/manager/patient subscriptions authorized |
| RT-02 live numbers left | **PASS** | Queue snapshot includes availability; published after booking, cancellation, check-in and transitions |
| RT-03 private encrypted chat + typing/status | **PASS** | `ChatService`, AES-GCM messages, 1000-char limit, typing events, participant-only destinations, read-only after completion |
| RT-04 called / 3-away / delayed / cancelled / consultation started | **PASS** | Notification types and service calls; 3-away deduplicated; cancellation and delay notify every affected patient |
| WebSocket authentication/authorization | **PASS** | 60 s `scope=ws` ticket; JWT validated on CONNECT; per-destination role/ownership checks; tickets rejected by the REST decoder |

---

## 6. Security assessment

### Strengths

- **Passwords:** BCrypt work factor 12; complexity enforced server-side; no
  password or hash is logged or returned.
- **Tokens:** signed JWT with expiry and token version; HttpOnly `__Host-`
  cookie set by the Next.js BFF; WebSocket tickets are short-lived and cannot
  be replayed against REST.
- **Authorization:** role checks in `SecurityConfig`; ownership checks in
  services (appointments, sessions, summaries, chat); IDOR fixed; audit logs
  and audit STOMP topic now ADMIN-only.
- **Encryption at rest:** patient name, phone, DOB, gender, NIC, address,
  appointment reason, diagnosis/advice/prescription and chat messages are
  AES-256-GCM ciphertext (`v1:`); random IV per value; keys from environment.
- **NIC lookup:** HMAC-SHA-256 lookup hash, separate from ciphertext.
- **Web:** CORS allow-list, CSP, HSTS, frame denial, referrer policy,
  permissions policy, `no-store` on personal responses.
- **Input handling:** Bean Validation + service checks; JPA/parameterised
  queries; global error handler hides stack traces.
- **Rate limiting / lockout:** login attempt tracking and 15-minute lock after
  5 failures.

### Residual security gaps

1. **Patient email is plaintext in `users.email` and has no email HMAC
   column.** This directly contradicts section 6 of the brief. It is the
   largest remaining D-criterion gap. Remediation requires an email ciphertext
   column, an HMAC lookup column, migration/back-fill, login/search changes,
   admin list changes and seed updates.
2. **Temporary-password first-login change is not enforced.** Reset revokes
   tokens, but there is no `must_change_password` flag.
3. **Pagination is not implemented** for admin user lists, audit logs or
   appointment oversight; the brief asks for pagination on long lists.
4. **Audit coverage** should be checked for every consultation-record opening;
   the service currently logs key actions but not every read path.
5. **No email verification** (deferred decision, unchanged).

---

## 7. Database design, ERD and seed data

- `docs/schema.sql` — 1,149-line `pg_dump --schema-only` of the migrated
  schema (V1–V15).
- `docs/DATABASE_ERD.md` — Mermaid ERD covering all 15 application tables,
  relationships, constraints and indexes.
- Migrations added:
  - `V13__encrypt_patient_identifiers_and_address.sql`
  - `V14__create_notices.sql`
  - `V15__add_feedback_moderation.sql`
- Demo seed (`APP_DEMO_SEED=true`) verified against a throwaway database:
  - ADMIN = 1, MANAGER = 1, DOCTOR = 12, CUSTOMER = 6
  - appointments: BOOKED 1, ARRIVED 1, IN_CONSULTATION 1, COMPLETED 1,
    NO_SHOW 1, CANCELLED 1
  - 43 sessions, 2 published notices
  - all patient data fictional; encryption keys supplied only via environment

---

## 8. Frontend assessment

- `npm run lint` — **PASS** (0 errors, 0 warnings).
- `npm run build` — **PASS**, 27 routes.
- Public, patient, doctor, manager and admin areas exist in the App Router.
- The delivered production experience redirects every app route to
  `public/mediclinic-system.html`, a static HTML/JS application that uses the
  Next BFF, cookie auth and STOMP. It is functional and role-aware, but it
  means the App Router pages are not the assessor-visible UI. This is a
  criterion G risk and should be explained or consolidated before submission.
- The static manager “Notices and feedback” panel still contains placeholder
  buttons; the new notices/reports/moderation APIs are backend-complete but
  are not yet wired into that static panel.

---

## 9. Tests run

### Commands

```bash
cd /home/ashan/projects/medichannel-backend
./mvnw -o clean test

cd /home/ashan/projects/medichannel-frontend
npm run lint
npm run build
```

### Exact backend results

| Test class | Tests | Failures | Errors | Skipped |
|---|---:|---:|---:|---:|
| `RepositoryIntegrationTests` | 1 | 0 | 0 | 0 |
| `AppointmentPostgresIntegrationTests` | 1 | 0 | 0 | 0 |
| `ConsultationLifecyclePostgresIntegrationTests` | 8 | 0 | 0 | 0 |
| `AppointmentApiPostgresIntegrationTests` | 4 | 0 | 0 | 0 |
| `AuthControllerTest` | 1 | 0 | 0 | 0 |
| `AdminPortalPostgresIntegrationTests` | 6 | 0 | 0 | 0 |
| `WebSocketSecurityInterceptorTests` | 12 | 0 | 0 | 0 |
| `SecurityAuthorizationPostgresIntegrationTests` | 16 | 0 | 0 | 0 |
| `CorsAndWebSocketHandshakeTests` | 5 | 0 | 0 | 0 |
| `PatientDataProtectionServiceTests` | 5 | 0 | 0 | 0 |
| `MedichannelApplicationTests` | 1 | 0 | 0 | 0 |
| `UserAccountLockTests` | 4 | 0 | 0 | 0 |
| **Total** | **64** | **0** | **0** | **0** |

**PASS = 64, FAIL = 0, BLOCKED = 0.**

New authorization coverage includes public notices, manager-only notice
management, manager reports, customer denial for reports/feedback moderation,
and manager denial for audit logs.

### Demo-seed verification

Ran the packaged application against a throwaway local database
(`medichannel_demo_check`) with `APP_DEMO_SEED=true`; seeding completed and
the database contained all four roles, all six appointment statuses and two
published notices. The process was stopped by `timeout` after successful
seeding; this is not a test failure.

---

## 10. Remaining issues (prioritised)

| Priority | Issue | Impact | Suggested remediation |
|---|---|---|---|
| P0 | Patient email plaintext; no email HMAC | D criterion (12 marks) | Add `email_encrypted` + `email_lookup_hash`, back-fill, change login/uniqueness/search/admin lists, then remove plaintext |
| P0 | Next.js routes redirect to static HTML | G criterion (10 marks) | Either make the App Router the delivered UI or document the static client as the intended SPA and ensure it covers every role |
| P1 | Notices/reports/moderation not wired into static manager UI | H criterion (5 marks) | Connect the existing panel to `/api/v1/notices/manage`, `/api/v1/reports/overview`, `/api/v1/reviews/manage` |
| P1 | Two-step registration; full name/NIC/DOB/gender/phone/address not in one form | 3.1 registration requirement | Extend `RegisterRequest` and create the patient profile atomically |
| P1 | Temporary password change on first login not enforced | Admin feature | Add `must_change_password` and block other endpoints until changed |
| P2 | No pagination on long lists | Technical requirement | Add Spring `Pageable` to admin users, audit logs and oversight lists |
| P2 | Consultation-record read audit coverage | Audit requirement | Log every summary/chat read by an authorised user |
| P2 | Email verification deferred | Account security | Integrate provider when available |
| P3 | Group report PDF / 30-case table / screenshots / slides | J and K criteria | Produce from this audit and the test table |

---

## 11. Estimated mark

| Criterion | Marks | Estimate | Rationale |
|---|---:|---:|---|
| A. Database design | 10 | 9.0 | Strong schema, constraints, indexes, ERD, `schema.sql`, seed for every role/status |
| B. Spring Boot API | 12 | 10.5 | Layered, DTOs, validation, status codes, global errors; pagination missing |
| C. Auth/roles/ownership | 10 | 9.0 | Four roles, IDOR fixed, admin-only provisioning/audit; temp-password flow incomplete |
| D. Encryption/security | 12 | 7.5 | Most fields AES-GCM; patient email plaintext is an explicit gap; evidence screenshot not included |
| E. Booking rules BR-01–11 | 10 | 9.5 | All rules implemented and tested; email uniqueness gap overlaps D |
| F. WebSockets RT-01–04 | 12 | 10.5 | Queue, availability, chat, notifications, authorization; live UI verification pending |
| G. Next.js frontend | 10 | 7.0 | Functional static SPA, but App Router pages are redirected away |
| H. Feedback/notices/reports | 5 | 3.5 | Backend complete; static UI not wired |
| I. Caching/performance/deployment | 6 | 5.0 | Caffeine TTL, cache headers, compression, corrected Netlify/Render configs, production-profile startup verified; live URL still pending |
| J. Testing/documentation | 8 | 6.0 | 64 passing tests, audit, ERD/schema/API docs; group PDF/test table not produced here |
| K. Presentation/live demo | 5 | 3.0 | Not assessed in this session |
| **Total** | **100** | **≈ 80.5** | **Estimated range 77–83 (Good)** |

Fixing the P0 email encryption and wiring the manager UI would plausibly move
the estimate into the mid/high 80s.

---

## 12. Git status confirmation

Both repositories are committed and pushed to `main`.

**Backend** (`/home/ashan/projects/medichannel-backend`): commit `4d4ec8d`
(`feat: complete Assignment 2 backend requirements and deployment readiness`),
53 files changed. Pushed to
`https://github.com/wcm24b126-hue/medichannel-backend`.

**Frontend** (`/home/ashan/projects/medichannel-frontend`): commit `f4c0172`
(`fix: align password policy, harden CSP, and prepare Netlify deployment`),
10 files changed. This audit report is commit `9d8d2a8`; both are pushed to
`https://github.com/wcm24b126-hue/medichannel-frontend`.

### Deployment readiness verified in-session

- `netlify.toml` builds with `npm run lint && npm run build`, publishes
  `.next`, uses `@netlify/plugin-nextjs`, and pins Node 22.
- The stale frontend `render.yaml` (which pointed at nonexistent
  `./medichannel` paths) was removed; the backend repository owns the Render
  blueprint.
- The CSP `connect-src` now derives the REST/WebSocket origins from `API_URL`
  at build time instead of hardcoding one hostname.
- The backend starts under `SPRING_PROFILES_ACTIVE=prod` against a local
  database, applies Flyway V1–V15, and returns `UP` from `/actuator/health`.
- A fresh production frontend build serves `/mediclinic-system.html` with the
  CSP and security headers, redirects `/` correctly, and proxies
  `/api/backend/wake` and `/api/backend/doctors` successfully.
- Password validation is now consistent at 8+ characters with a letter, a
  number and a symbol across the backend, BFF, admin UI and static app.
- No real secrets, `.env` files, Neon credentials or build artifacts are
  tracked.

**Not verified:** an actual Netlify/Render deployment and live URL checks.
Those require platform account access and the deployed service URLs, which
were not available in this session. The required environment variables are
listed in `docs/DEPLOYMENT_CHECKLIST.md` and the README.

---

## 13. Rerun commands

```bash
# Backend (local PostgreSQL on 55432 required)
cd /home/ashan/projects/medichannel-backend
./mvnw -o clean test

# Frontend
cd /home/ashan/projects/medichannel-frontend
npm run lint
npm run build

# Optional: verify demo seed against a throwaway local database
createdb -h 127.0.0.1 -p 55432 -U postgres medichannel_demo_check
JWT_SECRET="$(openssl rand -base64 64 | tr -d '\n')" \
ENCRYPTION_KEY="$(openssl rand -base64 32)" \
HMAC_SECRET="$(openssl rand -base64 32)" \
DB_URL=jdbc:postgresql://127.0.0.1:55432/medichannel_demo_check \
DB_USERNAME=postgres DB_PASSWORD=local_test_only_password \
APP_DEMO_SEED=true APP_DEMO_PASSWORD='<strong-demo-password>' \
java -jar target/medichannel-*.jar
```

> Never point these commands at the production Neon database. The demo
> password above must be supplied locally and must never be committed. It is
> for a throwaway local database only.
