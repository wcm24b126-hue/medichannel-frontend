# MediChannel – Hospital Channelling and Appointment Management

## Project Overview

MediChannel is a Hospital Channelling and Appointment Management System developed as a group project for IT404050 – Full Stack Development.

The repository contains a Next.js frontend and a Spring Boot backend. The backend provides REST APIs, authentication, business logic, database operations, and real-time communication.

## Technology Stack

- Java
- Spring Boot
- Spring Security
- Spring Data JPA
- Spring WebSocket
- PostgreSQL
- Maven

## Deployment Architecture

- Backend hosting: Render
- Database hosting: Neon PostgreSQL
- Frontend hosting: Netlify

The Next.js frontend is in [`medichannel-frontend/`](./medichannel-frontend/), and the Spring Boot service is in [`medichannel/`](./medichannel/). The repository-root [`netlify.toml`](./netlify.toml) configures Netlify to build the frontend. [`render.yaml`](./render.yaml) and [`medichannel/Dockerfile`](./medichannel/Dockerfile) configure the backend service for Render.

## User Roles

- CUSTOMER
- DOCTOR
- MANAGER
- ADMIN

## Main Modules

- Authentication and authorization
- User and role management
- Patient management
- Doctor and specialisation management
- Room and session management
- Appointment booking
- Queue management
- Online consultation chat
- Notifications
- Feedback and notices
- Audit logs

## Database

The system uses PostgreSQL hosted on Neon.

Database schema changes will be managed through Flyway migration files.

Never commit database passwords, connection strings, encryption keys, JWT secrets, or other credentials.

## Deployment

Deploy in this order: Neon database, Render backend, then Netlify frontend.

1. **Neon:** Create a PostgreSQL project and database. Copy its connection details. Use the pooled hostname if the Neon dashboard offers one, and require SSL.
2. **Render:** Connect this repository and create a Blueprint from the root `render.yaml`. The service builds the Dockerfile in `medichannel/`. In the Render service's environment, set:
   - `DB_URL` to a JDBC URL such as `jdbc:postgresql://YOUR_NEON_HOST/YOUR_DATABASE?sslmode=require`
   - `DB_USERNAME` and `DB_PASSWORD` to the Neon role credentials
   Render sets `SPRING_PROFILES_ACTIVE=production`. Wait for the service build and deployment to finish, then copy its `https://...onrender.com` origin.
3. **Netlify:** Import the repository root and use the root `netlify.toml`. Set the server-side `API_URL` to the Render backend origin only, without a trailing slash, `/api`, or `/api/v1` (for example, `https://your-service.onrender.com`). Do not expose it through a `NEXT_PUBLIC_*` variable. Then deploy or trigger a new deploy.
4. **Verify:** Check the Render service status and deployment logs. Then open the Netlify site and verify its backend-backed API requests.

Keep all provider credentials in Render/Netlify environment settings; never commit them or place them in `NEXT_PUBLIC_*` variables. For local backend development, set `SPRING_PROFILES_ACTIVE=production`, `DB_URL`, `DB_USERNAME`, and `DB_PASSWORD` in the process environment to connect to Neon. Do not commit local `.env` files.

### Render cold starts and frontend caching

The frontend probes the same-origin `/api/backend/wake` route when the app loads, when a hidden tab becomes visible again, after a back-forward-cache restore, and when connectivity returns. The route checks Render's health endpoint so a sleeping service can start; it does not keep Render awake, and a cold start may take time. Authenticated appointment history and queue data are fetched from the backend and are not cached. The app HTML and its browser script may be stored but must be revalidated before reuse.

A scheduled GitHub Actions workflow (`.github/workflows/keep-backend-awake.yml`) pings the Render health endpoint every 10 minutes so the free instance is less likely to reach its ~15-minute idle sleep. GitHub may delay scheduled runs, so treat this as a best-effort keep-alive rather than a guarantee.

### Frontend behavior and security

- The welcome screen is public. Signed-in patients also see a live queue card built from their real appointment for today (`You are number N`), a Dashboard button, and Log out; Log in/Register are hidden until logout.
- Every MediChannel logo and app-name link — dashboard headers, login, registration, and footer — returns to the welcome screen.
- Doctor, manager, and admin workspaces show only the selected sidebar panel. Panel links update the URL without scrolling the page or jumping to the bottom. Panel deep links (for example `#doctor-q`) are supported.
- A boot screen covers the app until session restore finishes, so the dashboard never flashes before hydration.
- Tailwind CSS 3.4.17 is self-hosted under `public/vendor/`, so the Content Security Policy can use `script-src 'self'` without trusting a third-party CDN.
- Auth cookies are HttpOnly, SameSite=Lax, Secure in production, and use the `__Host-` prefix in production. JavaScript cannot read the token.
- Appointment APIs and auth responses are `no-store`; HTML and the app script revalidate; the versioned vendor file is immutable.
- The static HTML is served with a strict CSP, `X-Frame-Options: DENY`, COOP/CORP, and `frame-ancestors 'none'`.

### Testing

```bash
npm run lint
npx tsc --noEmit
npm run build

# In one terminal (use the port printed by Next.js):
npm start
# In another terminal:
SMOKE_BASE_URL=http://localhost:8080 npm run test:smoke
```

The smoke suite checks routing, self-hosted assets, CSP/security headers, cache policy, anonymous
session rejection, CSRF rejection, and the wake endpoint. The browser test matrix and the
frontend UX score are in [`docs/FRONTEND_EVALUATION.md`](./docs/FRONTEND_EVALUATION.md).
The dedicated security assessment is in
[`docs/WEB_SECURITY_REVIEW.md`](./docs/WEB_SECURITY_REVIEW.md), and the review against the
official IT404050 Assignment 2 brief is in
[`docs/ASSIGNMENT_2_REVIEW.md`](./docs/ASSIGNMENT_2_REVIEW.md).

**Backend implementation status:** The Spring Boot backend currently provides versioned REST APIs for authentication, patients, doctors, sessions, appointments, and additional modules. Confirm that the backend deployment has applied the matching Flyway migrations before testing frontend flows. Features without a corresponding backend endpoint must not be simulated by the frontend.

## Environment Variables

The frontend server reads `API_URL`, which must be the Render backend origin without `/api` or `/api/v1`. The production backend reads `PORT`, `SPRING_PROFILES_ACTIVE`, `DB_URL`, `DB_USERNAME`, and `DB_PASSWORD`. `PORT` is supplied by Render. The production profile requires a JDBC-formatted `DB_URL`; Neon connection details should use SSL (`sslmode=require`).

## Team Development

1. Clone the repository.
2. Create a feature branch for your assigned task.
3. Make your changes.
4. Commit and push your work if you have repository write access.
5. Submit a pull request for review.

## Project Repository

https://github.com/wcm24b126-hue/medichannel-backend
