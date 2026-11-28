import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const API_SOURCE = fs.readFileSync(path.join(ROOT, "public/mediclinic-api.js"), "utf8");
const APP_SOURCE = fs.readFileSync(path.join(ROOT, "public/mediclinic-app.js"), "utf8");
const HTML_SOURCE = fs.readFileSync(path.join(ROOT, "public/mediclinic-system.html"), "utf8");

test("1. Active queue renders completely", () => {
  // Active queue renders all session appointments without pagination
  assert.match(APP_SOURCE, /function renderDoctorRows\(queue, session\)/);
  assert.match(APP_SOURCE, /\(queue\.appointments \|\| \[\]\)\.forEach/);
  assert.match(HTML_SOURCE, /<tbody data-doctor-rows><\/tbody>/);
});

test("2. Current and next patient remain visible", () => {
  // Now serving indicator in stats
  assert.match(APP_SOURCE, /queue\.nowServing \? "#" \+ queue\.nowServing : "—"/);
  // Next indicator badge in active queue
  assert.match(
    APP_SOURCE,
    /appointment\.status === "ARRIVED" &&\s*queue\.nextNumber &&\s*appointment\.appointmentNumber === queue\.nextNumber/
  );
  assert.match(APP_SOURCE, /entry = \["Next", "orange"\]/);
});

test("3. History uses backend pagination metadata", () => {
  // API client provides paginated endpoint
  assert.match(
    API_SOURCE,
    /doctorAppointmentHistory\(filters\)\s*\{\s*return request\("doctor\/appointments\/history" \+ query\(filters\)\);\s*\}/
  );
  // SPA parses totalElements, totalPages, and page from backend PagedResponse
  assert.match(APP_SOURCE, /const norm = normalizeAppointmentsResponse\(payload\);/);
  assert.match(APP_SOURCE, /const totalElements = norm \? norm\.totalElements : items\.length;/);
  assert.match(APP_SOURCE, /const totalPages = norm \? norm\.totalPages : Math\.ceil/);
  assert.match(
    APP_SOURCE,
    /info\.textContent\s*=\s*"Page "\s*\+\s*\(page\s*\+\s*1\)\s*\+\s*" of "\s*\+\s*effectiveTotalPages/
  );
});

test("4. Previous/Next boundaries", () => {
  assert.match(APP_SOURCE, /prev\.disabled = page <= 0;/);
  assert.match(APP_SOURCE, /next\.disabled = page >= effectiveTotalPages - 1;/);
  assert.match(HTML_SOURCE, /data-doctor-history-prev/);
  assert.match(HTML_SOURCE, /data-doctor-history-next/);
});

test("5. Filter change resets page", () => {
  assert.match(
    APP_SOURCE,
    /if \(event\.target\.id === "doctor-history-status-filter"\) \{\s*void loadDoctorHistory\(\{\s*page:\s*0\s*\}\);\s*return;\s*\}/
  );
  assert.match(HTML_SOURCE, /id="doctor-history-status-filter"/);
});

test("6. Selected session remains active while paging", () => {
  // Paging history does not reset or alter state.doctor.sessionId
  assert.match(
    APP_SOURCE,
    /async function loadDoctorHistory\(options = \{\}\)/
  );
  assert.doesNotMatch(
    APP_SOURCE,
    /function loadDoctorHistory[\s\S]*?state\.doctor\.sessionId = null;/
  );
});

test("7. Doctor actions refresh active queue", () => {
  // runDoctorAction refreshes active session queue
  assert.match(
    APP_SOURCE,
    /await MC\.acceptAppointment\(appointmentId\);[\s\S]*?await loadDoctorQueue\(state\.doctor\.sessionId\);/
  );
  assert.match(
    APP_SOURCE,
    /await MC\.declineAppointment\(appointmentId, reason\);[\s\S]*?await loadDoctorQueue\(state\.doctor\.sessionId\);/
  );
});

