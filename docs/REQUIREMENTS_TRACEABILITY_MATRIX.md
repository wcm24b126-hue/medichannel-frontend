# MediChannel — Requirements Traceability Matrix (IT404050 Assignment 2)

Brief source: `~/Documents/IT404050_Assignment_2_-_MediChannel_Brief.docx`. Original numbering preserved.

| Req ID | Description | Frontend | Backend | Database | Security/Auth | Test | Result |
|--------|-------------|----------|---------|----------|---------------|------|--------|
| BR-01 | Session: doctor, date, times, type, max patients 1–60, minutes 5–30, fee LKR, status; physical needs room, online doesn't | `public/mediclinic-system.html` session cards + create form | `DoctorSessionService`, `DoctorSessionController` | `doctor_sessions` table + CHECK constraints | MANAGER/ADMIN only create/edit | `DoctorSession*Tests`, smoke | PARTIAL (admin create session UI wired) |
| BR-02 | Doctor/room overlapping sessions forbidden | n/a | `DoctorSessionService` overlap check | DB trigger `no_overlap` | MANAGER | integration tests | PASS |
| BR-03 | Appointment numbers start at 1, unique, never reused, never exceed max, even concurrent | booking success card | `AppointmentService.book` + `BEFORE INSERT` trigger locking session row | `appointments.appointment_number` trigger | CUSTOMER | `AppointmentApiPostgresIntegrationTests`, concurrency suite | PASS (local) |
| BR-04 | One active appointment per patient per session | booking form | `AppointmentService` + partial unique index | partial unique index | CUSTOMER | integration tests | PASS |
| BR-05 | Booking closes 1h before physical, 30m before online | session card disables Book | `AppointmentService` cutoff check | n/a | CUSTOMER | unit tests | PASS |
| BR-06 | Estimated time = start + (n-1)*minutes + delay | success card | `AppointmentService` estimate | n/a | n/a | unit tests | PASS |
| BR-07 | Cancel unpaid until 3h before; cancelled kept | appointments page | `AppointmentService.cancel` | status preserved | CUSTOMER owns | controller tests | PASS |
| BR-08 | Status flow BOOKED→ARRIVED→IN_CONSULTATION→COMPLETED; NO_SHOW; online skips ARRIVED | appointments UI | `AppointmentService` transitions | status enum CHECK | role-gated | lifecycle tests | PASS |
| BR-09 | Consultation room opens only when doctor starts; only patient+doctor; read-only when ended | `public/mediclinic-app.js` consult view | `ChatService` + `ChatWebSocketController` | `chat_messages` | WS dest auth | WS interceptor + lifecycle tests | PASS (local) |
| BR-10 | NIC 9+V/X or 12 digits; phone 07XXXXXXXX; email+NIC unique; password 8+ letter/number/symbol | register form | `PatientRegistrationService`, `PatientProfileService` | unique constraints + HMAC lookup | public register | validation tests | PARTIAL — backend password complexity check (letter/number/symbol) not enforced server-side |
| BR-11 | History never deleted; Asia/Colombo times; NUMERIC money | all history views | services | triggers + NUMERIC(10,2) | role-gated | integration tests | PASS |
| RT-01 | Live "now serving" number updates instantly | queue card | `SessionQueueService.broadcast` | n/a | WS /topic | browser E2E | PARTIAL — broadcasts exist; frontend subscribes |
| RT-02 | Numbers left update live after booking/cancel | session cards | `SessionQueueService.broadcast` on book/cancel/pay | n/a | WS /topic | browser E2E | PARTIAL |
| RT-03 | Private chat with typing + connection status, messages saved encrypted | consult view | `ChatService` + STOMP | `chat_messages` (plaintext today) | WS auth | WS tests + E2E | PARTIAL — messages are plaintext (brief wants encrypted) |
| RT-04 | Notifications: 3-away, called, delayed, cancelled, consultation started | toast + badge | `NotificationService` | `notifications` | user queue | smoke + E2E | PARTIAL — not all events wired |
| Auth | BCrypt, JWT 15m, HTTP-only cookie, lockout 5/15m, session restore | login/register forms, `mediclinic-api.js` | `SecurityConfig`, `JwtService`, `AccountLockout` | users | HttpOnly Secure cookie | `AuthControllerTest`, security tests | PASS |
| RBAC | 4 roles, server-side enforcement, IDOR protection | `data-roles` nav (UI only) | `SecurityConfig`, `AppointmentAccessPolicy` | role FK | all endpoints | `SecurityAuthorizationPostgresIntegrationTests` | PASS |
| Admin | create doctor/manager, list/search, activate/deactivate, reset password | admin view | `AdminPortalController` | users/doctors | ADMIN only | `AdminPortalPostgresIntegrationTests` | PASS (backend); UI mostly wired |
| Manager | sessions, rooms, doctors, reception, payments, notices, feedback, reports | manager view | `DoctorSessionController`, `AppointmentController`, `PaymentController`, `NoticeController` | sessions/rooms/etc. | MANAGER | integration tests | PARTIAL — reports mostly static |
| Consultation summary | doctor writes; patient reads; encrypted; access rules | consult view summary section | `ConsultationSummaryService` | `consultation_summaries` | ownership + role | `ConsultationLifecyclePostgresIntegrationTests` | PASS (ADMIN/MANAGER blocked via `isStaff` removal) |
| Audit log | logins, account changes, session cancels, consultation opens | admin view | `AuditLogService` | `audit_logs` (V9) | ADMIN read | controller tests | PARTIAL — coverage limited |
| Notices | publish/approve/hide/delete | manager view | `NoticeController` | `notices` (V8) | role-gated | integration tests | PARTIAL |
| Feedback | 1–5 rating, one per completed, moderation | feedback form | `FeedbackService` | `reviews` | role-gated | integration tests | PASS |
| Payments | simulated, PENDING/PAID, CASH/CARD, no duplicates | pay button | `PaymentService` | `payments` | CUSTOMER owns | integration tests | PASS |
| Caching | TTL cache for public lists | none | none | n/a | n/a | n/a | NOT IMPLEMENTED |
| Encryption at rest | AES-256-GCM + HMAC lookup | n/a | `AttributeConverter`s | encrypted columns | env keys | `PatientDataProtectionServiceTests` | PASS |
| WS auth | JWT/ticket on CONNECT; sender from Principal | STOMP client | `WebSocketAuthorizationInterceptor` | n/a | ticket scope | `WebSocketSecurityInterceptorTests` | PASS |
| Concurrency | booking race safety | n/a | trigger locking | DB trigger | n/a | integration tests | PASS |
| Persistence | records survive restart | n/a | JPA | FKs/indexes | n/a | restart tests | PASS (local) |
| Deployment | Netlify + Render + Neon | netlify.toml | render.yaml | Flyway | env vars | smoke | PARTIAL — Netlify was 404 (fixed via plugin) |
| Testing/docs | 30+ test cases, ERD, report, slides | smoke + e2e | 56 tests | n/a | n/a | this report | PARTIAL — docs in progress |