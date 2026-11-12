import { NextRequest, NextResponse } from "next/server";
import { setAuthCookie } from "@/lib/auth-cookie";
import { rejectCrossOriginMutation } from "@/lib/request-security";

type BackendError = { message?: string };

const backendUrl = () => {
  const url = process.env.API_URL;
  return url ? url.replace(/\/$/, "") : null;
};

async function readJson(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (!text) return {};
  const value: unknown = JSON.parse(text);
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("The backend returned an unexpected response.");
  }
  return value as Record<string, unknown>;
}

function messageFrom(data: Record<string, unknown>, fallback: string) {
  const error = data as BackendError;
  return typeof error.message === "string" ? error.message : fallback;
}

export async function POST(request: NextRequest) {
  const rejection = rejectCrossOriginMutation(request);
  if (rejection) return rejection;

  const apiUrl = backendUrl();
  if (!apiUrl) {
    return NextResponse.json(
      { message: "Backend API URL is not configured." },
      { status: 500 }
    );
  }

  try {
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ message: "Invalid registration request." }, { status: 400 });
    }

    const input = body as Record<string, unknown>;
    const fullName = typeof input.fullName === "string" ? input.fullName.trim() : "";
    const nameParts = fullName ? fullName.split(/\s+/) : [];
    const firstName =
      typeof input.firstName === "string" ? input.firstName.trim() : nameParts.shift() || "";
    const lastName =
      typeof input.lastName === "string"
        ? input.lastName.trim()
        : nameParts.join(" ");
    const password = typeof input.password === "string" ? input.password : "";
    const confirmPassword =
      typeof input.confirmPassword === "string"
        ? input.confirmPassword
        : typeof input.confirm === "string"
          ? input.confirm
          : "";
    const email = typeof input.email === "string" ? input.email.trim() : "";

    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      return NextResponse.json(
        { message: "Name, email, password, and password confirmation are required." },
        { status: 400 }
      );
    }
    if (
      (input.phone !== undefined && typeof input.phone !== "string") ||
      (input.dateOfBirth !== undefined &&
        typeof input.dateOfBirth !== "string") ||
      (input.gender !== undefined && typeof input.gender !== "string") ||
      (input.address !== undefined && typeof input.address !== "string")
    ) {
      return NextResponse.json(
        { message: "Patient profile fields must be provided as text." },
        { status: 400 }
      );
    }
    if (
      password.length < 12 ||
      new TextEncoder().encode(password).length > 72 ||
      password !== confirmPassword
    ) {
      return NextResponse.json(
        { message: "Use a matching password between 12 and 72 bytes." },
        { status: 400 }
      );
    }

    const nic = typeof input.nic === "string" ? input.nic.trim().toUpperCase() : "";
    if (nic && !/^(?:\d{9}[VX]|\d{12})$/.test(nic)) {
      return NextResponse.json(
        { message: "Enter a valid Sri Lankan NIC number." },
        { status: 400 }
      );
    }

    const registerResponse = await fetch(`${apiUrl}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, confirmPassword }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const registration = await readJson(registerResponse);
    if (!registerResponse.ok) {
      return NextResponse.json(
        { message: messageFrom(registration, "Registration failed.") },
        { status: registerResponse.status }
      );
    }

    if (registration.accountStatus !== "ACTIVE") {
      return NextResponse.json(
        {
          message: "Your account was created and is awaiting activation.",
          accountStatus: registration.accountStatus,
          addressSaved: false,
        },
        { status: 202 }
      );
    }

    const loginResponse = await fetch(`${apiUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const login = await readJson(loginResponse);
    if (
      !loginResponse.ok ||
      typeof login.accessToken !== "string" ||
      !Number.isSafeInteger(login.expiresIn) ||
      (login.expiresIn as number) <= 0 ||
      login.role !== "CUSTOMER"
    ) {
      return NextResponse.json(
        {
          message:
            "Your account was created, but automatic sign-in did not complete. Please sign in.",
          accountStatus: registration.accountStatus,
          profileCreated: false,
          addressSaved: false,
        },
        { status: 502 }
      );
    }

    const profile = {
      firstName,
      lastName,
      phone: input.phone,
      nic: nic || undefined,
      dateOfBirth: input.dateOfBirth,
      gender: input.gender,
      address: typeof input.address === "string" ? input.address.trim() : undefined,
    };
    const authorization = { Authorization: `Bearer ${login.accessToken}` };
    const profileResponse = await fetch(`${apiUrl}/api/v1/patients/me`, {
      method: "POST",
      headers: { ...authorization, "Content-Type": "application/json" },
      body: JSON.stringify(profile),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });

    let profileCreated = profileResponse.ok;
    if (!profileCreated && profileResponse.status === 409) {
      const existingProfile = await fetch(`${apiUrl}/api/v1/patients/me`, {
        headers: authorization,
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      });
      profileCreated = existingProfile.ok;
    }

    if (!profileCreated) {
      const profileError = await readJson(profileResponse);
      const result = NextResponse.json(
        {
          message: messageFrom(
            profileError,
            "Your account was created, but the patient profile could not be completed."
          ),
          profileCreated: false,
          addressSaved: false,
        },
        { status: 422 }
      );
      setAuthCookie(result, login.accessToken, login.expiresIn as number);
      return result;
    }

    const result = NextResponse.json(
      {
        user: { id: login.userId, email: login.email, role: login.role },
        profileCreated: true,
        addressSaved: true,
        message: "Account and patient profile created successfully.",
      },
      { status: 201 }
    );
    setAuthCookie(result, login.accessToken, login.expiresIn as number);
    return result;
  } catch {
    return NextResponse.json(
      { message: "Unable to complete registration with the backend." },
      { status: 502 }
    );
  }
}
