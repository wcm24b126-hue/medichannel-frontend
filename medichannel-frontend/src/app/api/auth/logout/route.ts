import { NextRequest, NextResponse } from "next/server";
import { rejectCrossOriginMutation } from "@/lib/request-security";

export async function POST(request: NextRequest) {
  const rejection = rejectCrossOriginMutation(request);
  if (rejection) return rejection;

  const response = NextResponse.redirect(new URL("/login", request.url), 303);

  response.cookies.set("medichannel_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
