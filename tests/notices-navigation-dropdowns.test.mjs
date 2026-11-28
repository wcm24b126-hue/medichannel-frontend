import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const HTML = readFileSync(
  new URL("../public/mediclinic-system.html", import.meta.url),
  "utf8"
);
const APP = readFileSync(
  new URL("../public/mediclinic-app.js", import.meta.url),
  "utf8"
);

test("primary navigation bars include Notices for guests and customers", () => {
  const pageNavs = [...HTML.matchAll(/<nav aria-label="Pages"[^>]*>([\s\S]*?)<\/nav>/g)];
  assert.ok(pageNavs.length >= 8, "expected at least 8 primary navigation bars");

  for (const match of pageNavs) {
    const navContent = match[1];
    assert.match(
      navContent,
      /<a href="#notices" data-roles="CUSTOMER GUEST"[^>]*>Notices<\/a>/,
      "each primary nav bar must include Notices with CUSTOMER GUEST roles"
    );
  }
});

test("site navigation in login and register headers includes Notices", () => {
  const siteNavs = [...HTML.matchAll(/<nav aria-label="Site"[^>]*>([\s\S]*?)<\/nav>/g)];
  assert.ok(siteNavs.length >= 2, "expected site navs in login and register");

  for (const match of siteNavs) {
    const navContent = match[1];
    assert.match(
      navContent,
      /<a href="#notices">Notices<\/a>/,
      "login/register site nav must include Notices link"
    );
  }
});

test("footer includes link to Notices", () => {
  assert.match(
    HTML,
    /<nav aria-label="Patients">[\s\S]*?<a href="#notices"[^>]*>Notices<\/a>/
  );
});

test("inline boot script recognizes #notices and #public-notices-panel without screen flicker", () => {
  assert.match(
    HTML,
    /if\(h==="notices"\|\|h==="public-notices-panel"\)h="welcome";/
  );
});

test("parseHash resolves #notices to welcome view and public-notices-panel without duplicate screens", () => {
  assert.match(APP, /if \(id === "notices" \|\| id === "public-notices-panel"\) \{/);
  assert.match(APP, /panel = "public-notices-panel";/);

  // No separate notices view section is defined
  const sectionViews = [...HTML.matchAll(/<section data-view="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(!sectionViews.includes("notices"), "must not introduce a duplicate notices section");
  assert.ok(sectionViews.includes("welcome"), "welcome view contains the public notices panel");
  assert.match(HTML, /id="public-notices-panel"/);
});

test("setPrimaryNavCurrent marks Notices active when visiting #notices", () => {
  assert.match(APP, /const isNoticesActive = hash === "notices" \|\| hash === "public-notices-panel"/);
  assert.match(APP, /link\.setAttribute\("aria-current", "page"\)/);
  assert.match(APP, /link\.removeAttribute\("aria-current"\)/);
});

test("document title and route announcer update for Notices & Announcements", () => {
  assert.match(APP, /"Notices & Announcements"/);
  assert.match(APP, /announceRoute\("Notices & announcements"\)/);
  assert.match(APP, /noticesPanel\.scrollIntoView/);
});

test("public notices renderer strictly excludes unpublished notices", () => {
  assert.match(APP, /notice\.published !== false/);
  assert.match(APP, /!isHiddenPublicNotice\(notice\)/);
});

test("all search and filter dropdowns remain closed on initial page load", () => {
  // Searchable select panel is initially uncreated or hidden
  assert.match(APP, /let searchSelectPanel = null;/);
  assert.match(APP, /panel\.hidden = true;/);

  // Notification popovers are hidden on initial load
  const popoverMatches = [...HTML.matchAll(/data-notification-popover\b[^>]*>/g)];
  assert.ok(popoverMatches.length >= 8, "expected notification popovers");
  for (const match of popoverMatches) {
    assert.match(match[0], /\bhidden\b/, "notification popovers must be hidden initially");
  }

  // Notification bells start collapsed
  const bellMatches = [...HTML.matchAll(/data-notification-bell\b[^>]*>/g)];
  for (const match of bellMatches) {
    assert.match(match[0], /aria-expanded="false"/, "bells must start with aria-expanded='false'");
  }
});

test("searchable dropdown opens only after deliberate pointer or key interaction", () => {
  // Pointerdown and keydown triggers
  assert.match(APP, /document\.addEventListener\(\s*"pointerdown"/);
  assert.match(APP, /document\.addEventListener\(\s*"keydown"/);
  assert.match(APP, /openSearchSelect\(select\)/);

  // Passive focus does not open the dropdown
  assert.doesNotMatch(APP, /document\.addEventListener\(\s*"focus",\s*\(event\)\s*=>\s*\{[\s\S]*?openSearchSelect/);
  assert.doesNotMatch(APP, /document\.addEventListener\(\s*"focusin",\s*\(event\)\s*=>\s*\{[\s\S]*?openSearchSelect/);
});

test("searchable dropdown closes on selection, Escape, blur and outside click", () => {
  // Close on Escape
  assert.match(APP, /if \(event\.key === "Escape"\) \{[\s\S]*?closeSearchSelect\(\)/);

  // Close on outside click
  assert.match(APP, /!searchSelectPanel\.panel\.contains\(target\) &&[\s\S]*?target\.closest\("select"\) !== searchableSelect[\s\S]*?closeSearchSelect\(\)/);

  // Close on focusout/blur
  assert.match(APP, /document\.addEventListener\("focusout"/);

  // Close on item selection
  assert.match(APP, /function chooseSearchableOption/);
  assert.match(APP, /closeSearchSelect\(\);/);

  // Selected value preserved
  assert.match(APP, /select\.value = value;/);
  assert.match(APP, /select\.dispatchEvent\(new Event\("change", \{ bubbles: true \}\)\)/);
  assert.match(APP, /select\.dispatchEvent\(new Event\("input", \{ bubbles: true \}\)\)/);
});

test("accessibility: aria-expanded and hidden states reflect open/closed state", () => {
  assert.match(APP, /select\.setAttribute\("aria-expanded", "true"\)/);
  assert.match(APP, /searchableSelect\.removeAttribute\("aria-expanded"\)/);
  assert.match(APP, /searchSelectPanel\.panel\.hidden = true/);
  assert.match(APP, /ui\.panel\.hidden = false;/);
});
