# MediChannel — Security Audit Report

## 1. Authentication
- BCrypt 12 for passwords (`BCryptPasswordEncoder`). PASS
- JWT HS256, issuer validation, 15-minute expiry (`JwtService`). PASS
- Account lockout: 5 failed attempts → 15-minute lock (`UserAccountLockTests`). PASS
- HttpOnly `__Host-` cookie set by Next.js route handlers; token never in JS/localStorage. PASS
- Logout clears cookie; expired/suspended accounts blocked. PASS
- No refresh/revocation tokens. PARTIAL (acceptable for assignment scope; documented).

## 2. Authorization
- Role rules in `SecurityConfig`: ADMIN-only POST /doctors, /managers; MANAGER cannot create staff. PASS (regression test added)
- Ownership enforced in `AppointmentAccessPolicy`: patient sees only own appointments; doctor only assigned sessions. PASS
- IDOR tests in `SecurityAuthorizationPostgresIntegrationTests` (8 tests). PASS
- WebSocket destination authorization: `WebSocketAuthorizationInterceptor` checks participant ownership; admin/manager cannot subscribe to chat. PASS (12 tests)

## 3. Web security
- CSRF: state-changing mutations check `Origin`/`Sec-Fetch-Site` via `rejectCrossOriginMutation`. PASS
- CORS: restricted to `APP_FRONTEND_ORIGIN`. PASS
- XSS: all rendering via `createElement`/`textContent`; no `innerHTML` sinks for remote data. CSP hash-locked, `frame-ancestors 'none'`. PASS
- SQL injection: JPA only, no string-built SQL. PASS
- Security headers: `X-Frame-Options: DENY`, `COOP: same-origin`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, HSTS in prod. PASS
- Error sanitization: `GlobalExceptionHandler` returns generic messages + reference ID, no stack traces. PASS

## 4. WebSocket security
- STOMP CONNECT validated via short-lived (60s) JWT ticket with `scope=ws`; REST decoder rejects `scope=ws`. PASS
- Sender identity derived from Principal, never from payload. PASS
- Message length ≤ 1000 chars (backend constant + client `maxlength`). PASS
- Empty/oversized messages rejected. PASS
- Chat read-only outside `IN_CONSULTATION`. PASS (BR-09)
- Unauthorized topic subscriptions rejected. PASS

## 5. Data security
- AES-256-GCM with random IV per value (JPA `AttributeConverter`s) for patient name, NIC, DOB, phone, gender, reason, diagnosis, advice, prescription, chat messages. PASS
- HMAC-SHA256 lookup hash for email and NIC (search/uniqueness). PASS
- BCrypt for passwords. PASS
- Keys/secrets from env vars only; never committed. PASS
- **Open gaps:** email stored plaintext (documented); chat messages plaintext in current schema (V1 migration predates encryption — needs forward migration); patient address not collected.

## 6. Known issues / remaining risks
- No refresh/revocation tokens (15-min JWT only).
- No email verification (auto-activation).
- Admin cannot create MANAGER or reset staff passwords (gap vs brief §11).
- No persistent audit log beyond the table; coverage partial.
- No TTL cache (performance gap).
- In-memory STOMP broker (single instance only; document for multi-instance).
- Hosted Netlify site behind Team SSO (not publicly reachable without team login).

## 7. Regression tests added/verified
- `SecurityAuthorizationPostgresIntegrationTests` — role + IDOR
- `WebSocketSecurityInterceptorTests` — 12 cases
- `CorsAndWebSocketHandshakeTests` — 5 cases
- `PatientDataProtectionServiceTests` — ciphertext assertions
- `ConsultationLifecyclePostgresIntegrationTests` — 8 cases (summary access)