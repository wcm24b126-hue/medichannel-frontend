import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const API_SOURCE = fs.readFileSync(path.join(ROOT, "public/mediclinic-api.js"), "utf8");
const APP_SOURCE = fs.readFileSync(path.join(ROOT, "public/mediclinic-app.js"), "utf8");
const HTML_SOURCE = fs.readFileSync(path.join(ROOT, "public/mediclinic-system.html"), "utf8");

// ---------------------------------------------------------------------------
// Core pagination tests (Batch 9)
// ---------------------------------------------------------------------------

test("1. First page renders backend content", () => {
  assert.match(API_SOURCE, /searchSessions\(filters\)\s*\{\s*return request\("sessions\/search" \+ query\(filters\)\);\s*\}/);
  assert.match(APP_SOURCE, /MC\.searchSessions\(requestFilters\)/);
  assert.match(APP_SOURCE, /renderSessions\(\);/);
});

test("2. Previous disabled on first page", () => {
  assert.match(APP_SOURCE, /if \(prev\) prev\.disabled = page <= 0 \|\| sessionSearchState\.loading;/);
  assert.match(APP_SOURCE, /prev\.dataset\.sessionPrev = "";/);
});

test("3. Next disabled on last page", () => {
  assert.match(APP_SOURCE, /if \(next\) next\.disabled = page >= totalPages - 1 \|\| sessionSearchState\.loading;/);
  assert.match(APP_SOURCE, /next\.dataset\.sessionNext = "";/);
});

test("4. Page indicator uses backend metadata", () => {
  assert.match(APP_SOURCE, /if \(indicator\) indicator\.textContent = "Page " \+ \(page \+ 1\) \+ " of " \+ totalPages;/);
  assert.match(APP_SOURCE, /sessionSearchState\.totalPages = normalized\.totalPages;/);
});

test("5. Total count uses totalElements", () => {
  assert.match(APP_SOURCE, /const total = sessionSearchState\.totalElements;/);
  assert.match(APP_SOURCE, /count\.textContent = "Showing " \+ start \+ "–" \+ end \+ " of " \+ totalElements \+ " sessions";/);
});

test("6. Next and Previous request correct pages", () => {
  assert.match(APP_SOURCE, /void loadSessions\(\{\s*page:\s*sessionSearchState\.page - 1\s*\}\);/);
  assert.match(APP_SOURCE, /void loadSessions\(\{\s*page:\s*sessionSearchState\.page \+ 1\s*\}\);/);
});

