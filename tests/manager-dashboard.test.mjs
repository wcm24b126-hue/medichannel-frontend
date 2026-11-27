import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const SOURCE = readFileSync(
  new URL("../public/mediclinic-manager.js", import.meta.url),
  "utf8"
);
const APP_SOURCE = readFileSync(
  new URL("../public/mediclinic-app.js", import.meta.url),
  "utf8"
);

function loadManagerUI() {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(SOURCE, sandbox, { filename: "mediclinic-manager.js" });
  return sandbox.window.MCManager;
}

const UI = loadManagerUI();

test("1. Manager dashboard metrics use authoritative backend fields directly", () => {
  const report = {
    sessionsThisWeek: 125,
    doctorsToday: 5,
    completedAppointments: 18,
    cancelledAppointments: 2,
    totalAppointments: 25,
    physicalAppointments: 20,
    onlineAppointments: 5,
    revenueLkr: 62500.0,
    bookedAppointments: 4,
    checkedInAppointments: 2,
    arrivedAppointments: 1,
    inConsultationAppointments: 0,
    noShows: 1,
    unpaidAppointments: 3,
    unpaidAmountLkr: 7500.0,
    roomsToday: 4,
    sessionsToday: 6,
    activeSessionsToday: 3,
    completedSessionsToday: 2,
    cancelledSessionsToday: 1,
    totalCapacity: 60,
    bookedCapacity: 25,
    occupancyRate: 41.67,
    noShowRate: 4.35,
  };

  const metrics = UI.dashboardMetrics(report);

  assert.equal(metrics.sessionsThisWeek, 125);
  assert.equal(metrics.doctorsToday, 5);
  assert.equal(metrics.completedToday, 18);
  assert.equal(metrics.completedAppointments, 18);
  assert.equal(metrics.cancelledToday, 2);
  assert.equal(metrics.appointmentsToday, 25);
  assert.equal(metrics.physicalAppointments, 20);
  assert.equal(metrics.onlineAppointments, 5);
  assert.equal(metrics.revenueLkr, 62500.0);
  assert.equal(metrics.bookedAppointments, 4);
  assert.equal(metrics.checkedInAppointments, 2);
  assert.equal(metrics.arrivedAppointments, 1);
  assert.equal(metrics.inConsultationAppointments, 0);
  assert.equal(metrics.noShowAppointments, 1);
  assert.equal(metrics.unpaidAppointments, 3);
  assert.equal(metrics.unpaidAmountLkr, 7500.0);
  assert.equal(metrics.roomsToday, 4);
  assert.equal(metrics.sessionsToday, 6);
  assert.equal(metrics.activeSessionsToday, 3);
  assert.equal(metrics.completedSessionsToday, 2);
  assert.equal(metrics.cancelledSessionsToday, 1);
  assert.equal(metrics.totalCapacity, 60);
  assert.equal(metrics.bookedCapacity, 25);
  assert.equal(metrics.occupancyRate, 41.67);
  assert.equal(metrics.noShowRate, 4.35);
});

test("2. Authoritative backend fields take precedence over row counting", () => {
  // Even if todaySessions has 1 dummy session, the top-level aggregate must be respected
  const report = {
    todaySessions: [
      { doctorName: "A. Perera", completed: 1, booked: 1 },
    ],
    doctorsToday: 8,
    completedAppointments: 32,
    sessionsThisWeek: 140,
    totalAppointments: 40,
    cancelledAppointments: 3,
    physicalAppointments: 30,
    onlineAppointments: 10,
    revenueLkr: 96000.0,
  };

  const metrics = UI.dashboardMetrics(report);

  assert.equal(metrics.doctorsToday, 8, "doctorsToday must use authoritative report.doctorsToday");
  assert.equal(metrics.completedToday, 32, "completedToday must use authoritative report.completedAppointments");
});

test("3. Real zero figures display as 0 and LKR 0.00, not '—'", () => {
  const metrics = UI.dashboardMetrics({
    sessionsThisWeek: 0,
    doctorsToday: 0,
    completedAppointments: 0,
    cancelledAppointments: 0,
    totalAppointments: 0,
    physicalAppointments: 0,
    onlineAppointments: 0,
    revenueLkr: 0,
  });

  const cards = UI.dashboardCardValues(metrics);

  assert.equal(cards.sessionsThisWeek, "0");
  assert.equal(cards.doctorsToday, "0");
  assert.equal(cards.completedToday, "0");
  assert.equal(cards.cancelledToday, "0");
  assert.equal(cards.appointmentsToday, "0");
  assert.equal(cards.typeSplit, "0 / 0");
  assert.equal(cards.revenue, "LKR 0.00");
});

