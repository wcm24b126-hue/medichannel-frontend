-- MediChannel / IT404050 group design candidate v2.1 — PostgreSQL 16
-- IMPORTANT: use on a NEW EMPTY database. Not a migration for an existing database.
-- This is a schema candidate for group review, not a tested production implementation.
-- BR-01..BR-11 / RT-01..RT-04 from the lecturer's 5 November 2026 brief.
-- The Spring Boot service MUST enforce authorization, time cutoffs, cross-row transitions,
-- encryption before writes, notification ownership, and transactional booking allocation.
-- All ciphertext BYTEA columns hold AES-256-GCM encrypted bytes (new random IV per value).
-- All HMAC BYTEA fields are keyed HMAC-SHA256 from canonicalized lookup values.

BEGIN;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 01. Guest is not a database role; registered people are CUSTOMER/DOCTOR/MANAGER/ADMIN.
CREATE TABLE users (
  user_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  role VARCHAR(10) NOT NULL CHECK (role IN ('CUSTOMER','DOCTOR','MANAGER','ADMIN')),
  full_name_ciphertext BYTEA, -- staff account display; customer name lives in patients
  email_ciphertext BYTEA NOT NULL,
  email_hmac BYTEA NOT NULL UNIQUE CHECK (octet_length(email_hmac) = 32),
  password_hash TEXT NOT NULL CHECK (char_length(password_hash) > 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  failed_login_attempts SMALLINT NOT NULL DEFAULT 0 CHECK (failed_login_attempts BETWEEN 0 AND 5),
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 02. A walk-in may be created by a manager without a login: explicit proposed group choice.
-- The alternative is creating a CUSTOMER account and making user_id NOT NULL.
CREATE TABLE patients (
  patient_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT UNIQUE REFERENCES users(user_id) ON DELETE RESTRICT,
  full_name_ciphertext BYTEA NOT NULL,
  nic_ciphertext BYTEA NOT NULL,
  nic_hmac BYTEA NOT NULL UNIQUE CHECK (octet_length(nic_hmac) = 32),
  date_of_birth_ciphertext BYTEA NOT NULL,
  gender_ciphertext BYTEA NOT NULL,
  phone_ciphertext BYTEA NOT NULL,
  address_ciphertext BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 03
CREATE TABLE specialisations (
  specialisation_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE CHECK (btrim(name) <> ''),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 04. Doctor name, credentials and bio are public professional profile information.
CREATE TABLE doctors (
  doctor_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE RESTRICT,
  specialisation_id BIGINT NOT NULL REFERENCES specialisations(specialisation_id) ON DELETE RESTRICT,
  display_name VARCHAR(200) NOT NULL CHECK (btrim(display_name) <> ''),
  slmc_registration_no VARCHAR(60) NOT NULL UNIQUE CHECK (btrim(slmc_registration_no) <> ''),
  qualifications TEXT NOT NULL DEFAULT '',
  profile_fee_lkr NUMERIC(12,2) NOT NULL CHECK (profile_fee_lkr >= 0),
  bio TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 05
CREATE TABLE rooms (
  room_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  room_label VARCHAR(80) NOT NULL UNIQUE CHECK (btrim(room_label) <> ''),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 06. now_serving_number persists the RT-01 queue state.
-- next_appointment_number is a NONREUSABLE allocator; cancellations do not decrement it.
CREATE TABLE sessions (
  session_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  doctor_id BIGINT NOT NULL REFERENCES doctors(doctor_id) ON DELETE RESTRICT,
  room_id BIGINT REFERENCES rooms(room_id) ON DELETE RESTRICT,
  session_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  session_type VARCHAR(8) NOT NULL CHECK (session_type IN ('PHYSICAL','ONLINE')),
  max_patients SMALLINT NOT NULL CHECK (max_patients BETWEEN 1 AND 60),
  minutes_per_patient SMALLINT NOT NULL CHECK (minutes_per_patient BETWEEN 5 AND 30),
  fee_lkr NUMERIC(12,2) NOT NULL CHECK (fee_lkr >= 0),
  status VARCHAR(12) NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED','OPEN','IN_PROGRESS','COMPLETED','CANCELLED')),
  delay_minutes INTEGER NOT NULL DEFAULT 0 CHECK (delay_minutes >= 0),
  next_appointment_number SMALLINT NOT NULL DEFAULT 1 CHECK (next_appointment_number BETWEEN 1 AND 61),
  now_serving_number SMALLINT CHECK (now_serving_number BETWEEN 1 AND 60),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT session_times_valid CHECK (end_time > start_time),
  CONSTRAINT session_room_by_type CHECK ((session_type='PHYSICAL' AND room_id IS NOT NULL)
                                       OR (session_type='ONLINE' AND room_id IS NULL)),
  CONSTRAINT session_allocator_within_capacity CHECK (next_appointment_number <= max_patients + 1),
  CONSTRAINT session_serving_within_capacity CHECK (now_serving_number IS NULL OR now_serving_number <= max_patients)
);

-- The range is half open [start, end): a 10:00-11:00 session and an 11:00-12:00 session do not overlap.
-- Excluding cancelled sessions allows later re-use of the doctor/room time.
ALTER TABLE sessions ADD CONSTRAINT no_overlapping_doctor_sessions
  EXCLUDE USING gist (
    doctor_id WITH =,
    tsrange(session_date + start_time,session_date + end_time,'[)') WITH &&
  ) WHERE (status <> 'CANCELLED');
ALTER TABLE sessions ADD CONSTRAINT no_overlapping_room_sessions
  EXCLUDE USING gist (
    room_id WITH =,
    tsrange(session_date + start_time,session_date + end_time,'[)') WITH &&
  ) WHERE (room_id IS NOT NULL AND status <> 'CANCELLED');

-- 07. Payment status/method are on the appointment; no payment table is required by the brief.
CREATE TABLE appointments (
  appointment_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  patient_id BIGINT NOT NULL REFERENCES patients(patient_id) ON DELETE RESTRICT,
  session_id BIGINT NOT NULL REFERENCES sessions(session_id) ON DELETE RESTRICT,
  appointment_number SMALLINT NOT NULL CHECK (appointment_number > 0),
  booking_reference VARCHAR(64) NOT NULL UNIQUE CHECK (btrim(booking_reference) <> ''),
  status VARCHAR(18) NOT NULL DEFAULT 'BOOKED' CHECK (status IN ('BOOKED','ARRIVED','IN_CONSULTATION','COMPLETED','NO_SHOW','CANCELLED')),
  payment_status VARCHAR(7) NOT NULL DEFAULT 'PENDING' CHECK (payment_status IN ('PENDING','PAID')),
  payment_method VARCHAR(4) CHECK (payment_method IN ('CASH','CARD')),
  paid_at TIMESTAMPTZ,
  fee_lkr_snapshot NUMERIC(12,2) NOT NULL CHECK (fee_lkr_snapshot >= 0),
  reason_for_visit_ciphertext BYTEA NOT NULL,
  checked_in_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT appointment_number_per_session UNIQUE (session_id,appointment_number),
  CONSTRAINT payment_fields_consistent CHECK (
    (payment_status='PENDING' AND payment_method IS NULL AND paid_at IS NULL)
    OR (payment_status='PAID' AND payment_method IS NOT NULL AND paid_at IS NOT NULL)
  ),
  CONSTRAINT cancellation_timestamp_consistent CHECK ((status='CANCELLED') = (cancelled_at IS NOT NULL))
);

CREATE UNIQUE INDEX one_active_appointment_per_patient_session
 ON appointments (session_id,patient_id)
 WHERE status IN ('BOOKED','ARRIVED','IN_CONSULTATION');
CREATE INDEX appointments_patient_history_idx ON appointments(patient_id,created_at DESC);
CREATE INDEX appointments_session_queue_idx ON appointments(session_id,appointment_number);
CREATE INDEX appointments_status_pay_idx ON appointments(status,payment_status);

-- 08. Doctor/patient ownership is derived from appointment->session->doctor and appointment->patient.
-- Do not duplicate those FKs unless the group intentionally adds a consistency mechanism.
CREATE TABLE consultations (
  consultation_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  appointment_id BIGINT NOT NULL UNIQUE REFERENCES appointments(appointment_id) ON DELETE RESTRICT,
  status VARCHAR(6) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','ENDED')),
  diagnosis_ciphertext BYTEA,
  advice_ciphertext BYTEA,
  prescription_ciphertext BYTEA,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT consultation_end_consistent CHECK ((status='ENDED') = (ended_at IS NOT NULL))
);

-- 09. Typing/connection status is ephemeral WebSocket presence and is NOT persisted here.
CREATE TABLE chat_messages (
  chat_message_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  consultation_id BIGINT NOT NULL REFERENCES consultations(consultation_id) ON DELETE RESTRICT,
  sender_user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  message_ciphertext BYTEA NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX chat_messages_timeline_idx ON chat_messages (consultation_id,sent_at,chat_message_id);

-- 10. Store no medical reason, diagnosis or chat message in notifications.
CREATE TABLE notifications (
  notification_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  recipient_user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  session_id BIGINT REFERENCES sessions(session_id) ON DELETE RESTRICT,
  appointment_id BIGINT REFERENCES appointments(appointment_id) ON DELETE RESTRICT,
  event_type VARCHAR(24) NOT NULL CHECK (event_type IN ('THREE_AWAY','CALLED','SESSION_DELAYED','SESSION_CANCELLED','CONSULTATION_STARTED')),
  message_text VARCHAR(300) NOT NULL CHECK (btrim(message_text) <> ''),
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX notifications_recipient_idx ON notifications(recipient_user_id,is_read,created_at DESC);

-- 11. Do not physically DELETE feedback: DELETED is a retained moderation state (BR-11).
CREATE TABLE feedback (
  feedback_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  appointment_id BIGINT NOT NULL UNIQUE REFERENCES appointments(appointment_id) ON DELETE RESTRICT,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment_ciphertext BYTEA NOT NULL,
  moderation_status VARCHAR(8) NOT NULL DEFAULT 'PENDING' CHECK (moderation_status IN ('PENDING','APPROVED','HIDDEN','DELETED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. Public content only; always safely encode on output.
CREATE TABLE notices (
  notice_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  published_by_user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  title VARCHAR(200) NOT NULL CHECK (btrim(title) <> ''),
  body TEXT NOT NULL CHECK (btrim(body) <> ''),
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. Append-only: no protected medical content allowed in target/action metadata.
CREATE TABLE audit_logs (
  audit_log_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_user_id BIGINT REFERENCES users(user_id) ON DELETE RESTRICT,
  action VARCHAR(100) NOT NULL CHECK (btrim(action) <> ''),
  target_type VARCHAR(40),
  target_id BIGINT,
  ip_address INET NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX audit_logs_recent_idx ON audit_logs(created_at DESC);
CREATE INDEX sessions_doctor_date_idx ON sessions(doctor_id,session_date);

CREATE OR REPLACE FUNCTION prevent_audit_changes() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only';
END;
$$;
CREATE TRIGGER audit_logs_immutable BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_changes();

-- Updated timestamps are maintained by PostgreSQL on every record edit.
CREATE OR REPLACE FUNCTION set_medichannel_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;
DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['users','patients','doctors','sessions','appointments','consultations','feedback']
  LOOP
    EXECUTE format('CREATE TRIGGER touch_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_medichannel_updated_at()',tbl);
  END LOOP;
END;
$$;

-- BR-11: history-bearing operational records are retained, never hard-deleted.
CREATE OR REPLACE FUNCTION prevent_history_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'History-bearing records are retained; update the status instead';
END;
$$;
DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['sessions','appointments','consultations','chat_messages','notifications','feedback','notices']
  LOOP
    EXECUTE format('CREATE TRIGGER preserve_history BEFORE DELETE ON %I FOR EACH ROW EXECUTE FUNCTION prevent_history_delete()',tbl);
  END LOOP;
END;
$$;

-- Review and grant application DB-role privileges separately. The database user must not
-- be able to disable these triggers or modify the schema. Use independent admin credentials.
COMMIT;

-- IMPLEMENTATION REQUIREMENTS OUTSIDE SQL (not optional):
-- 1. In Spring Boot, validate Sri Lankan NIC, phone, email, password, unique lookups, and permissions.
-- 2. Validate session booking cutoff: PHYSICAL >= 60 min before; ONLINE >= 30 min before.
-- 3. Lock the session row FOR UPDATE, re-check eligibility, issue next_appointment_number,
--    INSERT appointment and increment counter IN ONE TRANSACTION. Handle unique violations.
--    A cancellation changes status only; never decrement next_appointment_number.
-- 4. RT-02 displays remaining nonreusable numbers = MAX(0, max_patients-(next_appointment_number-1)).
--    Publish refreshed availability after cancellations; value may be unchanged due to BR-03.
-- 5. BR-07 permit customer cancellation only if PENDING and at least 3 h before session start.
-- 6. BR-06 estimated time is derived from number, minutes_per_patient, start time, delay (Asia/Colombo).
-- 7. BR-08 enforce role-appropriate status transitions; session cancellation cancels linked appointments.
-- 8. BR-09 only booked patient and treating doctor can join active consultation; ENDED = read-only.
-- 9. RT-03 encrypt chat message at rest, validate plaintext <=1000 chars before encryption.
--    Typing and presence live in WebSocket events, not persistent table fields.
-- 10. Keep API/DTOs for MANAGER and ADMIN free of reason/notes/prescriptions/chat data.
-- 11. Reject ADMIN self-deactivation in service layer; require password change after staff reset.
-- 12. Use timezone-aware timestamps and Asia/Colombo for session times; compute daily revenue
--     from PAID appointments' fee_lkr_snapshot (snapshot avoids editing past revenue).
-- 13. For walk-ins without a users record, create patients with user_id NULL; in-app
--     notifications require a users recipient, so explain that limitation to the group.
-- 14. No plaintext PII in seed.sql; seed via application encrypt/HMAC service with fictional values.
