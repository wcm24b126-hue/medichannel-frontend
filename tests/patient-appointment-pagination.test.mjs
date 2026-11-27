import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const API_SOURCE = fs.readFileSync(path.join(ROOT, "public/mediclinic-api.js"), "utf8");
const APP_SOURCE = fs.readFileSync(path.join(ROOT, "public/mediclinic-app.js"), "utf8");
const HTML_SOURCE = fs.readFileSync(path.join(ROOT, "public/mediclinic-system.html"), "utf8");
const PAGE_SOURCE = fs.readFileSync(path.join(ROOT, "src/app/appointments/page.tsx"), "utf8");
const E2E_SOURCE = fs.readFileSync(path.join(ROOT, "scripts/test_workflow_e2e.js"), "utf8");

test("API client separates compatibility, active, and paginated history endpoints", () => {
  assert.match(API_SOURCE, /myAppointments\(\)\s*\{\s*return request\("appointments\/me"\);\s*\}/);
  assert.match(API_SOURCE, /myActiveAppointments\(\)\s*\{\s*return request\("appointments\/me\/active"\);\s*\}/);
  assert.match(API_SOURCE, /myAppointmentHistory\(params\)\s*\{\s*return request\("appointments\/me\/history" \+ query\(params\)\);\s*\}/);
});

test("mediclinic-system.html renders patient appointment pagination controls", () => {
  assert.match(HTML_SOURCE, /data-appointments-list/);
  assert.match(HTML_SOURCE, /data-appointments-pagination/);
  assert.match(HTML_SOURCE, /data-appointments-page-info/);
  assert.match(HTML_SOURCE, /data-appointments-prev/);
  assert.match(HTML_SOURCE, /data-appointments-next/);
});

test("SPA stores activeAppointments and appointmentHistory separately and renders active first", () => {
  assert.match(APP_SOURCE, /activeAppointments:\s*\[\]/);
  assert.match(APP_SOURCE, /appointmentHistory:\s*\[\]/);
  assert.match(APP_SOURCE, /appointmentHistoryPage:\s*\{/);
  assert.match(APP_SOURCE, /MC\.myActiveAppointments\(\)/);
  assert.match(APP_SOURCE, /MC\.myAppointmentHistory\(\{\s*page:\s*requestedPage,\s*size:\s*requestedSize\s*\}\)/);
  assert.match(APP_SOURCE, /const combined = \[\s*\.\.\.\(Array\.isArray\(state\.activeAppointments\) \? state\.activeAppointments : \[\]\),\s*\.\.\.\(Array\.isArray\(state\.appointmentHistory\) \? state\.appointmentHistory : \[\]\),?\s*\]/);
});

test("live queue and consultation picker resolve from activeAppointments and exact lookup fallback", () => {
  assert.match(APP_SOURCE, /activeAppointment\(state\.activeAppointments\)/);
  assert.match(APP_SOURCE, /await refreshPatientQueue\(state\.activeAppointments\)/);
  assert.match(APP_SOURCE, /MC\.myAppointment\(appointmentId\)/);
  assert.match(APP_SOURCE, /async function confirmAppointmentCancel\(appointmentId/);
});

test("history page clamping, notification coalescing, and in-flight lock are present", () => {
  assert.match(APP_SOURCE, /normalized\.content\.length === 0 &&\s*page > 0 &&\s*normalized\.totalElements > 0/);
  assert.match(APP_SOURCE, /function scheduleAppointmentsReload\(options = \{\}\)/);
  assert.match(APP_SOURCE, /if \(reloadState\.inFlight\)/);
  assert.match(APP_SOURCE, /if \(reloadState\.pending\)/);
});

test("Next.js appointments page uses activeAppointments and backend historyTotalElements for counts", () => {
  assert.match(PAGE_SOURCE, /appointments\/me\/active/);
  assert.match(PAGE_SOURCE, /appointments\/me\/history\?page=/);
  assert.match(PAGE_SOURCE, /\{activeAppointments\.length\}/);
  assert.match(PAGE_SOURCE, /\{historyTotalElements\}/);
  assert.match(PAGE_SOURCE, /\{activePendingPaymentCount\}/);
});

test("scripts/test_workflow_e2e.js compatibility with /appointments/me is preserved", () => {
  assert.match(E2E_SOURCE, /api\('\/appointments\/me'/);
  assert.match(E2E_SOURCE, /myAppts\.find/);
});
