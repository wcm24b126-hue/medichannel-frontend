import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { verifyWorkspaceSession } from "../src/lib/workspace-session.ts";

const read = (path) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

const LOGIN_ROUTE = read("../src/app/api/auth/login/route.ts");
const REGISTER_ROUTE = read("../src/app/api/auth/register/route.ts");
const ME_ROUTE = read("../src/app/api/auth/me/route.ts");
const LOGOUT_ROUTE = read("../src/app/api/auth/logout/route.ts");
const COOKIE_LIB = read("../src/lib/auth-cookie.ts");
const APP = read("../public/mediclinic-app.js");

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

test("login returns a tab token and issues no auth cookie", () => {
  assert.match(LOGIN_ROUTE, /token:\s*data\.accessToken/);
  assert.doesNotMatch(LOGIN_ROUTE, /setAuthCookie/);
});

test("registration returns a tab token and issues no auth cookie", () => {
  assert.match(REGISTER_ROUTE, /token:\s*login\.accessToken/);
  assert.doesNotMatch(REGISTER_ROUTE, /setAuthCookie/);
});

test("me ignores ambient cookies for tab requests and requires a bearer token", () => {
  assert.match(ME_ROUTE, /x-medichannel-tab/);
  assert.match(ME_ROUTE, /isTabRequest \? null : readAuthToken\(request\)/);
  assert.match(ME_ROUTE, /incomingAuth/);
});

test("auth cookie library only clears legacy cookies", () => {
  assert.doesNotMatch(COOKIE_LIB, /export function setAuthCookie/);
  assert.match(COOKIE_LIB, /export function clearAuthCookie/);
});

test("logout revokes the tab token on the backend", () => {
  assert.match(LOGOUT_ROUTE, /incomingAuth/);
  assert.match(LOGOUT_ROUTE, /\/api\/v1\/auth\/logout/);
  assert.match(LOGOUT_ROUTE, /clearAuthCookie\(response\)/);
});

test("logout clears the tab token from sessionStorage", () => {
  assert.match(APP, /sessionStorage\.removeItem\("mc_tab_token"\)/);
});

test("the public shell persists the token returned by login", () => {
  const login = functionSource("handleLogin");
  assert.match(login, /typeof result\.token !== "string"/);
  assert.match(login, /setSession\(result\.user, result\.token\)/);

  const setSession = functionSource("setSession");
  assert.match(setSession, /sessionStorage\.setItem\("mc_tab_token", token\)/);
  assert.match(setSession, /sessionStorage\.removeItem\("mc_tab_token"\)/);
});

test("the public shell persists the token returned by registration", () => {
  const register = functionSource("handleRegister");
  assert.match(register, /typeof result\.token === "string"/);
  assert.match(register, /setSession\(result\.user, result\.token\)/);
});

test("a tab without a token drops stale cached user state on boot", () => {
  const boot = APP.slice(APP.indexOf("async function initializeApp("));
  assert.match(boot, /sessionStorage\.removeItem\("mc_tab_user"\)/);
});

test("setSession really writes the tab token and clears it when signed out", () => {
  const store = new Map();
  const sessionStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  };
  const localStorage = { setItem() {}, removeItem() {} };
  const state = {
    consult: {},
    doctor: { pollTimer: null },
    patientPollTimer: null,
    notificationTimer: null,
    notifications: [],
    notificationsLoaded: false,
    shownToastIds: new Set(),
    syncedSummaryNotifications: new Set(),
    syncedReviewNotifications: new Set(),
    myReviews: [],
    submittedFeedbackIds: new Set(),
    appointments: [],
    appointmentsLoaded: false,
    profile: null,
  };
  const user = { id: "m1", role: "MANAGER", email: "manager@medichannel.demo" };
  const setSession = new Function(
    "sessionStorage",
    "localStorage",
    "HOME",
    "state",
    "S",
    "clearBookingPanel",
    "hideQueue",
    "renderNotificationBadge",
    "subscribe",
    "handleIncomingNotification",
    "setInterval",
    "clearInterval",
    "loadNotifications",
    "loadDoctorIdentity",
    `${functionSource("setSession")}\nreturn setSession;`
  )(
    sessionStorage,
    localStorage,
    { MANAGER: "#manager" },
    state,
    null,
    () => {},
    () => {},
    () => {},
    () => {},
    () => {},
    () => 1,
    () => {},
    () => {},
    () => {}
  );

  setSession(user, "tab-token");
  assert.equal(sessionStorage.getItem("mc_tab_token"), "tab-token");
  assert.equal(sessionStorage.getItem("mc_tab_user"), JSON.stringify(user));

  setSession(null);
  assert.equal(sessionStorage.getItem("mc_tab_token"), null);
  assert.equal(sessionStorage.getItem("mc_tab_user"), null);
});

