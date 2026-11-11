# MediChannel — IT404050 Assignment 2 Review

**Brief:** `~/Documents/IT404050_Assignment_2_-_MediChannel_Brief.docx`
(issue 5 Nov 2026, deadline 5 Dec 2026)
**Reviewed:** 12 November 2026
**Scope:** frontend repository (`frontend-html-app`), backend source in
`~/projects/medichannel-backend`, live API at
`https://medichannel-backend.onrender.com`, and the live frontend URL shown in
the screenshots.

## Overall mark

# 64 / 100 — Satisfactory (top of band)

| Level | Range | This submission |
| --- | --- | --- |
| Excellent | 85–100 | Everything works live, best practices, explained. |
| Good | 65–84 | Works with small gaps or minor best-practice issues. |
| Satisfactory | 45–64 | Basic version works but important parts or rules are missing, or checks are only in the frontend. ← **64** |
| Poor | 0–44 | Missing, broken, insecure, or unexplained. |

The backend is substantially stronger than the frontend. Authentication,
authorization, encryption of most personal/clinical fields, booking rules and
notifications are implemented with a real test suite. The mark stays in the
Satisfactory band because several **required features are not demonstrated end
to end**: the live queue/availability WebSocket features, notices, audit logs,
and most doctor/manager/admin frontend actions. The live frontend URL also
returned 404 during this review, and the required group report, ERD, seed data
and 60+ per-member commits are not present.

> This is **not** the same rubric as
> [`FRONTEND_EVALUATION.md`](./FRONTEND_EVALUATION.md). That document scores the
> frontend alone (73/100) on UX, security and frontend craftsmanship. This
> document scores the whole system against the official Assignment 2 marking
> scheme, where 56 of the 100 marks are for the database, Spring Boot API,
> authorization, encryption, booking rules and real-time features.

## Marking scheme

| Criterion | Max | Mark | Evidence | Main gaps |
| --- | ---: | ---: | --- | --- |
| **A. Database design** — schema, constraints, relationships, indexes, seed data | 10 | **7** | 9 Flyway migrations (`V1`–`V9`): roles, users, specialisations, patients, doctors, rooms, doctor_sessions, appointments, payments, consultation_summaries, chat_messages, notifications, reviews. Extensive FKs, CHECKs, partial unique indexes, overlap and appointment-number triggers. | `notices` and `audit_logs` tables are missing. Only the four roles are seeded; there is no realistic seed data for every role/status. No ERD or `schema.sql` in the reviewed repos. |
| **B. Spring Boot API** — layers, DTOs, validation, REST/status codes, errors | 12 | **10** | Controller → service → repository → entity with request/response records; 70 mapped endpoints; Bean Validation; centralized `GlobalExceptionHandler` with consistent JSON and reference IDs; health check; explicit CORS; 53 passing backend tests. | Pagination exists only for chat history; admin/notification/review lists are unpaginated. No OpenAPI spec. Manager paths are less tested than admin. |
| **C. Authentication, four roles, permissions, ownership** | 10 | **9** | BCrypt 12; 15-minute HS256 JWT with issuer validation; 5-failure/15-minute lockout; role rules in `SecurityConfig`; ownership in `AppointmentAccessPolicy`; WebSocket JWT and destination checks; IDOR/role-escalation tests. | No refresh/revocation; no email verification (auto-activation); admin cannot create MANAGER accounts or reset staff passwords; first admin comes from environment variables (correct, but bootstrap only). |
| **D. Encryption and security with evidence** | 12 | **8** | AES-256-GCM with random IV for names, phone, DOB, gender, reason, and consultation summary; HMAC-SHA256 NIC lookup; bcrypt; secrets from env; tests assert ciphertext does not contain plaintext. Strong HTTP security headers and `__Host-` cookie. | Email is plaintext; chat messages are plaintext; patient address is not stored; no audit log; no database ciphertext screenshot/evidence pack in the repo. |
| **E. Booking rules BR-01 to BR-11** | 10 | **8** | Session fields and status constraints; doctor/room overlap trigger; atomic appointment-number trigger with `max_appointments` guard; one-active-appointment partial unique index; 60/30-minute booking close; estimate formula with delay; 3-hour unpaid cancellation; lifecycle/status rules; NIC format; NUMERIC money; history-protection trigger. | BR-09 read-only chat is not enforced after completion. BR-10 password complexity is frontend-only; backend enforces length 12–72 but not letter/number/symbol, and phone format is not server-validated. Registration does not collect the full profile including address. |
| **F. Real-time features RT-01 to RT-04** | 12 | **5** | STOMP/WebSocket chat with server-derived sender, persistence, participant-only topics, private user notification queues, reconnect-friendly client libraries, JWT on CONNECT, denied-by-default destinations. | **RT-01 live "now serving" and RT-02 live availability are not implemented as broadcasts.** No typing indicator. Notification coverage is partial (no 3-numbers-away, called, or delay notifications). |
| **G. Next.js frontend** — pages for every role, components, forms, states, usability | 10 | **5** | Polished, responsive UI for public, patient, doctor, manager and admin areas; explicit labels, validation messages, loading/empty/error states, Sinhala/English toggle, accessible focus states. Session restore and appointment history use real APIs. | The main app is a single static HTML file in `public/`, not App Router pages and reusable React components. Only login/session/appointments/queue are API-backed; booking, doctor, manager and admin panels are static demos. Client-side ACL is not a security control. |
| **H. Feedback, notices, dashboards and reports** | 5 | **3** | Reviews with 1–5 rating and one-per-completed-appointment rule; public doctor rating aggregates; admin stats, appointment and payment oversight endpoints; polished dashboard/report screens. | No notices feature at all. Manager dashboard/reports are static. Feedback management (approve/hide/delete) and notice publishing are not implemented. Reports are not demonstrated with real SQL/JPA output. |
| **I. Caching, performance and deployment** | 6 | **3** | Self-hosted Tailwind, versioned assets, `no-store` for APIs, revalidation for HTML/app script, immutable vendor cache, Render wake retries, 10-minute keep-alive workflow, Netlify/Render configuration. | No TTL cache or invalidation for doctor/specialisation lists, which the brief explicitly requires. Live frontend URL returned **404** on 12 Nov 2026. Public doctor/session/specialisation lists are empty, so performance cannot be demonstrated with realistic data. |
| **J. Testing and documentation** | 8 | **5** | 53 backend tests (0 failures) with a test report; 31-check frontend smoke suite; README, API reference, deployment guide, implementation summary, completion report and this review. | No 4,000–6,000-word group report, ERD, 30-case submission test table, per-role user manual, or contribution section. Git history is far below "at least 60 meaningful commits" per member: 17 commits on the frontend branch, 9 on the backend `main`, and only three frontend authors. |
| **K. Final presentation, live demo and answers** | 5 | **1** | A local demo can be run and the UI is presentable. | No slides or backup recording in the repos. The live frontend is currently unavailable, so the required live demo cannot be performed as-is. Presentation has not happened yet; this mark is provisional. |
| **Total** | **100** | **64** | | |

