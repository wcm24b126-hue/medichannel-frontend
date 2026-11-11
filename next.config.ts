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

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  async redirects() {
    return [
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
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
      },
    ];

    if (process.env.NODE_ENV === "production") {
      securityHeaders.push({
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains",
      });
    }

    const replicaCsp = [
      "default-src 'self'",
      `script-src 'self' https://cdn.tailwindcss.com ${inlineScriptHashes
        .map((hash) => `'sha256-${hash}'`)
        .join(" ")}`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.tailwindcss.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://images.unsplash.com",
      "connect-src 'self' wss:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
    ].join("; ");

    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
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
