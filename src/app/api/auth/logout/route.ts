import { NextRequest, NextResponse } from "next/server";
import { clearAuthCookie } from "@/lib/auth-cookie";
import { rejectCrossOriginMutation } from "@/lib/request-security";

export async function POST(request: NextRequest) {
  const rejection = rejectCrossOriginMutation(request);
  if (rejection) return rejection;

  const response = NextResponse.json({ message: "Logged out." });

  clearAuthCookie(response);

  return response;
}
