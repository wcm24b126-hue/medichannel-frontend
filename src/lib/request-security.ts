import { NextRequest, NextResponse } from "next/server";

function firstHeaderValue(value: string | null): string | null {
  return value?.split(",")[0]?.trim() || null;
}

/**
 * Reject state-changing requests that did not originate from this deployment.
 * Behind a proxy, `request.nextUrl.origin` can be an internal origin, so the
 * forwarded host/protocol and the Host header are accepted as well.
 */
export function rejectCrossOriginMutation(
  request: NextRequest
): NextResponse | null {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  const allowedOrigins = new Set<string>([request.nextUrl.origin]);

  const forwardedHost = firstHeaderValue(
    request.headers.get("x-forwarded-host")
  );
  const host = forwardedHost || firstHeaderValue(request.headers.get("host"));

  if (host) {
    const forwardedProto = firstHeaderValue(
      request.headers.get("x-forwarded-proto")
    );
    const proto = forwardedProto || request.nextUrl.protocol.replace(":", "");
    allowedOrigins.add(`${proto}://${host}`);
    // Accept an https origin even when the proxy chain did not advertise the
    // external protocol; never accept a downgraded http origin.
    allowedOrigins.add(`https://${host}`);
  }

  if (origin) {
    try {
      if (allowedOrigins.has(new URL(origin).origin)) {
        return null;
      }
    } catch {
      // Invalid Origin values are rejected below.
    }
  } else if (fetchSite === "same-origin") {
    return null;
  }

  return NextResponse.json(
    { message: "Cross-origin request rejected." },
    { status: 403 }
  );
}
