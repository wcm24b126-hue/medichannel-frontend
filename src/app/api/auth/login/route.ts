import { NextRequest, NextResponse } from "next/server";
import { setAuthCookie } from "@/lib/auth-cookie";
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
      `${apiUrl.replace(/\/$/, "")}/api/v1/auth/login`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      }
    );

    const responseText = await response.text();
    const data = responseText ? JSON.parse(responseText) : {};

    if (!response.ok) {
      return NextResponse.json(
        { message: data.message || "Login failed." },
        { status: response.status }
      );
    }

    const allowedRoles = ["CUSTOMER", "DOCTOR", "MANAGER", "ADMIN"];
    if (
      typeof data.accessToken !== "string" ||
      data.accessToken.length === 0 ||
      data.tokenType !== "Bearer" ||
      !Number.isSafeInteger(data.expiresIn) ||
      data.expiresIn <= 0 ||
      typeof data.userId !== "string" ||
      typeof data.email !== "string" ||
      !allowedRoles.includes(data.role)
    ) {
      return NextResponse.json(
        { message: "The backend returned an unexpected login response." },
        { status: 502 }
      );
    }

    const result = NextResponse.json({
      user: {
        id: data.userId,
        email: data.email,
        role: data.role,
      },
      token: data.accessToken,
    });

    setAuthCookie(result, data.accessToken, data.expiresIn);

    return result;
  } catch {
    return NextResponse.json(
      { message: "Unable to connect to the login service." },
      { status: 502 }
    );
  }
}
