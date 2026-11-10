"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PublicLayout from "@/components/common/public-layout";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    fullName: "",
    nic: "",
    dateOfBirth: "",
    gender: "",
    phone: "",
    email: "",
    address: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function update(
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/backend/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Registration failed.");
      }

      router.push("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PublicLayout>
      <div className="mx-auto max-w-2xl card">
        <h1 className="page-title">Create Your Account</h1>
        <p className="mb-6 mt-2 text-sm text-slate-500">
          Register as a patient to book appointments.
        </p>

        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          {[
            ["fullName", "Full Name", "text"],
            ["nic", "NIC Number", "text"],
            ["dateOfBirth", "Date of Birth", "date"],
            ["phone", "Phone Number", "tel"],
            ["email", "Email Address", "email"],
            ["password", "Password", "password"],
          ].map(([name, label, type]) => (
            <label key={name} className="text-sm font-medium">
              {label}
              <input
                className="field"
                name={name}
                type={type}
                value={form[name as keyof typeof form]}
                onChange={update}
                required
                minLength={name === "password" ? 8 : undefined}
              />
            </label>
          ))}

          <label className="text-sm font-medium">
            Gender
            <select className="field" name="gender" value={form.gender} onChange={update} required>
              <option value="">Select gender</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </select>
          </label>

          <label className="text-sm font-medium sm:col-span-2">
            Address
            <input className="field" name="address" value={form.address} onChange={update} required />
          </label>

          {error && (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 sm:col-span-2">
              {error}
            </p>
          )}

          <button className="primary-button sm:col-span-2" disabled={loading}>
            {loading ? "Creating account..." : "Register"}
          </button>
        </form>

        <p className="mt-4 text-xs text-slate-500">
          Public registration creates a CUSTOMER account only. Staff accounts
          must be created by an administrator.
        </p>
      </div>
    </PublicLayout>
  );
}
