import { NextRequest, NextResponse } from "next/server";

type CurrentUser = {
  userId: string;
  email: string;
  role: "CUSTOMER" | "DOCTOR" | "MANAGER" | "ADMIN";
};

const roles = new Set(["CUSTOMER", "DOCTOR", "MANAGER", "ADMIN"]);

export async function GET(request: NextRequest) {
  const token = request.cookies.get("medichannel_token")?.value;
  if (!token) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  const apiUrl = process.env.API_URL;
  if (!apiUrl) {
    return NextResponse.json(
      { message: "Backend API URL is not configured." },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(
      `${apiUrl.replace(/\/$/, "")}/api/v1/auth/me`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      }
    );
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};

    if (!response.ok) {
      const result = NextResponse.json(
        { message: data.message || "Unable to restore the session." },
        { status: response.status }
      );
      if (response.status === 401) {
        result.cookies.delete("medichannel_token");
      }
      return result;
    }

    if (
      typeof data.userId !== "string" ||
      typeof data.email !== "string" ||
      !roles.has(data.role)
    ) {
      return NextResponse.json(
        { message: "The backend returned an unexpected session response." },
        { status: 502 }
      );
    }

    const user: CurrentUser = {
      userId: data.userId,
      email: data.email,
      role: data.role,
    };
    return NextResponse.json({ user }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json(
      { message: "Unable to connect to the session service." },
      { status: 502 }
    );
  }
}
