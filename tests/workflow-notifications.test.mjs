import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) =>
  readFileSync(new URL("../" + path, import.meta.url), "utf8");

const APP = read("public/mediclinic-app.js");
const API = read("public/mediclinic-api.js");

function functionSource(name) {
  const asyncStart = APP.indexOf(`async function ${name}(`);
  const plainStart = APP.indexOf(`function ${name}(`);
  const start = asyncStart >= 0 ? asyncStart : plainStart;
  assert.ok(start >= 0, `${name} was not found`);

  let depth = 0;
  let started = false;
  for (let i = start; i < APP.length; i += 1) {
    const char = APP[i];
    if (char === "{") {
      depth += 1;
      started = true;
    } else if (char === "}") {
      depth -= 1;
      if (started && depth === 0) return APP.slice(start, i + 1);
    }
  }
  throw new Error(`Unterminated function: ${name}`);
}

test("1. private notification subscription remains active", () => {
  assert.match(
    APP,
    /subscribe\("private-notifications",\s*"\/user\/queue\/notifications",\s*handleIncomingNotification\)/
  );
});

test("2. WebSocket notification appears once and deduplicates toast and list", () => {
  const handler = functionSource("handleIncomingNotification");
  assert.match(
    handler,
    /const exists = state\.notifications\.some\(\s*\(item\) => item\.notificationId === notification\.notificationId\s*\);\s*if \(exists\) return;/
  );
  const toast = functionSource("showNotificationToast");
  assert.match(
    toast,
    /if \(state\.shownToastIds\.has\(n\.notificationId\)\) return;\s*state\.shownToastIds\.add\(n\.notificationId\);/
  );
});

test("3. relevant dashboard state refreshes on incoming notification", () => {
  const handler = functionSource("handleIncomingNotification");
  assert.match(handler, /if \(S\.role === "DOCTOR"\)/);
  assert.match(handler, /loadDoctorQueue\(state\.doctor\.sessionId,\s*\{\s*silent:\s*true\s*\}\)/);
  assert.match(handler, /MC\.doctorSessions\(\)/);
  assert.match(handler, /else if \(S\.role === "CUSTOMER"\)/);
  assert.match(handler, /loadAppointments\(\)/);
  assert.match(handler, /refreshPatientQueue\(\)/);
});

test("4. patient can navigate to the correct next action without sensitive query params", () => {
  const actionFn = new Function(
    "S",
    `${functionSource("notificationAction")}\nreturn notificationAction;`
  );

  const patientAction = actionFn({ role: "CUSTOMER" });
  assert.deepEqual(
    patientAction({
      appointmentId: "apt-1",
      type: "APPOINTMENT_BOOKED",
      title: "Appointment Accepted",
    }),
    {
      label: "Pay in appointments →",
      view: "appointments",
      appointmentId: null,
      href: "#appointments",
    }
  );
  assert.deepEqual(
    patientAction({
      appointmentId: "apt-1",
      type: "APPOINTMENT_ARRIVED",
      title: "Arrival recorded",
    }),
    {
      label: "Follow live queue →",
      view: "appointments",
      appointmentId: null,
      href: "#appointments",
    }
  );
  assert.deepEqual(
    patientAction({
      appointmentId: "apt-1",
      type: "CONSULTATION_STARTED",
      title: "Consultation started",
    }),
    {
      label: "Join consultation →",
      view: "consult",
      appointmentId: "apt-1",
      href: "#consult-apt-1",
    }
  );
  assert.deepEqual(
    patientAction({
      appointmentId: "apt-1",
      type: "SUMMARY_AVAILABLE",
      title: "Consultation summary available",
    }),
    {
      label: "View consultation summary →",
      view: "appointments",
      appointmentId: null,
      href: "#appointments",
    }
  );
});

test("5. doctor receives workflow navigation actions to session queue or consultation", () => {
  const actionFn = new Function(
    "S",
    `${functionSource("notificationAction")}\nreturn notificationAction;`
  );

  const doctorAction = actionFn({ role: "DOCTOR" });
  assert.deepEqual(
    doctorAction({
      appointmentId: "apt-2",
      type: "APPOINTMENT_BOOKED",
      title: "New appointment booked",
    }),
    {
      label: "View session queue →",
      view: "doctor",
      appointmentId: null,
      href: "#doctor",
    }
  );
  assert.deepEqual(
    doctorAction({
      appointmentId: "apt-2",
      type: "APPOINTMENT_ARRIVED",
      title: "Patient checked in",
    }),
    {
      label: "View session queue →",
      view: "doctor",
      appointmentId: null,
      href: "#doctor",
    }
  );
});

test("6. reconnect or poll reload does not duplicate notification rendering", () => {
  const loadFn = functionSource("loadNotifications");
  assert.match(loadFn, /const existingIds = new Set\(/);
  assert.match(loadFn, /!existingIds\.has\(n\.notificationId\)/);
  assert.match(loadFn, /refreshOpenNotificationPopovers\(\)/);
});

test("7. no browser REST JWT regression and ws-ticket behavior is unchanged", () => {
  assert.match(
    API,
    /wsTicket\(\)\s*\{\s*return request\("auth\/ws-ticket",\s*\{\s*method:\s*"POST"\s*\}\);/
  );
  assert.doesNotMatch(API, /wsTicket[\s\S]*?headers\["Authorization"\]/);
});
