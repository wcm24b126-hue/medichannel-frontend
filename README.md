# MediChannel – Backend

## Project Overview

MediChannel is a Hospital Channelling and Appointment Management System developed as a group project for IT404050 – Full Stack Development.

The backend provides REST APIs, authentication, business logic, database operations, and real-time communication.

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

The frontend probes the same-origin `/api/backend/wake` route when the app loads and when a hidden tab becomes visible again. The route checks Render's health endpoint so a sleeping service can start; it does not keep Render awake, and a cold start may take time. Authenticated appointment history and queue data are fetched from the backend and are not cached. The app HTML and its browser script may be stored but must be revalidated before reuse.

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
