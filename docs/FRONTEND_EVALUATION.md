# MediChannel Frontend Evaluation

**Scope:** static frontend (`public/mediclinic-system.html` + `public/mediclinic-app.js`) and the Next.js same-origin BFF in `src/app/api/`.

**Reviewed:** 12 November 2026 · branch `frontend-html-app`

## Assumptions

The assignment brief was not available in the repository. This review uses the module list in
[`README.md`](../README.md) as the business-requirements baseline:

authentication and authorization, user/role management, patient management, doctor and
specialisation management, room and session management, appointment booking, queue management,
online consultation chat, notifications, feedback and notices, and audit logs.

The deployed backend currently exposes authentication, patient-profile, doctor, session, and
appointment endpoints. Several staff-facing screens are still front-end prototypes, so the score
separates **UI coverage** from **end-to-end backend integration**.

## Score

| Area | Weight | Score | Evidence |
| --- | ---: | ---: | --- |
| Authentication, roles, and route protection | 15 | 13 | Real login/session/logout BFF, role badges, ACL routing, HttpOnly cookie, protected panels. No password reset or MFA. |
| Patient journeys: welcome, appointments, queue | 20 | 17 | Real `/appointments/me` data, live welcome queue (“You are number N”), appointment table, session-expiry handling. Booking screen still uses static session cards. |
| Doctor, manager, and admin workspaces | 20 | 11 | All three role workspaces exist with complete responsive panels, but most tables/actions are static demo data rather than API-backed. |
| Consultation, notices, feedback, audit | 15 | 7 | Screens and interaction states exist; chat is not connected to STOMP/WebSocket and notices/feedback/audit are not persisted. |
| UX, responsive layout, accessibility | 15 | 13 | Strong visual design, mobile layouts, explicit labels, focus styles, validation messages, Sinhala/English toggle. A few prototype controls are disabled/demo-only. |
| Security and privacy | 10 | 9 | Strict CSP, frame denial, COOP/CORP, HSTS in production, `__Host-` cookie in production, CSRF origin checks, no secrets or false crypto claims. No full CSP reporting pipeline. |
| Reliability, performance, testing | 5 | 3 | Self-hosted assets, safe cache policy, boot splash, wake/retry logic, keep-alive workflow, 31-check smoke suite and browser tests. No automated unit/E2E suite in the repo. |
| **Total** | **100** | **73** | **B / 73%** |

**Mark: 73/100 (B).** The UI and security work are stronger than this mark suggests; the limiting
factor is that several assignment modules are still clickable prototypes rather than
backend-backed features. If the grader weights visual/UX quality and security most heavily, the
same deliverable scores in the high 80s. If the grader requires every module to be end-to-end, it
scores closer to 65–70.

## Business-requirement checklist

| Requirement | Status | Notes |
| --- | --- | --- |
| Authentication and authorization | ✅ Wired | `/api/auth/login`, `/api/auth/me`, `/api/auth/logout`; backend token never exposed to JavaScript. |
| Four roles (customer, doctor, manager, admin) | ✅ Wired | Role-based navigation, route ACL, and role-aware dashboard links. |
| Patient registration and profile | ✅ Partial | Account + patient profile creation is proxied; address is explicitly reported as unsupported by the current backend. |
| Appointment history | ✅ Wired | `/api/backend/appointments/me` rendered into the appointments table with empty/error states. |
| Queue management | ✅ Partial | Queue number comes from the patient’s real appointment for today. No live push updates yet. |
| Appointment booking | 🟡 UI only | Session cards, filters, and booking dialogs are present but not connected to booking endpoints. |
| Doctor/specialisation management | 🟡 UI only | Search cards and specialisation filters are static. |
| Room and session management | 🟡 UI only | Doctor/manager session screens are static. |
| Online consultation chat | 🟡 UI only | Chat layout exists; `@stomp/stompjs` is installed but not wired. |
| Notifications | 🟡 Partial | Wake status, session warning, and queue states work; no notification feed API. |
| Feedback and notices | 🟡 UI only | Manager panel exists without persistence. |
| Audit logs | 🟡 UI only | Admin table exists without persistence. |
| Deployment and keep-alive | ✅ Wired | Netlify build, Render health probe, GitHub Actions keep-alive workflow, cold-start messaging. |

Legend: ✅ wired or substantially functional · 🟡 prototype/partial.

## Security review

| Check | Result | Evidence |
| --- | --- | --- |
| Security headers | ✅ | `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY`, COOP, CORP, Permissions-Policy, HSTS in production. |
| Content Security Policy | ✅ | `default-src 'self'`, `script-src 'self'` + build-computed inline hashes, `object-src 'none'`, `frame-ancestors 'none'`. Tailwind is self-hosted, so the CDN was removed from the policy. |
| Clickjacking / iframe embedding | ✅ | Header and CSP both deny framing; verified in Firefox that a same-origin iframe stays `about:blank` and never fires `load`. |
| XSS | ✅ | User-controlled strings are escaped before `innerHTML`; queue/appointment values use `textContent`. No `eval` or `new Function` in app or vendor code. |
| CSRF | ✅ | SameSite=Lax cookie plus Origin/`Sec-Fetch-Site` validation on every mutation route. Cross-origin login returns 403. |
| Session-cookie copying | ✅ | HttpOnly, Secure and `__Host-` prefixed in production, path `/`, no Domain attribute, high priority. JavaScript sees an empty `document.cookie`. |
| Transport and encryption claims | ✅ | HSTS in production; vague/unverifiable bcrypt/AES claims were replaced with accurate language. |
| Sensitive data in frontend | ✅ | No backend URL, JWT, database credential, or secret is shipped to the browser. `API_URL` remains server-only. |
| Caching | ✅ | APIs and auth responses are `no-store`; HTML/app script revalidate; versioned vendor asset is immutable. |
| Server-side fetch timeouts | ✅ | 15–20 second limits on auth and proxy calls to avoid hung requests. |
| Backend availability | ✅ | Wake probe with retry/backoff, visibility/bfcache/online triggers, and a 10-minute GitHub Actions health ping. |

## Verification performed

- `npm run lint` — clean.
- `npx tsc --noEmit` — clean.
- `npm run build` — successful production build (26 routes).
- `npm run test:smoke` — **31/31 checks passed** (routing, assets, CSP, headers, cache policy,
  anonymous session handling, CSRF rejection, wake endpoint).
- Firefox UI tests with a mock backend:
  - guest welcome shows Log in/Register, hides Dashboard/Logout/queue;
  - customer login restores the welcome screen, shows Dashboard + Logout, hides guest CTAs,
    displays “You are number 14” from the appointment payload, and hides the token from JS;
  - logout restores the guest state;
  - doctor and manager workspaces open only the active panel, deep links work, and sidebar clicks
    preserve scroll position instead of jumping to the page bottom;
  - a delayed session check shows the boot screen with no dashboard flash;
  - mobile at 390 px has no horizontal overflow;
  - iframe embedding is blocked.

## Highest-value next steps

1. Connect booking, doctor search, session management, notices, feedback, audit, and chat to their
   backend endpoints (or clearly label them as demo-only in the UI).
2. Add an automated Playwright/WebDriver suite for the login → queue → logout and panel-navigation
   flows that were exercised manually here.
3. Add a notification/queue push channel (WebSocket/SSE) so the queue updates without a refresh.
4. Add CSP violation reporting and a periodic dependency/vendor audit.
5. Add password reset and optional MFA to complete the authentication requirement.
