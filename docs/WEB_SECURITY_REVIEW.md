# MediChannel Web Security Review

**Reviewed:** 12 November 2026
**Scope:** Next.js frontend/BFF in this repository, Spring Boot API source in
`~/projects/medichannel-backend`, and the live API at
`https://medichannel-backend.onrender.com`.
**Method:** manual source review, HTTP header and cookie checks, CORS/CSRF
probes, dependency audit, and review of the backend test suite. No destructive
testing, no database dump, and no authenticated production account were used.

## Overall score

# 82 / 100 — B

This is a strong security posture for a student project. Authentication,
authorization, CSRF, transport headers, password storage and clinical-text
encryption are implemented deliberately and backed by tests. The score is held
back by three requirements from the brief that are still not met (encrypted
email, encrypted chat messages, audit logging) and by the absence of
rate limiting and token revocation.

| Area | Weight | Score | Summary |
| --- | ---: | ---: | --- |
| Transport and security headers | 10 | 9 | HTTPS/HSTS, strict CSP, frame denial, COOP/CORP, nosniff. |
| Authentication and session management | 20 | 17 | BCrypt 12, 15-minute JWT, lockout, `__Host-` cookie. No refresh/revocation. |
| Authorization and ownership | 20 | 18 | Server-side role rules plus IDOR/ownership checks, including WebSocket destinations. |
| Encryption and data protection | 20 | 14 | AES-256-GCM for PII/clinical text, HMAC NIC lookup. Email and chat are plaintext. |
| Input validation, XSS and CSRF | 15 | 13 | Bean Validation, JPA, safe DOM writes, CSP, origin checks. `unsafe-inline` styles. |
| Errors, logging and secrets | 10 | 8 | Generic errors with reference IDs, no secrets committed, no stack traces. No audit log. |
| Dependencies and infrastructure | 5 | 3 | `npm audit` clean, explicit CORS, DB constraints. No app-level rate limiting. |
| **Total** | **100** | **82** | **B** |

## What is done well

### Authentication and session handling

- Passwords use BCrypt with strength 12
  (`SecurityConfig.passwordEncoder()`), never returned or logged.
- Login lockout after 5 failures for 15 minutes
  (`LoginAttemptService`), with a dummy hash to reduce user-enumeration timing
  differences.
- JWTs are HS256, issuer-validated, and expire after 15 minutes
  (`JwtService`). The role is re-read from the database on WebSocket CONNECT so
  a stale token cannot retain a revoked role.
- The browser never sees the access token. The Next.js BFF stores it in an
  `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, `Priority=high`
  `__Host-medichannel_token` cookie in production
  (`src/lib/auth-cookie.ts`). JavaScript cannot read it.
- Logout clears both the hardened and legacy cookie names. Production ignores
  a legacy non-`__Host-` cookie.

### Authorization and privacy

- `SecurityConfig` applies explicit role rules for every route group and falls
  back to `anyRequest().authenticated()`.
- `AppointmentAccessPolicy` centralizes patient-owner and assigned-doctor
  checks; admin and manager roles cannot read consultation chat.
- WebSocket `CONNECT` requires a valid JWT and active/verified account.
  `WebSocketAuthorizationInterceptor` denies every destination by default and
  only permits the two chat destinations plus the user's own private queues.
- Admin self-suspension and last-admin lockout are blocked.
- Backend tests cover IDOR, role escalation, chat participant isolation,
  notification ownership, and admin self-lockout.

### Encryption and database controls

- AES-256-GCM with a random 12-byte IV and 128-bit tag is used for patient
  names, phone, date of birth, gender, appointment reason, and consultation
  summary fields (`PatientDataProtectionService`, `V6`).
- NIC uniqueness uses an HMAC-SHA256 lookup hash rather than a reversible
  value.
- PostgreSQL migrations add foreign keys, CHECK constraints, partial unique
  indexes, overlap-prevention triggers, atomic appointment-number allocation,
  and history-protection triggers.
- Encryption keys, HMAC keys, JWT secret, and database credentials come from
  environment variables. `.env*` is git-ignored and no secrets were found in
  the tracked files.

### Web hardening

- Next.js serves a strict CSP: `script-src 'self'` with hashes for the app's
  inline bootstrap script, `object-src 'none'`, `frame-src 'none'`,
  `frame-ancestors 'none'`, `base-uri 'self'`, and `form-action 'self'`.
- `X-Frame-Options: DENY`, COOP `same-origin`, CORP `same-origin`, `nosniff`,
  a restrictive `Permissions-Policy`, and HSTS with `includeSubDomains;
  preload` in production.
- Mutating BFF requests are checked against same-origin/forwarded-host values;
  cross-origin login attempts return 403.
- `sockjs-client`/STOMP is same-origin; the backend rejects wildcard CORS at
  startup and sends no `Access-Control-Allow-Origin` to unlisted origins.
- The static client writes API values with `textContent`; the one `innerHTML`
  path HTML-escapes the user name.
- Dependency audit: `npm audit --omit=dev` reports **0 vulnerabilities**.

## Findings

| # | Severity | Finding | Evidence | Impact |
| --- | --- | --- | --- | --- |
| 1 | High | Chat messages are stored in plaintext. | `V7__create_chat_messages.sql` column `content TEXT`; `ChatMessage.content`; `ChatService` encrypts nothing. | A database leak exposes clinical conversation. The brief explicitly requires encrypted chat messages. |
| 2 | High | User email is stored in plaintext. | `V1__create_identity_tables.sql` `users.email`; login queries it directly. | The brief requires email encrypted with an HMAC lookup column. A database leak exposes every patient's identity and enables credential-stuffing. |
| 3 | Medium | No audit log exists. | No `audit_logs` table or audit service; `REMAINING_WORK.md` lists it as outstanding. | Cannot trace logins, account changes, cancellations, or consultation-record access, which the brief requires. |
| 4 | Medium | No application-level rate limiting. | Only per-account lockout exists; `/api/auth/login`, `/api/auth/register`, and `/api/backend/wake` are unthrottled. | Allows distributed password guessing, registration flooding, and health-probe amplification. |
| 5 | Medium | Access tokens cannot be revoked. | 15-minute JWT with no refresh/deny-list; logout only clears the cookie. | A stolen token stays valid until expiry; logout does not invalidate it server-side. |
| 6 | Medium | Patient address is neither collected nor encrypted. | `patients` table has no address column; `PatientProfileRequest` has no address. | Registration is incomplete against the brief and the encryption evidence is partial. |
| 7 | Medium | Completed consultations remain writable. | `ChatService.sendMessage` rejects only `CANCELLED`. | Violates BR-09 ("read-only when it ends"); clinical chat can change after completion. |
| 8 | Low | Chat limit is 2000 characters, not 1000. | `ChatService.MAX_MESSAGE_LENGTH = 2000`; DB CHECK allows 1–2000. | Wider abuse window than the brief specifies. |
| 9 | Low | CSP allows inline styles and does not report violations. | `style-src 'self' 'unsafe-inline'`; no `report-to`/`report-uri`. | Inline-style injection is possible after an HTML injection; violations are invisible. |
| 10 | Low | Google Fonts is a third-party dependency. | CSP allows `fonts.googleapis.com`/`fonts.gstatic.com`. | Leaks user IPs to Google and weakens the "self-hosted assets" privacy story. |
| 11 | Low | No dependency/SAST/secret scanning in CI. | Only the Render keep-alive workflow exists. | Regressions are caught late. |
| 12 | Info | The screenshot's live frontend currently returns 404. | `https://frontend-html-app-medichannel.netlify.app/mediclinic-system.html` → 404 on 12 Nov 2026; only Netlify's HSTS header is returned. | The production CSP/headers could not be verified and the live demo is currently broken. Fix before submission. |

