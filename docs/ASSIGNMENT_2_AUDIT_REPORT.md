# MediChannel — IT404050 Assignment 2 Audit Report

**Reviewed:** 12 November 2026
**Brief:** `~/Documents/IT404050_Assignment_2_-_MediChannel_Brief.docx` (issue 5 Nov 2026, deadline 5 Dec 2026)
**Frontend repo:** `medichannel-frontend` branch `frontend-html-app` (latest push `02961fc`)
**Backend repo:** `medichannel-backend` branch `main` (latest push `5e3dc15`)
**Live frontend:** `https://frontend-html-app--medichannel.netlify.app/` (behind Netlify Team SSO; production `https://medichannel.netlify.app`)
**Live backend:** `https://medichannel-backend.onrender.com` (health UP)
**Database:** Neon PostgreSQL `production` branch (project `twilight-poetry-29539364`); local disposable `medichannel_demo` / `medichannel_test` on PG 18.6

## 1. Project overview

MediChannel is a full-stack hospital channelling and appointment management system. Patients register, search doctors/sessions, book physical or online appointments, follow a live queue, consult by real-time chat, read consultation summaries, and leave feedback. Doctors manage sessions and patients, run consultations, write summaries. Managers run reception, sessions, rooms, notices, feedback. Admins provision staff accounts and view audit logs.

## 2. Architecture

- Frontend: Next.js 16 App Router (`src/app` + a static HTML SPA served from `public/mediclinic-system.html` driven by `public/mediclinic-app.js` and `public/mediclinic-api.js`), Tailwind 3.4 via CDN, STOMP client (`public/vendor/stomp.umd.min.js`).
- Backend: Spring Boot 4.1.2 (Java 21), Spring Security, Spring Data JPA, Bean Validation, Flyway, STOMP-over-WebSocket (SockJS), AES-GCM encryption, HMAC lookup, JWT, BCrypt 12, PostgreSQL.
- Database: PostgreSQL 18.6 (local + Neon). 9 Flyway migrations `V1`–`V9`.
- Deployment: Netlify (frontend), Render Docker (backend), Neon (PostgreSQL).

## 3. Assignment compliance

See `REQUIREMENTS_TRACEABILITY_MATRIX.md`. Coverage summary:

- Roles: CUSTOMER / DOCTOR / MANAGER / ADMIN — implemented with server-side enforcement.
- Registration: email, password, NIC, DOB, gender, phone, address, full name; unique email/NIC; BCrypt; CUSTOMER-only public registration.
- Booking: full lifecycle with DB-enforced appointment numbers and capacity.
- Real-time: STOMP chat + typing + notifications + queue broadcasts (live queue/availability broadcasts are partial — see §8).
- Summaries: encrypted at rest, ownership enforced.
- Admin/Manager dashboards: substantially API-backed after recent work.
- Audit log: persistent `audit_logs` table exists; coverage is partial.
- Notices: implemented (table + endpoints + UI) on the feature branch.
- Caching: HTTP cache headers only; no TTL cache for public lists (gap per brief §7).

## 4. Initial defects (from `ASSIGNMENT_2_REVIEW.md` baseline 64/100)

| # | Defect | Status |
|---|--------|--------|
| 1 | Live Netlify frontend returned 404 | **Fixed** — added `@netlify/plugin-nextjs`, pushed `02961fc` |
| 2 | Duplicate booking block rendered above header on welcome | **Fixed** — removed orphaned copy, pushed `be564b1` |
| 3 | Welcome view index not hidden by default | **Fixed** — added `hidden`, pushed `39f99c4` |
| 4 | Patient/doctor consultation views combined | **Fixed** — consult now CUSTOMER-only, pushed `05d7e44` |
| 5 | Doctor action buttons not wired | **Fixed** — `data-doctor-action` + `runDoctorAction()`, pushed earlier |
| 6 | Doctor availability not shown / bookable when unavailable | **Fixed** — availability badge + disabled Book, pushed `852583e` |
| 7 | No notification polling | **Fixed** — 15s poll + toast, pushed `852583e` |
| 8 | Backend 500 on `?date=` session search (Postgres typed-param) | **Fixed** — CAST to string, pushed `5e3dc15` to `main` |
| 9 | Sessions not seeded for today (late-day seeder) | **Fixed** — fallback slots, pushed `5e3dc15` |
| 10 | `ConsultationSummaryService.get()` `isStaff` allows ADMIN/MANAGER | **Investigated** — see SecurityAudit; code currently gates; regression tests exist |
| 11 | `SecurityConfig` POST /doctors allowed MANAGER | **Fixed** — ADMIN-only, regression test added |
| 12 | No manager creation endpoint | **Implemented** on backend feature branch |
| 13 | No audit log table | **Implemented** (V9 migration) |
| 14 | No notices | **Implemented** (V8 migration) |
| 15 | No TTL cache for public lists | **Open** — flagged as gap; not implemented |
| 16 | No OpenAPI spec | **Open** |
| 17 | Email/chat plaintext, address missing | **Open** — documented |
| 18 | No refresh/revocation tokens | **Open** |
| 19 | Admin/manager dashboards static in places | **Partial** |

## 5. Fixed defects (this session)

See `CHANGELOG_ASSIGNMENT_2.md`.

## 6. Security audit

See `SECURITY_AUDIT_REPORT.md`.

## 7. Database audit

See `DATABASE_PERSISTENCE_REPORT.md`.

## 8. Frontend audit

- Single-page static HTML served from `public/`; Tailwind via CDN; role navigation via `data-roles`.
- BFF at `/api/backend/*` attaches HttpOnly session cookie; WS uses short-lived ticket via `/api/realtime/config`.
- XSS hardening: `createElement`/`textContent` only; CSP hash-locked; `X-Frame-Options`, `COOP`, etc.
- **Gap:** not App Router pages/components; only login/session/appointments/queue/booking/chat API-backed; admin/manager mostly static.
- **Gap:** no TTL cache for public lists.

## 9. Backend audit

- 70 endpoints, controller→service→repository→entity, DTOs, Bean Validation, global error handler, CORS, health.
- 56 passing tests (H2 + Postgres integration).
- AES-GCM encryption + HMAC NIC lookup; BCrypt 12; JWT 15 min; account lockout 5/15 min.
- **Gap:** pagination only on chat; no OpenAPI; no refresh tokens.

## 10. Remaining limitations

1. Live frontend was 404 (fixed in repo; Netlify redeploy pending user action).
2. Neon DB has no demo data (seeder never ran; needs `APP_DEMO_SEED=true`).
3. `backend-ops-hardening` / `frontend-html-app` branches were merged into `main`/`frontend-html-app`; other feature branches (`backend-ashan`, `backend-fahim`, `backend-hasfak`, `backend-kapilan`, `backend-vinojan`, `integration/fahim-resources`) not fully audited for additional work.
4. No group report, ERD, 30-case test table, per-role user manual, or contribution section in repo.
5. Git history below 60 commits per member.

## 11. Final acceptance assessment

Local implementation: **PASS** for booking/search/chat/queue/summary/security tests.
Hosted demo: **BLOCKED** until Netlify redeploy + Neon seeding are performed by the user (see `DEPLOYMENT_CHECKLIST.md`).

Estimated compliance with Assignment 2: ~75–80% of functional/security requirements implemented locally; documentation deliverables (report, ERD, slides) are the largest gap.