test("7. Filter change resets page to zero", () => {
  assert.match(APP_SOURCE, /event\.target\.id === "index-range"[\s\S]*?void loadSessions\(\{\s*page:\s*0,\s*resetFallback:\s*true\s*\}\);/);
  assert.match(APP_SOURCE, /searchForm\.addEventListener\("submit"[\s\S]*?void loadSessions\(\{\s*page:\s*0,\s*resetFallback:\s*true\s*\}\);/);
});

test("8. Filters persist while paging", () => {
  assert.match(APP_SOURCE, /const filters = currentFilters\(\);/);
  assert.match(APP_SOURCE, /\.\.\.filters,\s*date:\s*"",\s*from:\s*range\.from,\s*to:\s*range\.to,\s*page:\s*sessionSearchState\.page/);
});

test("9. Loading state", () => {
  assert.match(APP_SOURCE, /sessionSearchState\.loading = true;/);
  assert.match(APP_SOURCE, /status\.textContent = "Loading available sessions…";/);
});

test("10. Empty state", () => {
  assert.match(APP_SOURCE, /No sessions match these filters\. Try another doctor, specialisation or date\./);
});

test("11. Error and retry state", () => {
  assert.match(APP_SOURCE, /if \(heading\) heading\.textContent = "Sessions unavailable";/);
  assert.match(APP_SOURCE, /retryBtn\.dataset\.sessionRetry = "";/);
  assert.match(APP_SOURCE, /void loadSessions\(\{\s*page:\s*sessionSearchState\.page\s*\}\);/);
});

test("12. No client-side slicing", () => {
  assert.doesNotMatch(APP_SOURCE, /allUpcoming\.slice\(0, 120\)/);
  assert.doesNotMatch(APP_SOURCE, /state\.sessions\.slice\(/);
});

test("13. No duplicate session cards", () => {
  assert.match(APP_SOURCE, /list\.replaceChildren\(\);/);
});

test("14. Stale response cannot replace newer search results", () => {
  assert.match(APP_SOURCE, /const requestToken = \+\+sessionSearchState\.requestToken;/);
  assert.match(APP_SOURCE, /if \(requestToken !== sessionSearchState\.requestToken\) return;/);
});

test("15. Rapid filter changes are controlled", () => {
  assert.match(APP_SOURCE, /sessionSearchState\.debounceTimer = setTimeout/);
});

// ---------------------------------------------------------------------------
// Selected-session persistence tests
// ---------------------------------------------------------------------------

test("16. Selecting a session stores the exact session ID", () => {
  assert.match(APP_SOURCE, /state\.selectedSession = session;/);
  assert.match(APP_SOURCE, /state\.selectedSessionId = session\.sessionId \|\| null;/);
  assert.match(APP_SOURCE, /MC\.bookAppointment\(\s*(?:session\.sessionId|selectedSessionId),/);
  assert.match(APP_SOURCE, /MC\.session\(intent\.sessionId\)/);
});

test("17. Page changes do not clear or switch selected session", () => {
  // The loadSessions function must never assign state.selectedSession or
  // call selectSession — the selection is independent of search pages.
  const start = APP_SOURCE.indexOf("async function loadSessions");
  const end = APP_SOURCE.indexOf("function syncSummaryNotification", start);
  const block = APP_SOURCE.slice(start, end);
  assert.doesNotMatch(block, /state\.selectedSession\s*=/);
  assert.doesNotMatch(block, /selectSession\(/);
  assert.doesNotMatch(block, /clearBookingPanel\(\)/);
});

test("18. Successful booking refreshes availability", () => {
  assert.match(APP_SOURCE, /loadSessions\(\{\s*page:\s*sessionSearchState\.page\s*\}\)/);
});

test("19. Duplicate submission is prevented", () => {
  assert.match(APP_SOURCE, /if \(button\) button\.disabled = true;/);
});

test("20. Full session becomes unavailable after final booking", () => {
  assert.match(APP_SOURCE, /const full = liveRemaining <= 0;/);
  assert.match(APP_SOURCE, /book\.disabled = !available \|\| full \|\| closed \|\| breakNow;/);
});

test("21. Login and Register remain visible during backend wake-up", () => {
  assert.match(HTML_SOURCE, /data-view="login"/);
  assert.match(HTML_SOURCE, /data-view="register"/);
  assert.match(HTML_SOURCE, /id="backend-wake-status"/);
});

test("22. Batch 5 dropdown behavior remains intact", () => {
  assert.match(APP_SOURCE, /let searchSelectPanel = null;/);
  assert.match(HTML_SOURCE, /<a href="#notices" data-roles="CUSTOMER GUEST"/);
});

test("23. Patient, doctor, feedback and notice pagination remain intact", () => {
  assert.match(HTML_SOURCE, /data-appointments-pagination/);
  assert.match(HTML_SOURCE, /data-doctor-history-prev/);
  assert.match(HTML_SOURCE, /data-manager-reviews-prev/);
  assert.match(APP_SOURCE, /data-manager-notices-pagination|managerNoticesPagination/);
});

test("24. Existing booking-flow markup and controls remain functional", () => {
  assert.match(HTML_SOURCE, /data-booking-form/);
  assert.match(HTML_SOURCE, /data-booking-confirm/);
  assert.match(HTML_SOURCE, /data-booking-success/);
});

// ---------------------------------------------------------------------------
// New: Selected-session persistence across pagination and filters
// ---------------------------------------------------------------------------

test("25. Moving to page 1 does not clear selected session", () => {
  // The Previous/Next button handlers only call loadSessions with a page
  // number. They must not touch state.selectedSession.
  const prevHandler = APP_SOURCE.match(
    /prev\.addEventListener\("click",\s*\(\)\s*=>\s*\{[^}]+\}/
  );
  assert.ok(prevHandler, "Previous click handler exists");
  assert.doesNotMatch(prevHandler[0], /selectedSession/);
  assert.doesNotMatch(prevHandler[0], /clearBookingPanel/);

  const nextHandler = APP_SOURCE.match(
    /next\.addEventListener\("click",\s*\(\)\s*=>\s*\{[\s\S]*?if\s*\([^)]+\)\s*\{[^}]+\}/
  );
  assert.ok(nextHandler, "Next click handler exists");
  assert.doesNotMatch(nextHandler[0], /selectedSession/);
  assert.doesNotMatch(nextHandler[0], /clearBookingPanel/);
});

test("26. Filter dropdown changes do not clear selected session", () => {
  // The change handler for index-range, index-sp, index-dt, index-ty must
  // call loadSessions without touching state.selectedSession.
  const changeBlock = APP_SOURCE.match(
    /event\.target\.id === "index-range"[\s\S]*?void loadSessions\(\{\s*page:\s*0,\s*resetFallback:\s*true\s*\}\);\s*\n\s*return;/
  );
  assert.ok(changeBlock, "Filter change handler exists");
  assert.doesNotMatch(changeBlock[0], /selectedSession/);
  assert.doesNotMatch(changeBlock[0], /clearBookingPanel/);
});

test("27. Search form submit does not clear selected session", () => {
  const submitBlock = APP_SOURCE.match(
    /searchForm\.addEventListener\("submit",\s*\(event\)\s*=>\s*\{[\s\S]*?void loadSessions\(\{[\s\S]*?\}\);\s*\n\s*\}\)/
  );
  assert.ok(submitBlock, "Search submit handler exists");
  assert.doesNotMatch(submitBlock[0], /selectedSession/);
  assert.doesNotMatch(submitBlock[0], /clearBookingPanel/);
});

test("28. Stale response does not replace selected session", () => {
  // The stale-response guard returns early without touching selectedSession.
  const staleGuard = APP_SOURCE.match(
    /if \(requestToken !== sessionSearchState\.requestToken\) return;/
  );
  assert.ok(staleGuard, "Stale response guard exists");

  // Confirm loadSessions body never assigns state.selectedSession
  const start = APP_SOURCE.indexOf("async function loadSessions");
  const end = APP_SOURCE.indexOf("function syncSummaryNotification", start);
  const block = APP_SOURCE.slice(start, end);
  assert.doesNotMatch(block, /state\.selectedSession\s*=/);
});

test("29. Retry does not clear selected session", () => {
  const retryHandler = APP_SOURCE.match(
    /retryBtn\.addEventListener\("click",\s*\(\)\s*=>\s*\{[^}]+\}/
  );
  assert.ok(retryHandler, "Retry click handler exists");
  assert.doesNotMatch(retryHandler[0], /selectedSession/);
  assert.doesNotMatch(retryHandler[0], /clearBookingPanel/);
});

test("30. Booking form displays selected session details", () => {
  // selectSession writes title, meta, form visibility, date, period
  assert.match(APP_SOURCE, /title\.textContent = "Book: " \+ doctorName\(session\)/);
  assert.match(APP_SOURCE, /formatDate\(session\.sessionDate\)/);
  assert.match(APP_SOURCE, /sessionWindowLabel\(session\)/);
  assert.match(APP_SOURCE, /money\(session\.feeLkr\)/);
  assert.match(APP_SOURCE, /session\.consultationType === "ONLINE" \? "Online" : "Physical"/);
});

test("31. Booking submits the exact selected session ID", () => {
  assert.match(APP_SOURCE, /MC\.bookAppointment\(\s*(?:session\.sessionId|selectedSessionId),\s*reason,\s*period\s*\)/);
  // session comes from state.selectedSession, not from the visible list
  assert.match(APP_SOURCE, /const session = state\.selectedSession;/);
});

test("32. First visible session is never automatically selected", () => {
  // loadSessions and renderSessions must not auto-select sessions[0]
  assert.doesNotMatch(APP_SOURCE, /state\.sessions\[0\]/);
  assert.doesNotMatch(APP_SOURCE, /sessions\[0\][\s\S]*?selectSession/);
  // The only place selectSession is called on click is the [data-book-session] handler
  const autoSelect = APP_SOURCE.match(
    /renderSessions[\s\S]*?selectSession\(sessions\[0\]\)/
  );
  assert.equal(autoSelect, null, "No auto-selection of first session");
});

test("33. Pre-booking revalidation fetches exact session via MC.session", () => {
  // confirmBooking must call MC.session(selectedSessionId) before booking
  const confirmBlock = APP_SOURCE.match(
    /async function confirmBooking\(\)[\s\S]*?MC\.bookAppointment\(/
  );
  assert.ok(confirmBlock, "confirmBooking function exists before bookAppointment call");
  assert.match(confirmBlock[0], /MC\.session\((?:session\.sessionId|selectedSessionId)\)/);
});

test("34. If revalidation says session is full, booking is disabled with clear message", () => {
  assert.match(
    APP_SOURCE,
    /This session is now fully booked\. No spots remain\. Please choose another session\./
  );
  // After showing the message, keepBookingDisabled = true disables the button and page is refreshed
  assert.match(APP_SOURCE, /keepBookingDisabled = true;\s*\n\s*void loadSessions/);
});

test("35. If revalidation says session is unavailable, booking is disabled with clear message", () => {
  assert.match(
    APP_SOURCE,
    /This session is no longer available \(status:/
  );
});

test("36. If revalidation says session no longer exists (404), booking is blocked", () => {
  assert.match(
    APP_SOURCE,
    /This session no longer exists\. Please choose another session\./
  );
  assert.match(APP_SOURCE, /revalidateError\.status === 404/);
});

test("37. If revalidation says booking closed, booking is blocked with clear message", () => {
  assert.match(
    APP_SOURCE,
    /Booking has now closed for this session\. Please choose another session\./
  );
  // bookingClosed(freshSession) is called on the revalidated session
  assert.match(APP_SOURCE, /bookingClosed\(freshSession\)/);
});

test("38. Revalidation updates capacity on stored session without replacing it", () => {
  // The fresh data updates the existing session object in-place
  assert.match(APP_SOURCE, /session\.remainingAppointments = freshSession\.remainingAppointments;/);
  assert.match(APP_SOURCE, /session\.status = freshSession\.status;/);
  // state.selectedSession is never reassigned during revalidation
  const revalBlock = APP_SOURCE.match(
    /Exact-session revalidation MUST succeed[\s\S]*?MC\.bookAppointment\(/
  );
  assert.ok(revalBlock, "Revalidation block exists");
  assert.doesNotMatch(revalBlock[0], /state\.selectedSession\s*=/);
});

test("39. Explicit cancellation clears the selected session", () => {
  // clearBookingPanel sets state.selectedSession = null
  assert.match(APP_SOURCE, /function clearBookingPanel\(\)/);
  const clearBlock = APP_SOURCE.match(
    /function clearBookingPanel\(\)[\s\S]*?state\.selectedSession = null/
  );
  assert.ok(clearBlock, "clearBookingPanel sets selectedSession to null");
});

test("40. No unbounded MC.sessions fallback is introduced", () => {
  // The only reference to MC.sessions in loadSessions is the type-guard
  // fallback which never executes because MC.searchSessions is defined.
  assert.match(API_SOURCE, /searchSessions\(filters\)/);
  // Confirm MC.sessions is only used as a typeof fallback, not as a primary call
  const loadBlock = APP_SOURCE.match(
    /async function loadSessions[\s\S]*?function (?:syncSummaryNotification|bookableSessions)/
  );
  assert.ok(loadBlock, "loadSessions block found");
  const sessionsRefs = loadBlock[0].match(/MC\.sessions\(/g);
  // At most one reference (the typeof fallback)
  assert.ok(
    !sessionsRefs || sessionsRefs.length <= 1,
    "MC.sessions is used at most once (typeof fallback)"
  );
});

test("41. Debounced text input does not clear selected session", () => {
  const debounceBlock = APP_SOURCE.match(
    /searchQueryInput\.addEventListener\("input",\s*\(\)\s*=>\s*\{[\s\S]*?void loadSessions\(\{[\s\S]*?\}\);\s*\n\s*\},\s*\d+\);/
  );
  assert.ok(debounceBlock, "Debounced input handler exists");
  assert.doesNotMatch(debounceBlock[0], /selectedSession/);
  assert.doesNotMatch(debounceBlock[0], /clearBookingPanel/);
});

// ---------------------------------------------------------------------------
// Executable runtime tests for revalidation & selected-session persistence
// ---------------------------------------------------------------------------

import vm from "node:vm";

function createElement(tag, id = "") {
  const attrs = new Map();
  const listeners = new Map();
  const classes = new Set();
  const el = {
    tagName: tag.toUpperCase(),
    id,
    value: "",
    textContent: "",
    hidden: false,
    disabled: false,
    type: "",
    style: {},
    dataset: {},
    children: [],
    parentNode: null,
    firstChild: null,
    classList: {
      add: (...c) => c.forEach((x) => classes.add(x)),
      remove: (...c) => c.forEach((x) => classes.delete(x)),
      contains: (c) => classes.has(c),
      toggle: (c, f) => (f === undefined ? (classes.has(c) ? classes.delete(c) : classes.add(c)) : f ? classes.add(c) : classes.delete(c)),
    },
    setAttribute: (k, v) => attrs.set(k, String(v)),
    getAttribute: (k) => (attrs.has(k) ? attrs.get(k) : null),
    removeAttribute: (k) => attrs.delete(k),
    hasAttribute: (k) => attrs.has(k),
    addEventListener: (type, fn) => {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    removeEventListener: () => {},
    dispatchEvent: async (evt) => {
      const fns = listeners.get(evt.type) || [];
      for (const fn of fns) {
        await fn(evt);
      }
    },
    append: (...nodes) => {
      nodes.forEach((n) => {
        if (n && typeof n === "object") {
          n.parentNode = el;
          el.children.push(n);
        }
      });
      el.firstChild = el.children[0] || null;
    },
    appendChild: (n) => {
      el.append(n);
      return n;
    },
    replaceChildren: (...nodes) => {
      el.children = [];
      el.append(...nodes);
    },
    insertBefore: (n) => {
      el.append(n);
    },
    removeChild: () => {},
    querySelector: () => null,
    querySelectorAll: () => [],
    closest: () => null,
    focus: () => {},
    scrollIntoView: () => {},
  };
  return el;
}

function setupAppHarness(mcOverrides = {}) {
  const byId = new Map();
  const bySelector = new Map();
  const docListeners = new Map();

  const registerId = (id, tag = "div") => {
    const el = createElement(tag, id);
    byId.set(id, el);
    return el;
  };
  const registerSel = (sel, tag = "div") => {
    const el = createElement(tag);
    bySelector.set(sel, el);
    return el;
  };

  // Booking panel elements
  const bookingTitle = registerSel("[data-booking-title]", "h2");
  const bookingMeta = registerSel("[data-booking-meta]", "p");
  const bookingForm = registerSel("[data-booking-form]", "form");
  bookingForm.hidden = true;
  const bookingSuccess = registerSel("[data-booking-success]", "div");
  bookingSuccess.hidden = true;
  registerSel("[data-booking-note]", "p");
  const bookingError = registerSel("[data-booking-error]", "p");
  bookingError.hidden = true;
  const bookingConfirm = registerSel("[data-booking-confirm]", "button");
  const bookingRef = registerSel("[data-booking-reference]", "span");
  const bookingDateConf = registerSel("[data-booking-date-confirmed]", "span");
  const bookingNumber = registerSel("[data-booking-number]", "span");
  const bookingCreated = registerSel("[data-booking-created]", "span");
  const bookingEstimate = registerSel("[data-booking-estimate]", "span");
  const bookingSlot = registerSel("[data-booking-slot]", "span");
  const bookingMsg = registerSel("[data-booking-message]", "p");
  const bookingPay = registerSel("[data-booking-pay]", "button");
  const bookingGoto = registerSel("[data-booking-goto]", "button");
  registerSel("[data-session-list]", "div");
  registerSel("[data-session-status]", "p");
  registerSel("[data-session-heading]", "p");

  const reasonInput = registerId("index-rs", "input");
  const bookingDateInput = registerId("booking-date", "input");
  const periodInput = registerId("index-bp", "select");
  registerId("index-q", "input");
  registerId("index-sp", "select");
  registerId("index-dt", "input");
  registerId("index-ty", "select");
  registerId("index-range", "select");

  const body = createElement("body");
  const head = createElement("head");

  const document = {
    body,
    head,
    visibilityState: "visible",
    getElementById: (id) => byId.get(id) || null,
    querySelector: (sel) => bySelector.get(sel) || null,
    querySelectorAll: () => [],
    createElement: (tag) => createElement(tag),
    createTextNode: (t) => ({ textContent: String(t) }),
    addEventListener: (type, fn) => {
      if (!docListeners.has(type)) docListeners.set(type, []);
      docListeners.get(type).push(fn);
    },
  };

  const sessionA = {
    sessionId: "sess-A",
    doctorId: "doc-1",
    doctorName: "Dr. Silva",
    specialisationName: "Cardiology",
    sessionDate: "2099-05-10",
    startTime: "07:00:00",
    endTime: "11:00:00",
    consultationType: "PHYSICAL",
    roomNumber: "101",
    feeLkr: 2500,
    status: "OPEN",
    remainingAppointments: 5,
    maxAppointments: 30,
  };

  const sessionB = {
    sessionId: "sess-B",
    doctorId: "doc-2",
    doctorName: "Dr. Perera",
    specialisationName: "Neurology",
    sessionDate: "2099-05-11",
    startTime: "13:00:00",
    endTime: "15:00:00",
    consultationType: "ONLINE",
    feeLkr: 3000,
    status: "OPEN",
    remainingAppointments: 8,
    maxAppointments: 30,
  };

  const calls = {
    session: [],
    bookAppointment: [],
    searchSessions: [],
    sessions: [],
  };

  const MC = {
    me: async () => ({ id: "user-1", role: "CUSTOMER", email: "patient@test.lk" }),
    specialisations: async () => [],
    notices: async () => [],
    publicDoctors: async () => [],
    appointments: async () => [],
    activeAppointments: async () => [],
    appointmentHistory: async () => ({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 1 }),
    notifications: async () => [],
    searchSessions: async (filters) => {
      calls.searchSessions.push(filters);
      return {
        content: filters && filters.page === 1 ? [sessionB] : [sessionA],
        page: filters && typeof filters.page === "number" ? filters.page : 0,
        size: 12,
        totalElements: 13,
        totalPages: 2,
      };
    },
    sessions: async (filters) => {
      calls.sessions.push(filters);
      return [sessionA];
    },
    session: async (id) => {
      calls.session.push(id);
      if (mcOverrides.session) return mcOverrides.session(id);
      return { ...sessionA };
    },
    bookAppointment: async (sessionId, reason, period) => {
      calls.bookAppointment.push({ sessionId, reason, period });
      if (mcOverrides.bookAppointment) {
        return mcOverrides.bookAppointment(sessionId, reason, period);
      }
      return {
        appointmentId: "appt-1",
        bookingReference: "MC-1001",
        sessionDate: sessionA.sessionDate,
        appointmentNumber: 1,
        paymentStatus: "UNPAID",
      };
    },
  };

  const store = new Map([
    ["mc_tab_token", "test-token"],
    ["mc_tab_user", JSON.stringify({ id: "user-1", role: "CUSTOMER", email: "patient@test.lk" })],
  ]);

  const sandbox = {
    console,
    Date,
    Math,
    JSON,
    Intl,
    Map,
    Set,
    Array,
    Object,
    Number,
    String,
    Boolean,
    Error,
    Promise,
    URL,
    URLSearchParams,
    setTimeout: (fn) => {
      if (typeof fn === "function") fn();
      return 1;
    },
    clearTimeout: () => {},
    setInterval: () => 1,
    clearInterval: () => {},
    history: { scrollRestoration: "manual", replaceState: () => {} },
    location: { hash: "#index", pathname: "/", search: "" },
    navigator: { onLine: true },
    sessionStorage: {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
    localStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    },
    fetch: async () => ({ ok: true, json: async () => ({}) }),
    document,
    MC,
    matchMedia: () => ({ matches: false, addEventListener: () => {} }),
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
    addEventListener: () => {},
    scrollTo: () => {},
  };
  sandbox.window = sandbox;

  // Expose internal state/functions for deterministic unit testing
  const instrumentedSource = APP_SOURCE.replace(
    /\}\)\(\);\s*$/,
    `  window.__TEST__ = { state, sessionSearchState, setSession, selectSession, clearBookingPanel, applyBookingDate, confirmBooking, loadSessions };
})();`
  );

  vm.createContext(sandbox);
  vm.runInContext(instrumentedSource, sandbox, { filename: "mediclinic-app.js" });
  sandbox.__TEST__.setSession(
    { id: "user-1", role: "CUSTOMER", email: "patient@test.lk" },
    "test-token"
  );

  return {
    T: sandbox.__TEST__,
    MC,
    calls,
    sessionA,
    sessionB,
    docListeners,
    els: {
      bookingTitle,
      bookingMeta,
      bookingForm,
      bookingSuccess,
      bookingError,
      bookingConfirm,
      reasonInput,
      bookingDateInput,
      periodInput,
      bookingRef,
      bookingDateConf,
      bookingNumber,
      bookingCreated,
      bookingEstimate,
      bookingSlot,
      bookingMsg,
      bookingPay,
      bookingGoto,
    },
  };
}

test("EXEC 1. HTTP 500 during MC.session revalidation does not call MC.bookAppointment", async () => {
  const err = new Error("Internal server error");
  err.status = 500;
  const h = setupAppHarness({
    session: async () => {
      throw err;
    },
  });
  h.T.selectSession(h.sessionA);
  h.els.reasonInput.value = "Routine checkup";

  await h.T.confirmBooking();

  assert.equal(h.calls.session.length, 1);
  assert.equal(h.calls.bookAppointment.length, 0);
  assert.equal(h.els.bookingError.hidden, false);
  assert.match(h.els.bookingError.textContent, /could not confirm/i);
  assert.equal(h.T.state.selectedSession.sessionId, "sess-A");
  assert.equal(h.T.state.selectedSessionId, "sess-A");
  assert.equal(h.els.bookingForm.hidden, false);
  assert.equal(h.els.bookingConfirm.disabled, false);
});

test("EXEC 2. Timeout during MC.session revalidation does not call MC.bookAppointment", async () => {
  const timeoutErr = new Error("The operation timed out.");
  timeoutErr.name = "TimeoutError";
  const h = setupAppHarness({
    session: async () => {
      throw timeoutErr;
    },
  });
  h.T.selectSession(h.sessionA);
  h.els.reasonInput.value = "Routine checkup";

  await h.T.confirmBooking();

  assert.equal(h.calls.session.length, 1);
  assert.equal(h.calls.bookAppointment.length, 0);
  assert.equal(h.els.bookingError.hidden, false);
  assert.equal(h.T.state.selectedSessionId, "sess-A");
  assert.equal(h.els.bookingForm.hidden, false);
  assert.equal(h.els.bookingConfirm.disabled, false);
});

test("EXEC 3. Offline/network failure during MC.session revalidation does not call MC.bookAppointment", async () => {
  const netErr = new TypeError("Failed to fetch");
  const h = setupAppHarness({
    session: async () => {
      throw netErr;
    },
  });
  h.T.selectSession(h.sessionA);
  h.els.reasonInput.value = "Routine checkup";

  await h.T.confirmBooking();

  assert.equal(h.calls.session.length, 1);
  assert.equal(h.calls.bookAppointment.length, 0);
  assert.equal(h.els.bookingError.hidden, false);
  assert.equal(h.T.state.selectedSession.sessionId, "sess-A");
  assert.equal(h.els.bookingForm.hidden, false);
  assert.equal(h.els.bookingConfirm.disabled, false);
});

test("EXEC 4-7. Retry after transient revalidation failure revalidates again and books once", async () => {
  let attempt = 0;
  const err500 = new Error("Server error");
  err500.status = 500;
  const h = setupAppHarness({
    session: async () => {
      attempt += 1;
      if (attempt === 1) throw err500;
      return { ...h.sessionA, remainingAppointments: 4, status: "OPEN" };
    },
  });
  h.T.selectSession(h.sessionA);
  h.els.reasonInput.value = "Routine checkup";

  await h.T.confirmBooking();
  assert.equal(h.calls.session.length, 1);
  assert.equal(h.calls.bookAppointment.length, 0);
  assert.equal(h.els.bookingConfirm.disabled, false);
  assert.equal(h.T.state.selectedSessionId, "sess-A");

  await h.T.confirmBooking();
  assert.equal(h.calls.session.length, 2);
  assert.equal(h.calls.bookAppointment.length, 1);
  assert.equal(h.calls.bookAppointment[0].sessionId, "sess-A");
});

test("EXEC 8. HTTP 404 during revalidation preserves identity, disables booking, and shows message", async () => {
  const err404 = new Error("Not found");
  err404.status = 404;
  const h = setupAppHarness({
    session: async () => {
      throw err404;
    },
  });
  h.T.selectSession(h.sessionA);
  h.els.reasonInput.value = "Routine checkup";

  await h.T.confirmBooking();

  assert.equal(h.calls.bookAppointment.length, 0);
  assert.equal(h.T.state.selectedSessionId, "sess-A");
  assert.equal(h.T.state.selectedSession.status, "UNAVAILABLE");
  assert.equal(h.els.bookingConfirm.disabled, true);
  assert.match(h.els.bookingError.textContent, /no longer exists/i);
});

test("EXEC 9. Changing booking date does not clear selected session", async () => {
  const h = setupAppHarness();
  h.T.selectSession(h.sessionA);

  h.T.applyBookingDate("2099-05-12");

  assert.equal(h.T.state.selectedSession.sessionId, "sess-A");
  assert.equal(h.T.state.selectedSessionId, "sess-A");
  assert.equal(h.els.bookingTitle.textContent, "Book: Dr. Silva");
  assert.equal(h.els.bookingForm.hidden, false);
});

test("EXEC 10. Changing other filters and pages does not clear selected session or substitute first visible", async () => {
  const h = setupAppHarness();
  h.T.selectSession(h.sessionA);

  await h.T.loadSessions({ page: 1 });
  assert.equal(h.T.state.sessions[0].sessionId, "sess-B");
  assert.equal(h.T.state.selectedSession.sessionId, "sess-A");
  assert.equal(h.T.state.selectedSessionId, "sess-A");
  assert.equal(h.els.bookingTitle.textContent, "Book: Dr. Silva");

  // Simulate filter change events
  for (const id of ["index-range", "index-sp", "index-dt", "index-ty"]) {
    const handlers = h.docListeners.get("change") || [];
    for (const fn of handlers) {
      await fn({ target: { id, value: "" } });
    }
  }
  assert.equal(h.T.state.selectedSession.sessionId, "sess-A");
  assert.equal(h.T.state.selectedSessionId, "sess-A");
  assert.equal(h.calls.sessions.length, 0, "No unbounded MC.sessions fallback called");
});

test("EXEC 11. Explicit clearBookingPanel clears selected session", () => {
  const h = setupAppHarness();
  h.T.selectSession(h.sessionA);
  assert.equal(h.T.state.selectedSessionId, "sess-A");

  h.T.clearBookingPanel();
  assert.equal(h.T.state.selectedSession, null);
  assert.equal(h.T.state.selectedSessionId, null);
  assert.equal(h.els.bookingForm.hidden, true);
});
