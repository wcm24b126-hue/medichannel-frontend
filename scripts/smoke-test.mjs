#!/usr/bin/env node
/**
 * Black-box smoke tests for the MediChannel frontend.
 *
 * Start the app first, then run:
 *   SMOKE_BASE_URL=http://localhost:3000 npm run test:smoke
 */

const baseUrl = (process.env.SMOKE_BASE_URL || "http://localhost:3000").replace(
  /\/$/,
  ""
);

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed += 1;
    console.log(`  ok  ${message}`);
  } else {
    failed += 1;
    console.error(`  FAIL ${message}`);
  }
}

async function request(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    redirect: "manual",
    signal: AbortSignal.timeout(20_000),
    ...init,
  });
  const text = await response.text();
  return { response, text };
}

async function main() {
  console.log(`MediChannel smoke tests → ${baseUrl}\n`);

  console.log("Routing");
  {
    const { response } = await request("/");
    assert(
      [301, 302, 303, 307, 308].includes(response.status),
      "root redirects to the static application"
    );
    assert(
      (response.headers.get("location") || "").includes(
        "/mediclinic-system.html"
      ),
      "redirect target is /mediclinic-system.html"
    );
  }

  console.log("\nStatic application");
  {
    const { response, text } = await request("/mediclinic-system.html");
    assert(response.status === 200, "app HTML returns 200");
    assert(
      text.includes("/vendor/tailwindcss-3.4.17.js"),
      "Tailwind is self-hosted"
    );
    assert(
      !text.includes("cdn.tailwindcss.com"),
      "no third-party Tailwind CDN reference"
    );
    assert(
      text.includes("/mediclinic-app.js?v="),
      "application script is versioned"
    );
    assert(
      text.includes("data-patient-queue-card"),
      "welcome queue card is present"
    );
    assert(text.includes("data-guest-only"), "guest-only controls are present");
    assert(
      text.includes("data-home-dashboard"),
      "dashboard control is present"
    );
    assert(
      !text.includes("bcrypt") && !text.includes("AES-256-GCM"),
      "no unverifiable crypto claims in the frontend"
    );
    assert(!text.includes("<iframe"), "no iframes in the static app");
    assert(
      (text.match(/href="#welcome"/g) || []).length >= 4,
      "login/register logos link to the home screen"
    );
  }

  console.log("\nSecurity headers");
  {
    const { response } = await request("/mediclinic-system.html");
    const csp = response.headers.get("content-security-policy") || "";
    assert(csp.includes("default-src 'self'"), "CSP defaults to same origin");
    assert(csp.includes("script-src 'self'"), "CSP allows only same-origin scripts");
    assert(
      !csp.includes("cdn.tailwindcss.com"),
      "CSP does not trust the Tailwind CDN"
    );
    assert(
      csp.includes("frame-ancestors 'none'"),
      "CSP blocks framing"
    );
    assert(
      csp.includes("object-src 'none'"),
      "CSP blocks plugins/objects"
    );
    assert(
      response.headers.get("x-frame-options") === "DENY",
      "X-Frame-Options is DENY"
    );
    assert(
      response.headers.get("x-content-type-options") === "nosniff",
      "MIME sniffing is disabled"
    );
    assert(
      response.headers.get("cross-origin-opener-policy") === "same-origin",
      "COOP is same-origin"
    );
    assert(
      response.headers.get("cross-origin-resource-policy") === "same-origin",
      "CORP is same-origin"
    );
    assert(
      (response.headers.get("cache-control") || "").includes("must-revalidate"),
      "HTML is revalidated before reuse"
    );
  }

  console.log("\nAsset caching");
  {
    const vendor = await request("/vendor/tailwindcss-3.4.17.js");
    assert(vendor.response.status === 200, "self-hosted Tailwind returns 200");
    assert(
      (vendor.response.headers.get("cache-control") || "").includes("immutable"),
      "versioned vendor asset is immutable"
    );

    const app = await request("/mediclinic-app.js?v=20261112");
    assert(app.response.status === 200, "versioned app script returns 200");
    assert(
      (app.response.headers.get("cache-control") || "").includes(
        "must-revalidate"
      ),
      "app script is revalidated"
    );
  }

  console.log("\nAPI and CSRF protections");
  {
    const me = await request("/api/auth/me");
    assert(me.response.status === 401, "session endpoint rejects anonymous users");
    assert(
      (me.response.headers.get("cache-control") || "").includes("no-store"),
      "session responses are never cached"
    );

    const csrf = await request("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://evil.example",
      },
      body: JSON.stringify({ email: "a@b.test", password: "x" }),
    });
    assert(
      csrf.response.status === 403,
      "cross-origin login attempts are rejected"
    );

    const wake = await request("/api/backend/wake", {
      signal: AbortSignal.timeout(35_000),
    });
    assert(
      [200, 503].includes(wake.response.status),
      "wake endpoint reports a backend state"
    );
    assert(
      (wake.response.headers.get("cache-control") || "").includes("no-store"),
      "wake responses are never cached"
    );
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error("\nSmoke tests crashed:", error);
  process.exit(1);
});
