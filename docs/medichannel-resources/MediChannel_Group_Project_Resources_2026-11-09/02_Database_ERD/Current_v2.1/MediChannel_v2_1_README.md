# MediChannel — Group ERD / UI Alignment v2.1
9 November 2026 · IT404050 Assignment 2

**Purpose:** Bring the previously corrected 13-table ERD into alignment with the leader's illustrative HTML UI and the lecturer's original brief. The leader's HTML is a *sample*, not a finished frontend. No extra table or lecturer requirement has been introduced.

## Artifacts
- `MediChannel_ERD_UI_Alignment_v2_1.docx`: change register, role-to-table matrix, three detailed ERD views, 20 acceptance checks, and unresolved choices.
- `MediChannel_group_schema_v2_1.sql`: fresh-database PostgreSQL 16 DDL candidate with 13 tables, 16 foreign keys, indexes, and some history/overlap safeguards.
- `MediChannel_ERD_v2_1_full.png` / `.svg`: one complete diagram.
- `MediChannel_ERD_v2_1_identity.png`, `MediChannel_ERD_v2_1_booking.png`, `MediChannel_ERD_v2_1_alerts.png`: readable details.

## Five points to approve before group integration
1. **Walk-ins:** Proposed patients.user_id nullable. Decide whether manager-created walk-ins must hold a CUSTOMER account. A walk-in without an account cannot receive in-app notifications.
2. **Cancellation availability:** Do **not** reuse numbers. `numbers_left = max_patients - (next_appointment_number - 1)`; cancellations send an update event but do not replenish issued numbers. Lecturer clarification may be useful if RT-02 was intended to increase this figure on cancellation.
3. **Queue:** `sessions.now_serving_number` persisted; `patients_before_me` derived from active queue entries, not the raw difference between issued numbers. Agree WebSocket payloads.
4. **Privacy:** Manager/Admin DTOs and WebSocket responses must exclude reason/notes/prescription/chat content even if the database contains encrypted fields. Encryption at rest is not sufficient authorization.
5. **Schema adoption:** This SQL is a proposal for a **new empty database**, not a migration against the group's existing working DB. Compare it with the actual group schema first.

## Important boundaries
- Features such as NIC/phone/password validation, JWT, authorisation, encryption, WebSockets, form errors, session transitions, booking locks and the forced password reset **must be implemented in Spring Boot / Next.js**. A diagram cannot prove they work.
- The group must verify PostgreSQL execution, seed with **fictional encrypted personal data via the application**, pass concurrency and security tests, and record real evidence.
- There are 4 authenticated roles (CUSTOMER, DOCTOR, MANAGER, ADMIN) plus Guest as an unauthenticated experience.
- This material is AI-assisted design work and should be reviewed and acknowledged according to the lecturer's directions.