## What is genuinely strong

1. **Booking integrity is database-enforced.** Appointment numbers are allocated
   by a `BEFORE INSERT` trigger that locks the session row, so two simultaneous
   bookings cannot receive the same number or exceed capacity. This is better
   than most student implementations, which do a `SELECT MAX + 1` in Java.
2. **Authorization is server-side and tested.** Role rules, ownership rules,
   chat participant isolation, admin self-lockout and WebSocket destinations are
   all covered by tests.
3. **Most sensitive fields are encrypted properly.** AES-GCM with a fresh random
   IV per value and an HMAC lookup hash for NIC is the right pattern.
4. **The API is well structured.** DTO boundaries, constructor injection,
   transactions, consistent error JSON, request IDs and no stack traces.
5. **The UI is unusually polished.** It looks like a real hospital product,
   handles mobile widths, has clear validation and good empty/loading states.

## What is holding the mark down

| Priority | Gap | Marks affected | Fix |
| --- | --- | --- | --- |
| 1 | Live frontend returns 404 | I, K | Restore the Netlify deploy and re-test the exact submitted URL. |
| 2 | Booking, doctor, manager and admin screens are static demos | G, E, H | Wire the existing API endpoints into the UI; remove or label demo-only controls. |
| 3 | RT-01 live queue and RT-02 live availability missing | F | Broadcast session state after booking/cancel/call; subscribe from patient/doctor/manager screens. |
| 4 | No notices or audit log | A, D, H | Add tables, services, endpoints and UI; record consultation-record opens and admin actions. |
| 5 | Email and chat plaintext; address missing | D | Encrypt email with HMAC lookup; encrypt chat content; add address or document the omission. |
| 6 | No TTL cache for public lists | I | Add a cache with invalidation on doctor/specialisation changes. |
| 7 | No realistic seed data | A, H, I | Seed every role, session type and appointment status with fictional data. |
| 8 | No group report, ERD, test table, user manual | J | Produce the required PDF and diagrams; add a 30+ case test table. |
| 9 | Commit count and member coverage | J | Ensure every member has meaningful commits; the brief asks for 60+ and commits from every member. |
| 10 | BR-09 read-only chat; password/phone validation | E | Reject chat after completion; enforce complexity and phone format server-side. |

## Fastest route to 75–85

1. Restore the live frontend and demonstrate the public → booking → queue →
   consultation flow in two browsers.
2. Replace the static booking panel and doctor console with real API calls.
3. Implement the two missing WebSocket broadcasts (now serving, availability)
   and the three missing notification triggers.
4. Add notices and audit logs.
5. Encrypt email and chat messages; add address support.
6. Add seed data and the TTL cache.
7. Write the report/ERD/test table and record a backup demo.

If items 1–4 are completed and demonstrated live, the same codebase can move
into the **75–82** range without changing the architecture.

## Assumptions and limitations

- The backend source was reviewed from a local checkout but is not part of this
  repository. If the group submits it as a separate repository, criteria A–F
  should be re-checked against the exact submitted commit.
- The live API was reachable and returned a healthy response, but public lists
  were empty and no authenticated account was used. Therefore no booking,
  payment, chat or notification flow was exercised against production.
- The live frontend URL from the screenshot returned 404 on 12 Nov 2026. The
  mark for deployment and live demo reflects that state; it can be raised once
  the site is restored.
- Presentation, slides, peer assessment and individual contribution marks were
  not available and are marked provisionally.
- This mark evaluates the system against the assignment brief, not the quality
  of the visual design alone.
