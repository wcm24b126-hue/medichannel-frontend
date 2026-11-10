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
3. **Netlify:** Import the same repository. The root `netlify.toml` selects `medichannel-frontend/` and its build command. Set `API_URL` to the Render origin (no trailing slash or `/api`) with the **Functions** scope, then deploy or trigger a new deploy.
4. **Verify:** Check the Render service status and deployment logs. Then open the Netlify site and verify its backend-backed API requests.

Keep all provider credentials in Render/Netlify environment settings; never commit them or place them in `NEXT_PUBLIC_*` variables. For local backend development, set `SPRING_PROFILES_ACTIVE=production`, `DB_URL`, `DB_USERNAME`, and `DB_PASSWORD` in the process environment to connect to Neon. Do not commit local `.env` files.

**Backend implementation status:** The current Spring Boot project is only a starter: it has no API controllers or Flyway migration scripts yet. Deployment can start the service and connect it to Neon, but frontend login, registration, and data flows will not work until those endpoints and schema migrations are implemented.

## Environment Variables

The production backend reads `PORT`, `SPRING_PROFILES_ACTIVE`, `DB_URL`, `DB_USERNAME`, and `DB_PASSWORD`. `PORT` is supplied by Render. The production profile requires a JDBC-formatted `DB_URL`; Neon connection details should use SSL (`sslmode=require`).

## Team Development

1. Clone the repository.
2. Create a feature branch for your assigned task.
3. Make your changes.
4. Commit and push your work if you have repository write access.
5. Submit a pull request for review.

## Project Repository

https://github.com/wcm24b126-hue/medichannel-backend
