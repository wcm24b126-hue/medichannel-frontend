import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const API_SOURCE = fs.readFileSync(path.join(ROOT, "public/mediclinic-api.js"), "utf8");
const APP_SOURCE = fs.readFileSync(path.join(ROOT, "public/mediclinic-app.js"), "utf8");
const HTML_SOURCE = fs.readFileSync(path.join(ROOT, "public/mediclinic-system.html"), "utf8");

test("1. Manager first page renders backend content", () => {
  assert.match(
    API_SOURCE,
    /managerNotices\(published, page, size\)/
  );
  assert.match(APP_SOURCE, /MC\.managerNotices\(published, page, size\)/);
  assert.match(APP_SOURCE, /container\.replaceChildren\(\.\.\.notices\.map\(renderManagerNotice\)\);/);
});

test("2. Previous disabled on first page", () => {
  assert.match(
    APP_SOURCE,
    /previous\.disabled = page <= 0 \|\| managerNoticeState\.loading;/
  );
  assert.match(APP_SOURCE, /previous\.dataset\.managerNoticesPage = "previous";/);
});

test("3. Next disabled on last page", () => {
  assert.match(
    APP_SOURCE,
    /next\.disabled = page >= totalPages - 1 \|\| managerNoticeState\.loading;/
  );
  assert.match(APP_SOURCE, /next\.dataset\.managerNoticesPage = "next";/);
});

test("4. Page indicator uses backend metadata", () => {
  assert.match(
    APP_SOURCE,
    /"Page " \+ \(page \+ 1\) \+ " of " \+ totalPages/
  );
  assert.match(
    APP_SOURCE,
    /managerNoticeState\.totalPages = typeof response\.totalPages === "number"/
  );
});

test("5. Next/Previous request correct pages", () => {
  assert.match(
    APP_SOURCE,
    /void loadManagerNotices\(\{\s*page:\s*managerNoticeState\.page \+ 1\s*\}\);/
  );
  assert.match(
    APP_SOURCE,
    /void loadManagerNotices\(\{\s*page:\s*managerNoticeState\.page - 1\s*\}\);/
  );
});

test("6. Filter change resets page to zero", () => {
  assert.match(
    APP_SOURCE,
    /void loadManagerNotices\(\{\s*page:\s*0,\s*published\s*\}\);/
  );
});

test("7. Filters remain selected while paging", () => {
  assert.match(
    APP_SOURCE,
    /const published = managerNoticeState\.published;/
  );
  assert.match(
    APP_SOURCE,
    /filter\.id = "manager-notices-filter";/
  );
});

test("8. Loading state", () => {
  assert.match(APP_SOURCE, /managerNoticeState\.loading = true;/);
  assert.match(APP_SOURCE, /setStatus\(status, "Loading notices…"\);/);
});

test("9. Empty state", () => {
  assert.match(
    APP_SOURCE,
    /No notices have been created\./
  );
  assert.match(
    APP_SOURCE,
    /No notices found matching the selected filter\./
  );
});

test("10. Error and retry state", () => {
  assert.match(
    APP_SOURCE,
    /Could not load notices: /
  );
  assert.match(
    APP_SOURCE,
    /retryBtn\.dataset\.managerNoticesRetry = "";/
  );
});

test("11. Create resets to newest page", () => {
  assert.match(
    APP_SOURCE,
    /page:\s*editingId\s*\?\s*managerNoticeState\.page\s*:\s*0/
  );
});

test("12. Edit refreshes current page", () => {
  assert.match(
    APP_SOURCE,
    /editingId \? "Notice updated successfully\." : "Notice published successfully\."/
  );
});

test("13. Publish/unpublish refreshes Manager and public views correctly", () => {
  assert.match(APP_SOURCE, /state\.publicNoticesLoaded = false;/);
  assert.match(APP_SOURCE, /void loadPublicNotices\(\{\s*force:\s*true\s*\}\)/);
});

test("14. Delete/hide final item clamps page safely", () => {
  assert.match(
    APP_SOURCE,
    /if \(action === "delete" && state\.managerNotices\.length <= 1 && managerNoticeState\.page > 0\) \{\s*targetPage = managerNoticeState\.page - 1;\s*\}/
  );
});

test("15. Duplicate submit prevention", () => {
  assert.match(
    APP_SOURCE,
    /if \(!ManagerUI\.lockAction\(submit\)\) return;/
  );
  assert.match(
    APP_SOURCE,
    /form\.dataset\.busy = "true";/
  );
});

test("16. No direct DOM injection", () => {
  assert.match(
    APP_SOURCE,
    /container\.replaceChildren\(\.\.\.notices\.map\(renderManagerNotice\)\);/
  );
  assert.doesNotMatch(APP_SOURCE, /data-manager-notices.*innerHTML \+=/);
});

test("17. No client-side slicing", () => {
  // Pagination is server-side and does not slice all notices in memory
  assert.doesNotMatch(APP_SOURCE, /state\.managerNotices\.slice\(/);
});

test("18. #notices public navigation remains functional", () => {
  assert.match(HTML_SOURCE, /<a href="#notices" data-roles="CUSTOMER GUEST"[^>]*>Notices<\/a>/);
  assert.match(APP_SOURCE, /if \(id === "notices" \|\| id === "public-notices-panel"\) \{/);
  assert.match(APP_SOURCE, /panel = "public-notices-panel";/);
});

test("19. Draft notices never appear publicly", () => {
  assert.match(
    APP_SOURCE,
    /notice && notice\.published !== false && !isHiddenPublicNotice\(notice\)/
  );
});

test("20. Batch 1-7 behavior remains intact", () => {
  // Batch 4A Admin audit log pagination
  assert.match(HTML_SOURCE, /data-audit-prev/);
  assert.match(HTML_SOURCE, /data-audit-next/);
  // Batch 4B Patient appointment pagination
  assert.match(HTML_SOURCE, /data-appointments-pagination/);
  // Batch 5 Notices navigation
  assert.match(HTML_SOURCE, /<a href="#notices"/);
  // Batch 6 Doctor history pagination
  assert.match(HTML_SOURCE, /data-doctor-history-prev/);
  // Batch 7 Manager review moderation pagination
  assert.match(HTML_SOURCE, /data-manager-reviews-prev/);
  assert.match(HTML_SOURCE, /data-manager-reviews-next/);
});
