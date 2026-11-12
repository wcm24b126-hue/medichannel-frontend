"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PublicLayout from "@/components/common/public-layout";

type LoginResponse = {
  user: {
    role: "CUSTOMER" | "DOCTOR" | "MANAGER" | "ADMIN";
  };
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Login failed.");
      }

      const result = data as LoginResponse;
      const destinations = {
        CUSTOMER: "/",
        DOCTOR: "/doctor/dashboard",
        MANAGER: "/manager/dashboard",
        ADMIN: "/admin/dashboard",
      };

      router.push(destinations[result.user.role]);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PublicLayout>
      <div className="mx-auto max-w-md card">
        <h1 className="page-title">Welcome Back</h1>
        <p className="mb-6 mt-2 text-sm text-slate-500">
          Log in to your MediChannel account.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm font-medium">
            Email Address
            <input
              className="field"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label className="block text-sm font-medium">
            Password
            <input
              className="field"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          {error && (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <button className="primary-button w-full" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-500">
          Do not have an account? <Link className="text-blue-700" href="/register">Register</Link>
        </p>
      </div>
    </PublicLayout>
  );
}
