import { NextRequest, NextResponse } from "next/server";
import { rejectCrossOriginMutation } from "@/lib/request-security";

export async function POST(request: NextRequest) {
  const rejection = rejectCrossOriginMutation(request);
  if (rejection) return rejection;

  const apiUrl = process.env.API_URL;

  if (!apiUrl) {
    return NextResponse.json(
      { message: "Backend API URL is not configured." },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();

    const response = await fetch(
      `${apiUrl.replace(/\/$/, "")}/api/auth/login`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { message: data.message || "Login failed." },
        { status: response.status }
      );
    }

    if (!data.token || !data.user) {
      return NextResponse.json(
        { message: "The backend returned an unexpected login response." },
        { status: 502 }
      );
    }

    const result = NextResponse.json({ user: data.user });

    result.cookies.set("medichannel_token", data.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8,
    });

    return result;
  } catch {
    return NextResponse.json(
      { message: "Unable to connect to the login service." },
      { status: 502 }
    );
  }
}
