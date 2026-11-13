import type { NextConfig } from "next";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const replicaHtml = readFileSync(
  new URL("./public/mediclinic-system.html", import.meta.url),
  "utf8"
);
const inlineScriptHashes = [
  ...replicaHtml.matchAll(
    /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script\s*>/gi
  ),
].map((match) =>
  createHash("sha256").update(match[1]).digest("base64")
);

// Derive the backend CSP origins from API_URL so a renamed Render service does
// not get silently blocked. Falls back to the documented production service.
const configuredApiUrl =
  process.env.API_URL?.trim() || "https://medichannel-backend.onrender.com";
let backendOrigin = "https://medichannel-backend.onrender.com";
let backendSocketOrigin = "wss://medichannel-backend.onrender.com";
try {
  const parsed = new URL(configuredApiUrl);
  backendOrigin = `${parsed.protocol}//${parsed.host}`;
  backendSocketOrigin = `${parsed.protocol === "https:" ? "wss:" : "ws:"}//${parsed.host}`;
} catch {
  // Keep the documented default when API_URL is not a valid absolute URL.
}

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  async redirects() {
    return [
      { source: "/", destination: "/mediclinic-system.html", permanent: false },
      { source: "/login", destination: "/mediclinic-system.html#login", permanent: false },
      { source: "/register", destination: "/mediclinic-system.html#register", permanent: false },
      { source: "/appointments", destination: "/mediclinic-system.html#appointments", permanent: false },
      { source: "/consultation", destination: "/mediclinic-system.html#consult", permanent: false },
      { source: "/doctors", destination: "/mediclinic-system.html#index", permanent: false },
      { source: "/profile", destination: "/mediclinic-system.html#appointments", permanent: false },
      { source: "/doctor/:path*", destination: "/mediclinic-system.html#doctor", permanent: false },
      { source: "/manager/:path*", destination: "/mediclinic-system.html#manager", permanent: false },
      { source: "/admin/:path*", destination: "/mediclinic-system.html#admin", permanent: false },
    ];
  },
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
      {
        key: "Permissions-Policy",
        value:
          "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
      },
      { key: "X-DNS-Prefetch-Control", value: "off" },
      { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
    ];

    if (process.env.NODE_ENV === "production") {
      securityHeaders.push({
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains; preload",
      });
    }

    const isProd = process.env.NODE_ENV === "production";
    const devConnectOrigins = isProd
      ? ""
      : " ws://localhost:8080 http://localhost:8080";

    const replicaCsp = [
      "default-src 'self'",
      `script-src 'self' ${inlineScriptHashes
        .map((hash) => `'sha256-${hash}'`)
        .join(" ")}`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: blob:",
      `connect-src 'self' ${backendOrigin} ${backendSocketOrigin}${devConnectOrigins}`,
      "media-src 'none'",
      "object-src 'none'",
      "frame-src 'none'",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; ");

    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
        ],
      },
      {
        source: "/vendor/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/mediclinic-app.js",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
        ],
      },
      {
        source: "/mediclinic-system.html",
        headers: [
          ...securityHeaders,
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
          { key: "Content-Security-Policy", value: replicaCsp },
        ],
      },
    ];
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
