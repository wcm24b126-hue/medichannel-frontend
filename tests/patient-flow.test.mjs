import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const API_SOURCE = readFileSync(
  new URL("../public/mediclinic-api.js", import.meta.url),
  "utf8"
);
const APP_SOURCE = readFileSync(
  new URL("../public/mediclinic-app.js", import.meta.url),
  "utf8"
);
const HTML_SOURCE = readFileSync(
  new URL("../public/mediclinic-system.html", import.meta.url),
  "utf8"
);
const PROFILE_PAGE = readFileSync(
  new URL("../src/app/profile/page.tsx", import.meta.url),
  "utf8"
);
const APPOINTMENTS_PAGE = readFileSync(
  new URL("../src/app/appointments/page.tsx", import.meta.url),
  "utf8"
);
const CONSULTATION_PAGE = readFileSync(
  new URL("../src/app/consultation/page.tsx", import.meta.url),
  "utf8"
);

function loadApi() {
  const calls = [];
  const sandbox = {
    Headers,
    FormData,
    URLSearchParams,
    JSON,
    console,
    navigator: { onLine: true },
    sessionStorage: { getItem: () => null },
    fetch: async (url, settings = {}) => {
      calls.push({ url, settings });
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(API_SOURCE, sandbox, { filename: "mediclinic-api.js" });
  return { MC: sandbox.MC, calls };
}

test("session discovery sends explicit online and physical filters", async () => {
  const { MC, calls } = loadApi();

  await MC.sessions({ date: "2026-11-19", consultationType: "ONLINE" });
  assert.equal(
    calls[0].url,
    "/api/backend/sessions?date=2026-11-19&consultationType=ONLINE"
  );

  await MC.sessions({ consultationType: "PHYSICAL" });
  assert.equal(
    calls[1].url,
    "/api/backend/sessions?consultationType=PHYSICAL"
  );
});

test("patient profile and own feedback use the backend profile contracts", async () => {
  const { MC, calls } = loadApi();

  await MC.myProfile();
  assert.equal(calls[0].url, "/api/backend/patients/me");
  assert.equal(calls[0].settings.method, "GET");

  const payload = {
    firstName: "Asha",
    lastName: "Perera",
    phone: "0712345678",
    nic: "123456789V",
    dateOfBirth: "2000-01-01",
    gender: "Female",
    address: "Colombo",
  };
  await MC.updateMyProfile(payload);
  assert.equal(calls[1].url, "/api/backend/patients/me");
  assert.equal(calls[1].settings.method, "PUT");
  assert.deepEqual(JSON.parse(calls[1].settings.body), payload);

  await MC.myReviews();
  assert.equal(calls[2].url, "/api/backend/reviews/me");
  assert.equal(calls[2].settings.method, "GET");
});

function functionSource(source, name) {
  const asyncStart = source.indexOf(`async function ${name}(`);
  const plainStart = source.indexOf(`function ${name}(`);
  const start = asyncStart >= 0 ? asyncStart : plainStart;
  assert.ok(start >= 0, `${name} was not found`);

  let depth = 0;
  let started = false;
  for (let i = start; i < source.length; i += 1) {
    const char = source[i];
    if (char === "{") {
      depth += 1;
      started = true;
    } else if (char === "}") {
      depth -= 1;
      if (started && depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`Unterminated function: ${name}`);
}

test("a consultation deep link resolves a specific appointment", async () => {
  const { MC, calls } = loadApi();
  const id = "55555555-5555-5555-5555-555555555555";

  await MC.myAppointment(id);
  assert.equal(calls[0].url, "/api/backend/appointments/" + id);
  assert.equal(calls[0].settings.method, "GET");

  assert.match(APP_SOURCE, /id\.startsWith\("consult-"\)/);

  const actionSrc = functionSource(APP_SOURCE, "notificationAction");
  const createActionFn = (role) =>
    new Function("S", `${actionSrc}\nreturn notificationAction;`)({ role });

  const patientAction = createActionFn("CUSTOMER");
  const doctorAction = createActionFn("DOCTOR");

  assert.equal(patientAction(null), null);
  assert.equal(patientAction({ type: "CONSULTATION_STARTED" }), null);
  assert.equal(patientAction({ type: "CALLED", appointmentId: "" }), null);
  assert.equal(doctorAction({ type: "NEW_CHAT_MESSAGE" }), null);

  const specialId = "apt-1?token=secret&extra=1";
  const encodedSpecialId = encodeURIComponent(specialId);

  for (const type of ["CONSULTATION_STARTED", "CALLED", "NEW_CHAT_MESSAGE"]) {
    const action = patientAction({ appointmentId: id, type, title: "Update" });
    assert.deepEqual(action, {
      label: "Join consultation →",
      view: "consult",
      appointmentId: id,
      href: "#consult-" + encodeURIComponent(id),
    });
    assert.equal(action.href.includes("?"), false);

    const encodedAction = patientAction({
      appointmentId: specialId,
      type,
      title: "Update",
    });
    assert.equal(encodedAction.href, "#consult-" + encodedSpecialId);
    assert.equal(encodedAction.href.includes("?"), false);
  }

  for (const type of ["CONSULTATION_STARTED", "NEW_CHAT_MESSAGE"]) {
    const docAction = doctorAction({ appointmentId: id, type, title: "Update" });
    assert.deepEqual(docAction, {
      label: "Open consultation →",
      view: "consult",
      appointmentId: id,
      href: "#consult-" + encodeURIComponent(id),
    });
    assert.equal(docAction.href.includes("?"), false);
  }

  const toastSrc = functionSource(APP_SOURCE, "showNotificationToast");
  const popoverSrc = functionSource(APP_SOURCE, "renderNotificationPopover");
  assert.match(
    toastSrc,
    /const action = notificationAction\(n\);[\s\S]*?link\.href = action\.href;/
  );
  assert.match(
    popoverSrc,
    /const action = notificationAction\(n\);[\s\S]*?link\.href = action\.href;/
  );

  const createdLinks = [];
  const navCalls = [];
  const makeEl = (tag) => {
    const el = {
      tagName: tag.toUpperCase(),
      children: [],
      style: {},
      className: "",
      textContent: "",
      href: "",
      innerHTML: "",
      listeners: {},
      setAttribute() {},
      append(...nodes) {
        this.children.push(...nodes);
      },
      replaceChildren(...nodes) {
        this.children = [...nodes];
      },
      addEventListener(event, handler) {
        this.listeners[event] = handler;
      },
      remove() {},
    };
    if (tag.toLowerCase() === "a") createdLinks.push(el);
    return el;
  };
  const listEl = makeEl("div");
  const documentMock = {
    body: makeEl("body"),
    getElementById: () => null,
    createElement: makeEl,
  };
  const stateMock = {
    shownToastIds: new Set(),
    notifications: [
      {
        notificationId: "n-1",
        appointmentId: id,
        type: "CONSULTATION_STARTED",
        title: "Consultation started",
        message: "Ready",
        read: false,
      },
    ],
    consult: { requestedId: null },
  };
  const renderHarness = new Function(
    "document",
    "state",
    "animateEntry",
    "setTimeout",
    "clearTimeout",
    "markNotificationAsRead",
    "closeNotificationPopovers",
    "nav",
    "notificationAction",
    `${toastSrc}\n${popoverSrc}\nreturn { showNotificationToast, renderNotificationPopover };`
  )(
    documentMock,
    stateMock,
    () => {},
    () => 1,
    () => {},
    () => {},
    () => {},
    (view) => navCalls.push(view),
    patientAction
  );

  renderHarness.showNotificationToast(stateMock.notifications[0]);
  assert.equal(createdLinks.length, 1);
  assert.equal(createdLinks[0].href, "#consult-" + encodeURIComponent(id));
  createdLinks[0].onclick({ preventDefault() {} });
  assert.equal(stateMock.consult.requestedId, id);
  assert.deepEqual(navCalls, ["consult"]);

  stateMock.consult.requestedId = null;
  renderHarness.renderNotificationPopover({
    querySelector: () => listEl,
  });
  assert.equal(createdLinks.length, 2);
  assert.equal(createdLinks[1].href, "#consult-" + encodeURIComponent(id));
  createdLinks[1].listeners.click({ preventDefault() {} });
  assert.equal(stateMock.consult.requestedId, id);
  assert.deepEqual(navCalls, ["consult", "consult"]);
});

test("the SPA exposes patient profile management", () => {
  assert.match(HTML_SOURCE, /<section data-view="profile"/);
  assert.match(HTML_SOURCE, /href="#profile"[^>]*>My profile<\/a>/);
  assert.match(HTML_SOURCE, /data-profile-form/);
  assert.match(HTML_SOURCE, /id="profile-first"/);
  assert.match(HTML_SOURCE, /id="profile-nic"/);
  assert.match(HTML_SOURCE, /id="profile-address"/);
  assert.match(APP_SOURCE, /void loadPatientProfile\(\)/);
  assert.match(APP_SOURCE, /MC\.updateMyProfile\(payload\)/);
});

test("the patient profile has a polished identity header and grouped details", () => {
  assert.match(HTML_SOURCE, /data-profile-initials/);
  assert.match(HTML_SOURCE, /data-profile-name/);
  assert.match(HTML_SOURCE, /data-profile-email/);
  assert.match(HTML_SOURCE, /aria-label="Identity details"/);
  assert.match(HTML_SOURCE, /aria-label="Contact details"/);
  assert.match(APP_SOURCE, /querySelector\("\[data-profile-initials\]"\)/);
  assert.match(APP_SOURCE, /querySelector\("\[data-profile-name\]"\)/);
});

test("session cards declare the type badge before appending it", () => {
  const start = APP_SOURCE.indexOf("function renderSessionCard(");
  assert.ok(start > -1, "renderSessionCard is missing");
  const nextFunction = APP_SOURCE.indexOf("\n  function ", start + 10);
  const body = APP_SOURCE.slice(
    start,
    nextFunction > -1 ? nextFunction : start + 6000
  );
  const declared = body.indexOf("const typeBadge = badge(");
  const appended = body.indexOf("badgeRow.append(typeBadge, statusBadge)");
  assert.ok(declared > -1, "typeBadge is never declared");
  assert.ok(appended > -1, "typeBadge is never appended to the status row");
  assert.ok(declared < appended, "typeBadge is used before it is declared");
});

test("the primary navigation follows the active view", () => {
  assert.match(APP_SOURCE, /function setPrimaryNavCurrent\(viewId\)/);
  assert.match(APP_SOURCE, /setPrimaryNavCurrent\(targetId\)/);
  assert.match(
    APP_SOURCE,
    /nav\[aria-label="Pages"\] a\[href\^="#"\]:not\(\[data-panel-link\]\)/
  );
});

test("the profile identity header shows a circular picture and right-aligned account details", () => {
  const marker = HTML_SOURCE.indexOf("data-profile-initials");
  assert.ok(marker > -1, "profile identity header is missing");
  const header = HTML_SOURCE.slice(marker - 400, marker + 800);
  assert.match(header, /patient-avatar\.svg/);
  assert.match(header, /rounded-full/);
  assert.match(header, /justify-between/);
  assert.match(header, /text-right/);
});

test("every appointment row has an active cancel action with a reason dialog", () => {
  assert.doesNotMatch(APP_SOURCE, /cancelButton\.disabled = true/);
  assert.doesNotMatch(APP_SOURCE, /data-cancel-help/);
  assert.match(APP_SOURCE, /"cancel-appointment",\s*appointment\.appointmentId/);
  assert.match(APP_SOURCE, /Reason for cancellation/);
  assert.match(APP_SOURCE, /"Confirm"/);
  assert.match(APP_SOURCE, /"Deny"/);
  assert.match(APP_SOURCE, /MC\.cancelAppointment\(appointmentId, reason\)/);
  assert.match(API_SOURCE, /cancelAppointment\(appointmentId, reason\)/);
  assert.match(API_SOURCE, /body: \{ reason \}/);
});

test("online consultation, summary and feedback flows are complete", () => {
  assert.match(APP_SOURCE, /Join online consultation/);
  assert.match(APP_SOURCE, /data-join-online/);
  assert.match(HTML_SOURCE, /data-summary-symptoms/);
  assert.match(APP_SOURCE, /record\.symptoms/);
  assert.match(APP_SOURCE, /MC\.myReviews\(\)/);
  assert.match(APP_SOURCE, /markFeedbackSubmitted/);
});

test("direct Next.js patient pages no longer contradict the implemented API", () => {
  assert.match(PROFILE_PAGE, /method: hasProfile \? "PUT" : "POST"/);
  assert.match(PROFILE_PAGE, /address: form\.address\.trim\(\) \|\| null/);
  assert.match(APPOINTMENTS_PAGE, /Pay now/);
  assert.match(APPOINTMENTS_PAGE, /appointment\.paymentStatus === "PENDING"/);
  assert.doesNotMatch(APPOINTMENTS_PAGE, /not currently exposed by a patient queue API/);
  assert.doesNotMatch(CONSULTATION_PAGE, /will be enabled after the Spring Boot WebSocket service/);
});

test("chat publishing waits for the real connection instead of throwing a raw transport error", () => {
  assert.doesNotMatch(APP_SOURCE, /Live updates are not connected yet\./);
  assert.match(APP_SOURCE, /async function publish\(destination, payload\)/);
  assert.match(APP_SOURCE, /await getRealtime\(\);/);
  assert.match(APP_SOURCE, /await waitForConnection\(\);/);
  assert.match(APP_SOURCE, /Live updates are unavailable right now\. Please try again\./);
  assert.match(APP_SOURCE, /function notifyConnected\(\)/);
  assert.match(APP_SOURCE, /function waitForConnection\(/);
  assert.match(APP_SOURCE, /notifyConnected\(\);/);
});

test("sending a chat message uses the REST fallback and disables double sends", () => {
  const send = APP_SOURCE.slice(
    APP_SOURCE.indexOf("async function sendChatMessage()"),
    APP_SOURCE.indexOf("async function sendTyping(")
  );

  assert.match(send, /async function sendChatMessage\(\)/);
  assert.match(send, /await MC\.sendChatMessage\(appointment\.appointmentId, content\)/);
  assert.doesNotMatch(send, /publish\(/);
  assert.match(send, /if \(sendButton\) sendButton\.disabled = true;/);
  assert.match(APP_SOURCE, /async function sendTyping\(typing\)/);
  assert.match(APP_SOURCE, /function startChatPolling\(appointmentId\)/);
  assert.match(APP_SOURCE, /setInterval\(\(\) => void poll\(\), 4000\)/);
  assert.match(APP_SOURCE, /preserveScroll: true/);
  assert.match(APP_SOURCE, /void loadChatHistory\(appointmentId, \{ force: true \}\)/);
});

test("the empty chat placeholder addresses each role correctly", () => {
  assert.match(APP_SOURCE, /No messages yet\. Say hello to your patient\./);
  assert.match(APP_SOURCE, /No messages yet\. Say hello to your doctor\./);
});

test("an unpaid online consultation explains why the room stays locked", () => {
  assert.doesNotMatch(APP_SOURCE, /if \(appointment\.paymentStatus !== "PAID"\) return;/);
  assert.match(
    APP_SOURCE,
    /This room stays locked until the appointment payment is recorded\./
  );
  assert.match(
    APP_SOURCE,
    /It unlocks once payment is recorded and your doctor opens the chat\./
  );
});

test("every doctor entry path starts the online consultation", () => {
  assert.match(APP_SOURCE, /await ensureDoctorConsultationStarted\(appointment\);/);
  assert.match(APP_SOURCE, /await ensureDoctorConsultationStarted\(appointmentId\);/);
  assert.match(APP_SOURCE, /await ensureDoctorConsultationStarted\(appointment\);\n\s*state\.consult\.requestedId/);
});

test("a 409 from startConsultation is verified against the server, not treated as success", () => {
  assert.doesNotMatch(APP_SOURCE, /if \(!error \|\| error\.status !== 409\)/);
  assert.match(APP_SOURCE, /const active = await refreshConsultationStatus\(appointment\.appointmentId\);/);
  assert.match(APP_SOURCE, /if \(!active\) \{[\s\S]*?return false;/);
  assert.match(APP_SOURCE, /return true;\n  \}\n\n  async function runDoctorAction/);
});