test("4. Missing or unavailable figures display as '—'", () => {
  const cards = UI.dashboardCardValues(UI.dashboardMetrics({}));

  assert.equal(cards.sessionsThisWeek, "—");
  assert.equal(cards.doctorsToday, "—");
  assert.equal(cards.completedToday, "—");
  assert.equal(cards.cancelledToday, "—");
  assert.equal(cards.appointmentsToday, "—");
  assert.equal(cards.typeSplit, "—");
  assert.equal(cards.revenue, "—");
});

test("5. Today's session table does not fall back to sessions from other dates", () => {
  // Verify that the code no longer does: todaySessions.length > 0 ? todaySessions : sessions.slice(0, 8)
  assert.equal(
    APP_SOURCE.includes("sessions.slice(0, 8)"),
    false,
    "Today's active doctor sessions must never display other days' sessions as fallback"
  );
  assert.ok(
    APP_SOURCE.includes("No sessions scheduled for today."),
    "Today's active doctor sessions must show an explicit empty message when 0 sessions today"
  );
});

test("6. Error state provides a retry button with data-retry-manager-dashboard", () => {
  assert.ok(
    APP_SOURCE.includes("data-retry-manager-dashboard"),
    "Dashboard error state must wire a retry option"
  );
  assert.ok(
    APP_SOURCE.includes("The dashboard values are unavailable."),
    "Error state must inform the user that dashboard values are unavailable"
  );
});

test("7. Operational workflow actions invalidate manager dashboard cache", () => {
  // Check that invalidateManagerDashboard is wired to key workflow updates
  assert.ok(
    APP_SOURCE.includes("invalidateManagerDashboard();"),
    "invalidateManagerDashboard must exist"
  );

  // Check walkin
  const walkinIdx = APP_SOURCE.indexOf("async function submitWalkIn");
  assert.ok(walkinIdx > 0, "submitWalkIn must exist");
  const walkinBlock = APP_SOURCE.slice(walkinIdx, walkinIdx + 2000);
  assert.ok(
    walkinBlock.includes("invalidateManagerDashboard();"),
    "submitWalkIn must invalidate manager dashboard"
  );

  // Check mark arrived
  const arrivedIdx = APP_SOURCE.indexOf("markManagerArrived(");
  assert.ok(arrivedIdx > 0, "markManagerArrived must exist");
  const arrivedBlock = APP_SOURCE.slice(arrivedIdx, arrivedIdx + 500);
  assert.ok(
    arrivedBlock.includes("invalidateManagerDashboard();"),
    "markManagerArrived must invalidate manager dashboard"
  );

  // Check check-in
  const checkinIdx = APP_SOURCE.indexOf("checkInAppointment(");
  assert.ok(checkinIdx > 0, "checkInAppointment must exist");
  const checkinBlock = APP_SOURCE.slice(checkinIdx, checkinIdx + 500);
  assert.ok(
    checkinBlock.includes("invalidateManagerDashboard();"),
    "checkInAppointment must invalidate manager dashboard"
  );

  // Check payment
  const payIdx = APP_SOURCE.indexOf("payAppointment(");
  assert.ok(payIdx > 0, "payAppointment must exist");
  const payBlock = APP_SOURCE.slice(payIdx, payIdx + 500);
  assert.ok(
    payBlock.includes("invalidateManagerDashboard();"),
    "payAppointment must invalidate manager dashboard"
  );

  // Check notifications for manager
  const notifIdx = APP_SOURCE.indexOf("function handleIncomingNotification");
  assert.ok(notifIdx > 0, "handleIncomingNotification must exist");
  const notifBlock = APP_SOURCE.slice(notifIdx, notifIdx + 1500);
  assert.ok(
    notifBlock.includes('S.role === "MANAGER"') && notifBlock.includes("invalidateManagerDashboard()"),
    "Incoming notification must invalidate manager dashboard for MANAGER role"
  );
});
