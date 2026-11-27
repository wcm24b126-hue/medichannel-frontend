import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) =>
  readFileSync(new URL("../" + path, import.meta.url), "utf8");

const HTML = read("public/mediclinic-system.html");
const APP = read("public/mediclinic-app.js");
const API = read("public/mediclinic-api.js");
const WAKE_ROUTE = read("src/app/api/backend/wake/route.ts");

test("1. Login is not hidden by the blocking overlay during backend wake-up", () => {
  // Login section must stay visible even when body has not reached data-app-ready
  assert.match(
    HTML,
    /body:not\(\[data-app-ready="true"\]\)>section\[data-view="login"\]/
  );
  assert.match(
    HTML,
    /section\[data-view="login"\].*?display:\s*block\s*!important/s
  );
  // Blocking overlay must be hidden when viewing login
  assert.match(
    HTML,
    /body\[data-active-view="login"\]>\.app-boot-screen/
  );
  assert.match(
    HTML,
    /body:has\(>section\[data-view="login"\]:not\(\[hidden\]\)\)>\.app-boot-screen/
  );
  // showView sets activeView and ensures boot screen does not trap aria focus
  assert.match(APP, /document\.body\.dataset\.activeView = targetId;/);
  assert.match(
    APP,
    /bootOverlay\.setAttribute\("aria-hidden", "true"\);/
  );
});

test("2. Register is not hidden by the blocking overlay", () => {
  // Register section must stay visible even when body has not reached data-app-ready
  assert.match(
    HTML,
    /body:not\(\[data-app-ready="true"\]\)>section\[data-view="register"\]/
  );
  assert.match(
    HTML,
    /section\[data-view="register"\].*?display:\s*block\s*!important/s
  );
  // Blocking overlay must be hidden when viewing register
  assert.match(
    HTML,
    /body\[data-active-view="register"\]>\.app-boot-screen/
  );
  assert.match(
    HTML,
    /body:has\(>section\[data-view="register"\]:not\(\[hidden\]\)\)>\.app-boot-screen/
  );
});

test("3. Backend-starting status appears when wake-up is pending", () => {
  // Non-blocking toast with polite live region
  assert.match(
    HTML,
    /<div id="backend-wake-status"[^>]*role="status"[^>]*aria-live="polite"/
  );
  assert.match(HTML, /data-wake-message/);
  assert.match(HTML, /data-wake-subtext/);

  // Status message content in mediclinic-app.js
  assert.match(
    APP,
    /const primaryMessage = "Backend is starting\. Please wait a moment\.";/
  );
  assert.match(
    APP,
    /const secondaryMessage =\s*"The free server may take a short time to wake up\.";/
  );
  assert.match(APP, /setWakeMessage\(primaryMessage, secondaryMessage, false\);/);
});

test("4. Duplicate notifications are not created", () => {
  // setWakeMessage guards against repeating identical messages to the live region
  assert.match(
    APP,
    /if \(currentWakeState\.message === message && currentWakeState\.isError === err\) \{\s*return;\s*\}/
  );
});

test("5. Status clears or changes when backend becomes ready", () => {
  // When response.ok is received, notification is dismissed immediately
  assert.match(
    APP,
    /if \(response\.ok\) \{\s*clearTimeout\(slow\);\s*setWakeMessage\(""\);\s*return true;\s*\}/
  );
  // setWakeMessage("") hides the element and clears currentWakeState
  assert.match(APP, /if \(!message\) \{\s*if \(currentWakeState\.message\) \{\s*status\.hidden = true;/);
});

test("6. Wake-up failure does not produce an endless blocking spinner", () => {
  // Wake-up failure surfaces a clear retryable error with the retry button
  assert.match(
    APP,
    /setWakeMessage\(\s*"Backend wake-up failed\. Please click Retry to try again\.",\s*"",\s*true\s*\);/
  );
  assert.match(APP, /return false;\s*\}\)\(\)\.finally/);
  // Retry button is revealed upon error
  assert.match(APP, /retryBtn\.hidden = !err;/);
  // The boot screen is hidden when app is ready or when on login/register views
  assert.match(HTML, /body\[data-app-ready="true"\]>\.app-boot-screen/);
});

test("7. Login and Register still submit normally", () => {
  // Form submission handlers disable the submit button with meaningful status text
  assert.match(APP, /button\.textContent = "Logging in…";/);
  assert.match(APP, /button\.textContent = "Creating account…";/);
  // Wait or retry wake if backend is starting
  assert.match(APP, /button\.textContent = "Starting backend…";/);
  // Submit buttons are re-enabled in finally
  assert.match(APP, /button\.disabled = false;\s*button\.textContent = originalText;/);
  // Form elements and submission endpoints remain preserved
  assert.match(APP, /fetchWithTimeout\("\/api\/auth\/login"/);
  assert.match(APP, /fetchWithTimeout\("\/api\/auth\/register"/);
});

test("8. No mc_tab_token or browser REST Authorization logic is introduced", () => {
  // The wake route is same-origin and handles remote communication securely
  assert.match(WAKE_ROUTE, /export async function GET/);
  assert.match(WAKE_ROUTE, /\/actuator\/health/);
  assert.doesNotMatch(APP, /headers\["Authorization"\]\s*=\s*"Bearer\s*mc_tab_token"/i);
  assert.doesNotMatch(APP, /localStorage\.setItem\("mc_tab_token"/);
});

test("9. Existing ws-ticket behavior is unchanged", () => {
  // API wsTicket contract is preserved without Authorization override
  assert.match(API, /wsTicket\(\)\s*\{\s*return request\("auth\/ws-ticket",\s*\{\s*method:\s*"POST"\s*\}\);/);
  assert.doesNotMatch(API, /wsTicket[\s\S]*?headers\["Authorization"\]/);
});
