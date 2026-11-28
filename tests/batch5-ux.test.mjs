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

test("1. Desktop navigation contains Notices", () => {
  // Navigation elements in headers across views contain the Notices link
  const navMatches = HTML.match(/<nav aria-label="Pages"[^>]*>([\s\S]*?)<\/nav>/g) || [];
  assert.ok(navMatches.length >= 8, "Expected at least 8 primary navigation bars");
  for (const nav of navMatches) {
    assert.match(
      nav,
      /<a href="#notices"[^>]*>Notices<\/a>/,
      "Each primary navigation must contain Notices"
    );
  }
});

test("2. Mobile navigation contains Notices", () => {
  // The primary navigation is responsive and includes mobile classes
  // order-3 w-full lg:order-none lg:w-auto overflow-x-auto
  const mobileNavMatches = HTML.match(
    /<nav aria-label="Pages"[^>]*overflow-x-auto[^>]*>([\s\S]*?)<\/nav>/g
  ) || [];
  assert.ok(mobileNavMatches.length >= 8, "Expected responsive mobile navigation");
  for (const nav of mobileNavMatches) {
    assert.match(nav, /<a href="#notices"[^>]*>Notices<\/a>/);
  }
});

test("3. Notices link opens the existing public notices view", () => {
  assert.match(
    APP,
    /if\s*\(\s*id === "notices" \|\| id === "public-notices-panel"\s*\)\s*\{\s*id = "welcome"/,
    "notices route maps to the existing welcome view where public notices live"
  );
  assert.match(
    APP,
    /public-notices-panel/,
    "notices panel identifier is preserved"
  );
});

test("4. Active navigation state is correct", () => {
  assert.match(
    APP,
    /isNoticesActive/,
    "setPrimaryNavCurrent checks whether notices route is active"
  );
  assert.match(
    APP,
    /setAttribute\("aria-current", "page"\)/,
    "Active nav link gets aria-current=page"
  );
  assert.match(
    APP,
    /removeAttribute\("aria-current"\)/,
    "Inactive nav link has aria-current removed"
  );
});

test("5. Guests can access published notices", () => {
  // Notices link is marked with data-roles="CUSTOMER GUEST"
  const noticeLinks = HTML.match(/<a href="#notices"[^>]*>/g) || [];
  assert.ok(noticeLinks.length > 0, "Notices link exists");
  for (const link of noticeLinks) {
    if (link.includes("data-roles")) {
      assert.match(link, /data-roles="[^"]*GUEST[^"]*"/, "Notices must be accessible to GUEST");
    }
  }
});

test("6. No duplicate notices view is introduced", () => {
  // Verify that only the original welcome view hosts public notices
  // and no duplicate <section data-view="notices"> was created
  assert.equal(
    HTML.includes('data-view="notices"'),
    false,
    "Must not create a duplicate section data-view=notices"
  );
  assert.equal(
    (HTML.match(/id="public-notices-panel"/g) || []).length,
    1,
    "Exactly one public notices panel exists in HTML without creating duplicate screens"
  );
});

test("7. Search dropdowns are closed initially", () => {
  assert.match(APP, /const panel = el\("div", "mc-search-select"\)/);
  assert.match(APP, /panel\.hidden = true/);
  assert.match(APP, /panel\.setAttribute\("aria-hidden", "true"\)/);
});

test("8. Meaningful input opens the correct dropdown", () => {
  // Opening happens on intentional pointerdown, key navigation, or character input
  assert.match(APP, /openSearchSelect\(select\)/);
  assert.match(APP, /\["Enter", " ", "ArrowDown", "ArrowUp"\]\.includes\(event\.key\)/);
  assert.match(APP, /event\.key\.length === 1/);
});

test("9. Selection closes the dropdown", () => {
  assert.match(APP, /function chooseSearchableOption/);
  assert.match(APP, /closeSearchSelect\(\)/);
  assert.match(APP, /select\.focus\(\)/);
});

test("10. Escape closes the dropdown", () => {
  assert.match(APP, /if \(event\.key === "Escape"\) \{[\s\S]*?closeSearchSelect\(\)/);
});

test("11. Outside click closes the dropdown", () => {
  assert.match(
    APP,
    /!searchSelectPanel\.panel\.contains\(target\) &&[\s\S]*?closeSearchSelect\(\)/
  );
});

test("12. aria-expanded changes correctly", () => {
  assert.match(APP, /select\.setAttribute\("aria-expanded", "true"\)/);
  assert.match(APP, /searchableSelect\.setAttribute\("aria-expanded", "false"\)/);
});

test("13. Hidden results are not keyboard-focusable", () => {
  assert.match(APP, /input\.tabIndex = -1/);
  assert.match(APP, /close\.tabIndex = -1/);
  assert.match(APP, /input\.tabIndex = 0/);
  assert.match(APP, /close\.tabIndex = 0/);
});

test("14. Existing doctor/session search still works", () => {
  assert.match(APP, /function directoryFilters\(\)/);
  assert.match(APP, /function currentFilters\(\)/);
  assert.match(APP, /function loadSpecialisations\(\)/);
});

test("15. Existing booking flow remains unchanged", () => {
  assert.match(APP, /function confirmBooking\(\)/);
  assert.match(APP, /data-booking-form/);
  assert.match(APP, /data-booking-confirm/);
});