const WORKSPACE = read("../src/components/common/workspace.tsx");
const WORKSPACE_SESSION = read("../src/lib/workspace-session.ts");

test("Workspace missing mc_tab_token redirects to /login without calling /api/auth/me", async () => {
  const fetchCalls = [];
  const store = new Map();
  const storage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    removeItem: (key) => store.delete(key),
  };

  const outcome = await verifyWorkspaceSession({
    expectedRole: "doctor",
    storage,
    fetchImpl: async (url, init) => {
      fetchCalls.push({ url, init });
      return new Response(null, { status: 200 });
    },
  });

  assert.deepEqual(outcome, { status: "redirect", destination: "/login" });
  assert.equal(fetchCalls.length, 0);
});

test("Workspace sends Bearer mc_tab_token, X-Medichannel-Tab: 1, no-store, restores user, and never logs or writes localStorage/cookies", async () => {
  const token = "secret-tab-jwt-token";
  const store = new Map([["mc_tab_token", token]]);
  const storage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    removeItem: (key) => store.delete(key),
  };
  const fetchCalls = [];
  const logged = [];
  const origLog = console.log;
  const origWarn = console.warn;
  const origError = console.error;
  console.log = (...args) => logged.push(args.join(" "));
  console.warn = (...args) => logged.push(args.join(" "));
  console.error = (...args) => logged.push(args.join(" "));

  try {
    const outcome = await verifyWorkspaceSession({
      expectedRole: "manager",
      storage,
      fetchImpl: async (url, init) => {
        fetchCalls.push({ url, init });
        return new Response(
          JSON.stringify({ user: { userId: "u1", email: "m@clinic.lk", role: "MANAGER" } }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      },
    });

    assert.deepEqual(outcome, { status: "authenticated", role: "manager" });
    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].url, "/api/auth/me");
    assert.equal(fetchCalls[0].init.cache, "no-store");
    assert.equal(fetchCalls[0].init.headers.Authorization, `Bearer ${token}`);
    assert.equal(fetchCalls[0].init.headers["X-Medichannel-Tab"], "1");
    assert.equal(logged.some((entry) => entry.includes(token)), false);
  } finally {
    console.log = origLog;
    console.warn = origWarn;
    console.error = origError;
  }

  assert.doesNotMatch(WORKSPACE, /localStorage\.(setItem|getItem|removeItem)/);
  assert.doesNotMatch(WORKSPACE_SESSION, /localStorage\.(setItem|getItem|removeItem)/);
  assert.doesNotMatch(WORKSPACE, /document\.cookie/);
  assert.doesNotMatch(WORKSPACE_SESSION, /document\.cookie/);
  assert.match(WORKSPACE, /!sessionRole/);
});

test("Workspace HTTP 401 clears tab state and redirects to /login", async () => {
  const store = new Map([
    ["mc_tab_token", "expired-token"],
    ["mc_tab_user", JSON.stringify({ role: "ADMIN" })],
  ]);
  const storage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    removeItem: (key) => store.delete(key),
  };

  const outcome = await verifyWorkspaceSession({
    expectedRole: "admin",
    storage,
    fetchImpl: async () =>
      new Response(JSON.stringify({ message: "Authentication required." }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
  });

  assert.deepEqual(outcome, { status: "redirect", destination: "/login" });
  assert.equal(store.has("mc_tab_token"), false);
  assert.equal(store.has("mc_tab_user"), false);
});

test("Workspace role mismatch redirects to the authenticated role dashboard and HTTP 403 returns error", async () => {
  const store = new Map([["mc_tab_token", "valid-token"]]);
  const storage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    removeItem: (key) => store.delete(key),
  };

  const mismatchOutcome = await verifyWorkspaceSession({
    expectedRole: "admin",
    storage,
    fetchImpl: async () =>
      new Response(
        JSON.stringify({ user: { userId: "d1", email: "d@clinic.lk", role: "DOCTOR" } }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      ),
  });
  assert.deepEqual(mismatchOutcome, { status: "redirect", destination: "/doctor/dashboard" });

  const forbiddenOutcome = await verifyWorkspaceSession({
    expectedRole: "admin",
    storage,
    fetchImpl: async () =>
      new Response(JSON.stringify({ message: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }),
  });
  assert.deepEqual(forbiddenOutcome, { status: "error", message: "Forbidden" });
});

test("Workspace logout still forwards Bearer token to /api/auth/logout", () => {
  assert.match(WORKSPACE, /sessionStorage\.getItem\("mc_tab_token"\)/);
  assert.match(WORKSPACE, /fetch\("\/api\/auth\/logout"/);
  assert.match(WORKSPACE, /sessionStorage\.removeItem\("mc_tab_token"\)/);
});
