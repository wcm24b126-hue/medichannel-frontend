import { NextRequest, NextResponse } from "next/server";

export function rejectCrossOriginMutation(
  request: NextRequest
): NextResponse | null {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");

  if (origin) {
    try {
      if (new URL(origin).origin === request.nextUrl.origin) {
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
