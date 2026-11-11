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
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [profileSetupRequired, setProfileSetupRequired] = useState(false);
  const [loading, setLoading] = useState(false);

  function update(
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatusMessage("");
    setProfileSetupRequired(false);
    setLoading(true);

    try {
      const nic = form.nic.trim().toUpperCase();
      if (!/^(?:\d{9}[VX]|\d{12})$/.test(nic)) {
        throw new Error("Enter a valid Sri Lankan NIC number.");
      }

      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, nic }),
      });
      const data = await response.json();

      if (response.status === 202) {
        setStatusMessage(data.message || "Your account is awaiting activation.");
        return;
      }
      if (response.status === 422 && data.profileCreated === false) {
        setError(data.message || "Your patient profile needs to be completed.");
        setProfileSetupRequired(true);
        return;
      }
      if (!response.ok) {
        throw new Error(data.message || "Registration failed.");
      }

      if (data.profileCreated !== true) {
        throw new Error("Registration completed without a confirmed patient profile.");
      }
      router.push("/appointments");
      router.refresh();
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
            ["confirmPassword", "Confirm Password", "password"],
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
                minLength={
                  name === "password" || name === "confirmPassword" ? 12 : undefined
                }
                maxLength={
                  name === "password" || name === "confirmPassword" ? 72 : undefined
                }
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
            <span className="mt-1 block text-xs text-amber-700">
              Address is collected by this form but is not saved because the backend profile API does not support it.
            </span>
          </label>

          {statusMessage && (
            <p role="status" className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800 sm:col-span-2">
              {statusMessage}
            </p>
          )}
          {error && (
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 sm:col-span-2">
              {error}
            </p>
          )}
          {profileSetupRequired && (
            <a className="text-sm font-semibold text-blue-700 sm:col-span-2" href="/profile">
              Continue to patient profile setup
            </a>
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