test("8. Completed/no-show action refreshes history", () => {
  // Completing consultation or marking no-show triggers history refresh
  assert.match(
    APP_SOURCE,
    /selectNotes\(result\.completed\);\s*void loadDoctorHistory\(\);/
  );
  assert.match(
    APP_SOURCE,
    /await MC\.markNoShow\(appointmentId\);[\s\S]*?void loadDoctorHistory\(\);/
  );
  assert.match(
    APP_SOURCE,
    /await MC\.hideDoctorAppointment\(appointmentId\);[\s\S]*?void loadDoctorHistory\(\);/
  );
});

test("9. Rapid notifications are coalesced", () => {
  assert.match(APP_SOURCE, /if \(state\.doctor\.historyTimer\)\s*\{\s*clearTimeout\(state\.doctor\.historyTimer\);\s*\}/);
  assert.match(APP_SOURCE, /state\.doctor\.historyTimer = setTimeout\(\(\) => \{\s*state\.doctor\.historyTimer = null;\s*void loadDoctorHistory\(\);\s*\}, 300\);/);
});

test("10. No parallel reloads", () => {
  assert.match(APP_SOURCE, /if \(reloadState\.inFlight\)\s*\{\s*reloadState\.pending = true;/);
  assert.match(APP_SOURCE, /reloadState\.inFlight = true;/);
  assert.match(APP_SOURCE, /reloadState\.inFlight = false;/);
});

test("11. No direct row injection", () => {
  // Rows rendered via DOM element creation and replaceChildren, never unescaped innerHTML
  assert.match(APP_SOURCE, /function renderDoctorHistoryRows\(items\)/);
  assert.match(APP_SOURCE, /tbody\.replaceChildren\(\);/);
  assert.doesNotMatch(APP_SOURCE, /tbody\.innerHTML \+=/);
});

test("12. Global counts do not use visible history length", () => {
  // Session stats booked and waiting counts come from complete queue
  assert.match(APP_SOURCE, /set\("\[data-stat-booked\]", appointments\.length\);/);
  assert.match(
    APP_SOURCE,
    /set\(\s*"\[data-stat-completed\]",\s*appointments\.filter\(\(item\) => item\.status === "COMPLETED"\)\.length\s*\);/
  );
  // History totalElements used for history page info
  assert.match(
    APP_SOURCE,
    /info\.textContent\s*=\s*"Page "\s*\+\s*\(page\s*\+\s*1\)\s*\+\s*" of "\s*\+\s*effectiveTotalPages/
  );
});

test("13. Consultation and chat links resolve exact appointments", () => {
  assert.match(
    API_SOURCE,
    /doctorAppointment\(appointmentId\)\s*\{\s*return request\(\s*"doctor\/appointments\/" \+ encodeURIComponent\(appointmentId\)\s*\);\s*\}/
  );
  assert.match(
    APP_SOURCE,
    /fresh = await MC\.doctorAppointment\(appointmentId\);/
  );
});

test("14. Existing patient pagination remains unchanged", () => {
  assert.match(HTML_SOURCE, /data-appointments-pagination/);
  assert.match(HTML_SOURCE, /data-appointments-page-info/);
  assert.match(HTML_SOURCE, /data-appointments-prev/);
  assert.match(HTML_SOURCE, /data-appointments-next/);
  assert.match(APP_SOURCE, /async function loadAppointments\(options = \{\}\)/);
});

test("15. Batch 1-5 behavior remains intact", () => {
  // Batch 5 Notices public navigation
  assert.match(HTML_SOURCE, /<a href="#notices" data-roles="CUSTOMER GUEST"/);
  // Batch 5 searchable dropdowns closed initially
  assert.match(APP_SOURCE, /panel\.hidden = true;/);
  assert.match(APP_SOURCE, /panel\.setAttribute\("aria-hidden", "true"\);/);
  // Doctor past consultations panel in aside
  assert.match(HTML_SOURCE, /<a href="#doctor-h" data-panel-link class="sa">Past consultations<\/a>/);
});
