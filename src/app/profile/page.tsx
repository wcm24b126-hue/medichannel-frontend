"use client";

import { useEffect, useState, type FormEvent } from "react";
import Workspace from "@/components/common/workspace";
import { ApiError, apiRequest } from "@/lib/api";

type PatientProfile = {
  patientId: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  dateOfBirth: string | null;
  gender: string | null;
};

type ProfileForm = {
  firstName: string;
  lastName: string;
  phone: string;
  nic: string;
  dateOfBirth: string;
  gender: string;
};

const emptyForm: ProfileForm = {
  firstName: "",
  lastName: "",
  phone: "",
  nic: "",
  dateOfBirth: "",
  gender: "",
};

export default function ProfilePage() {
  const [form, setForm] = useState(emptyForm);
  const [hasProfile, setHasProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    apiRequest<PatientProfile>("patients/me")
      .then((profile) => {
        if (!active) return;
        setHasProfile(true);
        setForm({
          firstName: profile.firstName,
          lastName: profile.lastName,
          phone: profile.phone ?? "",
          nic: "",
          dateOfBirth: profile.dateOfBirth ?? "",
          gender: profile.gender ?? "",
        });
      })
      .catch((cause: unknown) => {
        if (!active) return;
        if (cause instanceof ApiError && cause.status === 404) {
          setHasProfile(false);
          return;
        }
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to load your patient profile."
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  function update(event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function createProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const nic = form.nic.trim().toUpperCase();
    if (nic && !/^(?:\d{9}[VX]|\d{12})$/.test(nic)) {
      setError("Enter a valid Sri Lankan NIC number.");
      return;
    }

    setSaving(true);
    try {
      await apiRequest<PatientProfile>("patients/me", {
        method: "POST",
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          phone: form.phone || undefined,
          nic: nic || undefined,
          dateOfBirth: form.dateOfBirth || undefined,
          gender: form.gender || undefined,
        }),
      });
      setHasProfile(true);
      setMessage("Your patient profile was created.");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to create your profile."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Workspace
      role="patient"
      title="My Profile"
      description="View your patient information or complete your profile."
    >
      <div className="card max-w-2xl">
        {message && <p role="status" className="mb-4 text-sm text-green-700">{message}</p>}
        {loading ? (
          <p role="status">Loading your profile...</p>
        ) : hasProfile ? (
          <>
            <h2 className="text-lg font-bold">Personal Information</h2>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-slate-500">First name</dt><dd>{form.firstName}</dd></div>
              <div><dt className="text-slate-500">Last name</dt><dd>{form.lastName}</dd></div>
              <div><dt className="text-slate-500">Phone</dt><dd>{form.phone || "Not provided"}</dd></div>
              <div><dt className="text-slate-500">Date of birth</dt><dd>{form.dateOfBirth || "Not provided"}</dd></div>
              <div><dt className="text-slate-500">Gender</dt><dd>{form.gender || "Not provided"}</dd></div>
            </dl>
            <p className="mt-4 text-xs text-slate-500">
              NIC values are not returned by the backend profile API. Address is not supported by the current backend.
            </p>
          </>
        ) : (
          <>
            <h2 className="text-lg font-bold">Complete Your Patient Profile</h2>
            <p className="mt-2 text-sm text-slate-500">
              Your account is registered, but profile setup is still required.
            </p>
            <form onSubmit={createProfile} className="mt-5 grid gap-4 sm:grid-cols-2">
              {([
                ["firstName", "First name", "text"],
                ["lastName", "Last name", "text"],
                ["phone", "Phone number", "tel"],
                ["nic", "Sri Lankan NIC", "text"],
                ["dateOfBirth", "Date of birth", "date"],
              ] as const).map(([name, label, type]) => (
                <label key={name} className="text-sm font-medium">
                  {label}
                  <input
                    className="field"
                    name={name}
                    type={type}
                    value={form[name]}
                    onChange={update}
                    required={name === "firstName" || name === "lastName"}
                  />
                </label>
              ))}
              <label className="text-sm font-medium">
                Gender
                <input className="field" name="gender" value={form.gender} onChange={update} />
              </label>
              {error && <p role="alert" className="text-sm text-red-700 sm:col-span-2">{error}</p>}
              {message && <p role="status" className="text-sm text-green-700 sm:col-span-2">{message}</p>}
              <button className="primary-button sm:col-span-2" disabled={saving}>
                {saving ? "Saving profile..." : "Create patient profile"}
              </button>
            </form>
            <p className="mt-4 text-xs text-slate-500">
              The backend does not currently store address information.
            </p>
          </>
        )}
        {error && hasProfile && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
      </div>
    </Workspace>
  );
}
