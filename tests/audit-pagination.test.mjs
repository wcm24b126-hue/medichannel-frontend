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

function loadApi(options = {}) {
  const calls = [];
  const sandbox = {
    Headers,
    FormData,
    URLSearchParams,
    AbortSignal,
    JSON,
    console,
    navigator: { onLine: true },
    sessionStorage: { getItem: () => null },
    fetch: async (url, settings = {}) => {
      calls.push({ url, settings });
      if (options.fetchImpl) return options.fetchImpl(url, settings);
      return new Response(
        JSON.stringify({ content: [], totalElements: 0, totalPages: 0 }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    },
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(API_SOURCE, sandbox, { filename: "mediclinic-api.js" });
  return { MC: sandbox.MC, calls };
}

function createAuditHarness({ role = "ADMIN", auditLogsImpl } = {}) {
  const start = APP_SOURCE.indexOf("  const auditLogState = {");
  const end = APP_SOURCE.indexOf("  const ROLE_LABELS = {");
  assert.ok(start > -1 && end > start, "Audit log section not found");
  const auditSection = APP_SOURCE.slice(start, end);

  const loadOnceStart = APP_SOURCE.indexOf("  const activeLoaders = new Set();");
  const loadOnceEnd = APP_SOURCE.indexOf("  let welcomeEntrancePlayed = false;");
  assert.ok(loadOnceStart > -1 && loadOnceEnd > loadOnceStart, "loadOnce not found");
  const loadOnceSection = APP_SOURCE.slice(loadOnceStart, loadOnceEnd);

  const tbody = {
    children: [],
    innerHTML: "",
    replaceChildren() {
      this.children = [];
      this.innerHTML = "";
    },
    append(el) {
      this.children.push(el);
    },
    prepend() {
      throw new Error("tbody.prepend must not be called");
    },
    querySelector() {
      return null;
    },
  };
  const pageInfo = { textContent: "" };
  const prevBtn = { disabled: true };
  const nextBtn = { disabled: true };

  const subscriptions = new Map();
  const apiCalls = [];

  const sandbox = {
    S: role ? { role } : null,
    console: { warn: () => {} },
    escapeHtml: (v) => String(v ?? ""),
    renderAuditLogRow: (log) => ({ tagName: "TR", log }),
    setTimeout,
    clearTimeout,
    Set,
    Promise,
    Math,
    Array,
    Object,
    String,
    Boolean,
    document: {
      querySelector(sel) {
        if (sel === "[data-admin-audit-tbody]") return tbody;
        if (sel === "[data-audit-page-info]") return pageInfo;
        if (sel === "[data-audit-prev]") return prevBtn;
        if (sel === "[data-audit-next]") return nextBtn;
        return null;
      },
    },
    subscribe(name, topic, handler) {
      subscriptions.set(topic, { name, handler });
    },
    MC: {
      async auditLogs(params) {
        apiCalls.push(params);
        return auditLogsImpl(params);
      },
    },
  };

  vm.createContext(sandbox);
  vm.runInContext(
    `${loadOnceSection}\n${auditSection}\nthis.__test = { auditLogState, subscribeAdminAuditLogs, loadAuditLogs, loadOnce, scheduleAuditLogReload, activeLoaders };`,
    sandbox
  );

  return {
    ...sandbox.__test,
    tbody,
    pageInfo,
    prevBtn,
    nextBtn,
    subscriptions,
    apiCalls,
    setRole(newRole) {
      sandbox.S = newRole ? { role: newRole } : null;
    },
  };
}

test("1. API client auditLogs constructs paginated query parameters", async () => {
  const { MC, calls } = loadApi();

  await MC.auditLogs();
  assert.equal(calls[0].url, "/api/backend/audit-logs");

  await MC.auditLogs({ page: 0, size: 20 });
  assert.equal(calls[1].url, "/api/backend/audit-logs?page=0&size=20");

  await MC.auditLogs({ page: 2, size: 15, userId: "user-abc-123" });
  assert.equal(
    calls[2].url,
    "/api/backend/audit-logs?page=2&size=15&userId=user-abc-123"
  );
});

test("2. HTML markup contains audit pagination elements and boundary-disabled controls", () => {
  assert.match(HTML_SOURCE, /data-audit-pagination/);
  assert.match(HTML_SOURCE, /data-audit-page-info/);
  assert.match(HTML_SOURCE, /data-audit-prev[^>]*disabled/);
  assert.match(HTML_SOURCE, /data-audit-next[^>]*disabled/);
  assert.match(HTML_SOURCE, /data-admin-audit-tbody/);
});

test("3. WebSocket events are never directly prepended into DOM", () => {
  const subStart = APP_SOURCE.indexOf("function subscribeAdminAuditLogs(");
  const subEnd = APP_SOURCE.indexOf("function applyAuditLogsResponse(");
  const subSource = APP_SOURCE.slice(subStart, subEnd);

  assert.doesNotMatch(subSource, /tbody\.prepend/);
  assert.doesNotMatch(subSource, /renderAuditLogRow/);
  assert.match(subSource, /scheduleAuditLogReload\(\)/);
});

test("4. WebSocket event resets page to 0, triggers controlled reload, and updates metadata", async () => {
  let fetchCount = 0;
  const h = createAuditHarness({
    auditLogsImpl: async (params) => {
      fetchCount += 1;
      if (fetchCount === 1) {
        return {
          content: [{ id: "old-1", userId: "u1", action: "A1" }],
          page: 1,
          size: 20,
          totalElements: 21,
          totalPages: 2,
          first: false,
          last: true,
        };
      }
      return {
        content: [
          { id: "new-2", userId: "u1", action: "A2" },
          { id: "new-1", userId: "u1", action: "A1" },
        ],
        page: params.page,
        size: 20,
        totalElements: 22,
        totalPages: 2,
        first: true,
        last: false,
      };
    },
  });

  await h.loadAuditLogs({ page: 1 });
  assert.equal(h.auditLogState.page, 1);
  assert.equal(h.pageInfo.textContent, "Page 2 of 2 (21 total)");

  h.subscribeAdminAuditLogs();
  const sub = h.subscriptions.get("/topic/audit-logs");
  assert.ok(sub, "ADMIN must subscribe to /topic/audit-logs");

  sub.handler({ id: "new-2", userId: "u1", action: "A2" });
  assert.equal(h.auditLogState.page, 0);

  await new Promise((r) => setTimeout(r, 220));
  assert.equal(h.apiCalls.length, 2);
  assert.equal(h.apiCalls[1].page, 0);
  assert.equal(h.auditLogState.totalElements, 22);
  assert.equal(h.auditLogState.totalPages, 2);
  assert.equal(h.pageInfo.textContent, "Page 1 of 2 (22 total)");
  assert.equal(h.tbody.children.length, 2);
  assert.equal(h.tbody.children[0].log.id, "new-2");
});

test("5. Active userId filter is preserved across WebSocket reload and mismatched events are ignored", async () => {
  const targetUser = "11111111-1111-1111-1111-111111111111";
  const otherUser = "22222222-2222-2222-2222-222222222222";
  const h = createAuditHarness({
    auditLogsImpl: async () => ({
      content: [{ id: "f1", userId: targetUser, action: "LOGIN" }],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
      first: true,
      last: true,
    }),
  });

  await h.loadAuditLogs({ page: 2, userId: targetUser });
  assert.equal(h.auditLogState.page, 0, "filter change resets page to 0");
  assert.equal(h.apiCalls[0].userId, targetUser);

  h.subscribeAdminAuditLogs();
  const sub = h.subscriptions.get("/topic/audit-logs");

  // Event for another user must not trigger reload or show in filtered view
  sub.handler({ id: "other", userId: otherUser, action: "OTHER" });
  await new Promise((r) => setTimeout(r, 220));
  assert.equal(h.apiCalls.length, 1);

  // Matching user event reloads page 0 while preserving userId filter
  sub.handler({ id: "match", userId: targetUser, action: "UPDATE" });
  await new Promise((r) => setTimeout(r, 220));
  assert.equal(h.apiCalls.length, 2);
  assert.equal(h.apiCalls[1].page, 0);
  assert.equal(h.apiCalls[1].userId, targetUser);
});

test("6. Multiple rapid WebSocket events coalesce into a single reload without parallel requests", async () => {
  const h = createAuditHarness({
    auditLogsImpl: async () => ({
      content: [{ id: "1", userId: "u1", action: "BURST" }],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
      first: true,
      last: true,
    }),
  });

  h.subscribeAdminAuditLogs();
  const sub = h.subscriptions.get("/topic/audit-logs");

  sub.handler({ id: "e1", userId: "u1" });
  sub.handler({ id: "e2", userId: "u1" });
  sub.handler({ id: "e3", userId: "u1" });
  sub.handler({ id: "e4", userId: "u1" });

  await new Promise((r) => setTimeout(r, 220));
  assert.equal(h.apiCalls.length, 1);
});

test("7. Rendered row count never exceeds page size and produces no duplicates after refresh", async () => {
  const h = createAuditHarness({
    auditLogsImpl: async () => ({
      content: [
        { id: "a1", userId: "u1", action: "ACT_1" },
        { id: "a2", userId: "u1", action: "ACT_2" },
        { id: "a3", userId: "u1", action: "ACT_3" },
      ],
      page: 0,
      size: 2,
      totalElements: 3,
      totalPages: 2,
      first: true,
      last: false,
    }),
  });

  await h.loadAuditLogs({ page: 0, size: 2 });
  assert.equal(h.tbody.children.length, 2);
  const ids = h.tbody.children.map((r) => r.log.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("8. Non-ADMIN users do not subscribe or reload audit logs", async () => {
  const h = createAuditHarness({
    role: "MANAGER",
    auditLogsImpl: async () => ({ content: [] }),
  });

  h.subscribeAdminAuditLogs();
  assert.equal(h.subscriptions.size, 0);

  h.scheduleAuditLogReload();
  await new Promise((r) => setTimeout(r, 220));
  assert.equal(h.apiCalls.length, 0);
});

test("9. Previous and Next boundary conditions and empty state work accurately", async () => {
  const h = createAuditHarness({
    auditLogsImpl: async (params) => {
      if (params.page === 0) {
        return {
          content: [{ id: "p0", userId: "u1", action: "A0" }],
          page: 0,
          size: 20,
          totalElements: 25,
          totalPages: 2,
          first: true,
          last: false,
        };
      }
      return {
        content: [{ id: "p1", userId: "u1", action: "A1" }],
        page: 1,
        size: 20,
        totalElements: 25,
        totalPages: 2,
        first: false,
        last: true,
      };
    },
  });

  await h.loadAuditLogs({ page: 0 });
  assert.equal(h.prevBtn.disabled, true);
  assert.equal(h.nextBtn.disabled, false);

  await h.loadAuditLogs({ page: 1 });
  assert.equal(h.prevBtn.disabled, false);
  assert.equal(h.nextBtn.disabled, true);

  assert.match(
    APP_SOURCE,
    /event\.target\.closest\(["']\[data-audit-prev\]["']\)/
  );
  assert.match(
    APP_SOURCE,
    /event\.target\.closest\(["']\[data-audit-next\]["']\)/
  );
});

test("10. Server error displays escaped error row with retry button and retry reloads", async () => {
  let failOnce = true;
  const h = createAuditHarness({
    auditLogsImpl: async () => {
      if (failOnce) {
        failOnce = false;
        throw new Error("Service unavailable");
      }
      return {
        content: [],
        page: 0,
        size: 20,
        totalElements: 0,
        totalPages: 0,
        first: true,
        last: true,
      };
    },
  });

  await h.loadAuditLogs({ page: 0 });
  assert.match(h.tbody.innerHTML, /Failed to load audit logs: Service unavailable/);
  assert.match(h.tbody.innerHTML, /data-retry-audit/);

  await h.loadAuditLogs();
  assert.match(h.tbody.innerHTML, /No audit log entries recorded yet\./);
  assert.equal(h.prevBtn.disabled, true);
  assert.equal(h.nextBtn.disabled, true);
});

test("11. No clinical or medical information is rendered in audit log columns", () => {
  const auditRowRenderer = APP_SOURCE.slice(
    APP_SOURCE.indexOf("function renderAuditLogRow("),
    APP_SOURCE.indexOf("return tr;", APP_SOURCE.indexOf("function renderAuditLogRow(")) + 15
  );

  assert.ok(auditRowRenderer.length > 0, "renderAuditLogRow function not found");
  assert.doesNotMatch(auditRowRenderer, /log\.diagnosis/i);
  assert.doesNotMatch(auditRowRenderer, /log\.prescription/i);
  assert.doesNotMatch(auditRowRenderer, /log\.treatment/i);
  assert.doesNotMatch(auditRowRenderer, /log\.notes/i);
  assert.doesNotMatch(auditRowRenderer, /log\.symptoms/i);
  assert.doesNotMatch(auditRowRenderer, /log\.medicalRecord/i);
  assert.match(auditRowRenderer, /data-label="Time"/);
  assert.match(auditRowRenderer, /data-label="User ID"/);
  assert.match(auditRowRenderer, /data-label="Action"/);
  assert.match(auditRowRenderer, /data-label="Details"/);
  assert.match(auditRowRenderer, /data-label="IP"/);
});