## Verification performed

```text
GET /mediclinic-system.html (production build)
  ✓ CSP: default-src 'self'; script-src 'self' + hash; frame-ancestors 'none'
  ✓ X-Frame-Options: DENY
  ✓ COOP/CORP: same-origin
  ✓ HSTS: max-age=31536000; includeSubDomains; preload
  ✓ Cache-Control: public, max-age=0, must-revalidate

POST /api/auth/login
  ✓ Set-Cookie: __Host-medichannel_token=...; Secure; HttpOnly; SameSite=lax
  ✓ Set-Cookie clears the legacy cookie
  ✓ Cache-Control: private, no-store, max-age=0

POST /api/auth/login with Origin: https://evil.example
  ✓ 403

POST /api/auth/login behind X-Forwarded-Proto: https with an http Origin
  ✓ 403 (no protocol downgrade)

GET /api/v1/doctors with Origin: https://evil.example (live API)
  ✓ no Access-Control-Allow-Origin
  ✓ OPTIONS preflight → 403

npm audit --omit=dev
  ✓ 0 vulnerabilities

Backend test suite (reported in docs/TEST_REPORT.md)
  ✓ 53 tests, 0 failures (IDOR, role escalation, encryption, chat privacy,
    notification ownership, lockout, CORS/WebSocket handshake)
```

## Remediation plan

### Before the deadline (high value)

1. Encrypt `users.email` with AES-256-GCM and add an HMAC-SHA256
   `email_lookup_hash` for login/uniqueness. Keep the hash unique.
2. Encrypt `chat_messages.content` with the same protection service (or a
   dedicated key) and migrate existing rows.
3. Add `notices` and `audit_logs` tables, an audit service, and admin/audit
   endpoints. Log logins, account changes, cancellations, and consultation
   record opens without medical content.
4. Make chat read-only once the appointment is `COMPLETED` or the session is
   `COMPLETED`/`CANCELLED`.
5. Add basic rate limiting at the Next.js edge or a Spring filter for login,
   registration, payment, and chat.

### Before public launch

6. Add refresh-token rotation or a server-side revocation list; invalidate on
   logout and password reset.
7. Collect and encrypt patient address, or document the omission as a
   deliberate scope decision.
8. Add CSP reporting (`report-to`) and consider removing `unsafe-inline` from
   `style-src`.
9. Self-host the Google Fonts files or remove the third-party font origin.
10. Add CI checks: `npm audit`, dependency review, secret scanning, ESLint,
    TypeScript, backend tests, and the smoke suite.

## Limitations

This review did not include a penetration test, database inspection, live
authenticated testing, load testing, or review of Render/Neon account settings.
The backend source was available locally but is not part of this repository;
the live API was probed without credentials. A production security sign-off
should repeat these checks against the final deployed URLs.
