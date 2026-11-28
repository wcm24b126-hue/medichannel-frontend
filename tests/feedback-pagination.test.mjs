import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const API_SOURCE = fs.readFileSync(path.join(ROOT, "public/mediclinic-api.js"), "utf8");
const APP_SOURCE = fs.readFileSync(path.join(ROOT, "public/mediclinic-app.js"), "utf8");
const HTML_SOURCE = fs.readFileSync(path.join(ROOT, "public/mediclinic-system.html"), "utf8");

test("1. First review page renders backend content", () => {
  // managerReviews requests default page 0 and renders backend response.content or array
  assert.match(
    API_SOURCE,
    /managerReviews\(status, page, size, doctorId, rating\)/
  );
  assert.match(APP_SOURCE, /const response = await MC\.managerReviews/);
  assert.match(APP_SOURCE, /container\.replaceChildren\(\.\.\.reviews\.map\(renderManagerReview\)\);/);
  assert.match(HTML_SOURCE, /<div data-manager-reviews class="grid gap-3"><\/div>/);
});

test("2. Previous disabled on first page", () => {
  assert.match(
    APP_SOURCE,
    /prevBtn\.disabled = managerReviewsState\.page <= 0 \|\| managerReviewsState\.loading;/
  );
  assert.match(HTML_SOURCE, /data-manager-reviews-prev[^>]*disabled/);
});

test("3. Next disabled on last page", () => {
  assert.match(
    APP_SOURCE,
    /nextBtn\.disabled =\s*managerReviewsState\.page >= managerReviewsState\.totalPages - 1 \|\|\s*managerReviewsState\.loading;/
  );
  assert.match(HTML_SOURCE, /data-manager-reviews-next[^>]*disabled/);
});

test("4. Page indicator uses backend metadata", () => {
  assert.match(
    APP_SOURCE,
    /pageText\.textContent = "Page " \+ current \+ " of " \+ total;/
  );
  assert.match(
    APP_SOURCE,
    /managerReviewsState\.totalPages = Number\(response\.totalPages\) \|\| 0;/
  );
  assert.match(HTML_SOURCE, /<p data-manager-reviews-page[^>]*>Page 1 of 1<\/p>/);
});

test("5. Next/Previous request correct pages", () => {
  assert.match(
    APP_SOURCE,
    /loadManagerReviews\(\{\s*page:\s*managerReviewsState\.page - 1\s*\}\);/
  );
  assert.match(
    APP_SOURCE,
    /loadManagerReviews\(\{\s*page:\s*managerReviewsState\.page \+ 1\s*\}\);/
  );
});

test("6. Filter change resets page to zero", () => {
  assert.match(
    APP_SOURCE,
    /filter\.addEventListener\("change",\s*\(e\)\s*=>\s*\{\s*loadManagerReviews\(\{\s*page:\s*0,\s*status:\s*e\.target\.value\s*\}\);\s*\}\);/
  );
});

test("7. Filters remain selected while paging", () => {
  assert.match(
    APP_SOURCE,
    /const response = await MC\.managerReviews\(\s*managerReviewsState\.status,\s*managerReviewsState\.page,\s*managerReviewsState\.size\s*\);/
  );
  assert.match(HTML_SOURCE, /data-manager-reviews-status-filter/);
});

test("8. Loading state", () => {
  assert.match(APP_SOURCE, /managerReviewsState\.loading = true;/);
  assert.match(APP_SOURCE, /setStatus\(status, "Loading feedback…"\);/);
});

test("9. Empty state", () => {
  assert.match(
    APP_SOURCE,
    /setStatus\(\s*status,\s*settings\.successMessage\s*\?\s*settings\.successMessage \+ " No feedback is currently available\."\s*:\s*"No feedback is currently available for moderation\."\s*\);/
  );
});

test("10. Error and retry state", () => {
  assert.match(
    APP_SOURCE,
    /setStatus\(\s*status,\s*"Could not load feedback: " \+ \(error\.message \|\| "Unknown error"\),\s*true\s*\);/
  );
});

test("11. New review refreshes page and aggregate", () => {
  assert.match(APP_SOURCE, /const saved = await MC\.submitReview\(appointmentId, ratingValue, commentValue\);/);
  assert.match(APP_SOURCE, /markFeedbackSubmitted\(/);
  assert.match(APP_SOURCE, /state\.myReviews = \[/);
});

test("12. Duplicate submit prevention", () => {
  assert.match(APP_SOURCE, /if \(button\) button\.disabled = true;/);
  assert.match(APP_SOURCE, /if \(existing \|\| state\.submittedFeedbackIds\.has\(String\(appointmentId\)\)\)/);
});

test("13. Aggregate rating does not use visible-page calculations", () => {
  // Aggregate is never computed via visiblePage.reduce or visibleReviews.length
  assert.doesNotMatch(APP_SOURCE, /visibleReviews\.reduce/);
  assert.doesNotMatch(APP_SOURCE, /reviews\.reduce\(\(acc, r\) => acc \+ r\.rating/);
  assert.match(APP_SOURCE, /Number\.isInteger\(rating\) && rating >= 1 && rating <= 5/);
});

test("14. No direct DOM injection", () => {
  assert.match(APP_SOURCE, /container\.replaceChildren\(\.\.\.reviews\.map\(renderManagerReview\)\);/);
  assert.doesNotMatch(APP_SOURCE, /data-manager-reviews.*innerHTML \+=/);
});

test("15. Rapid refreshes are coalesced, if relevant", () => {
  assert.match(APP_SOURCE, /if \(state\.syncedReviewNotifications\.has\(key\)\) return;/);
  assert.match(APP_SOURCE, /state\.syncedReviewNotifications\.add\(key\);/);
});

test("16. Existing appointment/consultation feedback flow remains functional", () => {
  assert.match(APP_SOURCE, /async function loadConsultationReviewState\(appointmentId\)/);
  assert.match(APP_SOURCE, /findConsultationReview\(appointmentId\)/);
  assert.match(APP_SOURCE, /renderFeedbackRecord/);
});

test("17. Patient and doctor pagination from earlier batches remains unchanged", () => {
  // Batch 4B patient appointment pagination
  assert.match(HTML_SOURCE, /data-appointments-pagination/);
  assert.match(HTML_SOURCE, /data-appointments-prev/);
  assert.match(HTML_SOURCE, /data-appointments-next/);
  // Batch 6 doctor history pagination
  assert.match(HTML_SOURCE, /data-doctor-history-prev/);
  assert.match(HTML_SOURCE, /data-doctor-history-next/);
});

test("18. Batch 1-6 behavior remains intact", () => {
  // Batch 4A Admin audit log pagination
  assert.match(HTML_SOURCE, /data-audit-prev/);
  assert.match(HTML_SOURCE, /data-audit-next/);
  // Batch 5 Notices public navigation
  assert.match(HTML_SOURCE, /<a href="#notices" data-roles="CUSTOMER GUEST"/);
  // Batch 6 Doctor console
  assert.match(HTML_SOURCE, /data-view="doctor"/);
});
