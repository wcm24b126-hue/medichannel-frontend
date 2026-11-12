# MediChannel — Database & Persistence Report

## 1. Schema
PostgreSQL 18.6. 9 Flyway migrations `V1`–`V9`:
`V1` roles, users, specialisations, patients, doctors, rooms, doctor_sessions, appointments, payments
`V2` consultation_summaries
`V3` chat_messages
`V4` notifications
`V5` reviews
`V6` notices
`V7` audit_logs
`V8`–`V9` further indexes/constraints (per migration files)

Flyway validated: `Successfully validated 9 migrations` (local test run).

## 2. Constraints verified
- PKs on all tables; FKs with appropriate ON DELETE.
- UNIQUE on email, NIC lookup hash, registration number, booking reference.
- CHECK: max_appointments 1–60, minutes_per_patient 5–30, status enums, payment status/method.
- Partial unique index: one active appointment per patient per session.
- Trigger: appointment number allocation with row lock (no duplicates under concurrency).
- Trigger: session overlap prevention (doctor + room).
- Trigger: history protection (no delete of records with history).
- NUMERIC(10,2) for money (LKR).

## 3. Encryption at rest
- AES-256-GCM with random IV per value via JPA `AttributeConverter`s.
- HMAC-SHA256 lookup columns for email + NIC (login/uniqueness/search).
- BCrypt 12 for passwords.
- Verified by `PatientDataProtectionServiceTests` (5 tests) — ciphertext does not contain plaintext.

## 4. Persistence validation
- Records survive application restart (local verified).
- Chat history retrievable after logout/login (E2E scenario C verified).
- Consultation summaries retrievable by patient after completion (E2E scenario D verified).
- Flyway runs clean against empty `medichannel_test` DB (verified in `./mvnw test`).

## 5. Open gaps
- Email stored plaintext; chat messages plaintext (V1 schema); address not collected.
- No audit_log coverage beyond table creation.
- No TTL cache (performance).
- No backup/retention policy documented for production (recommend daily Neon backups + 7-year retention for medical records per SL health data norms).

## 6. Production safety
- All destructive tests ran against local disposable `medichannel_test` DB only.
- Neon production branch never truncated or modified destructively.
- Secrets (DB_PASSWORD, JWT_SECRET, ENCRYPTION_KEY, HMAC_SECRET) only in env vars, never committed.