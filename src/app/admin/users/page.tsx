"use client";

import { useEffect, useState, type FormEvent } from "react";
import Workspace from "@/components/common/workspace";
import { apiRequest } from "@/lib/api";

type Specialisation = {
  id: string;
  name: string;
};

type DoctorCreated = {
  message: string;
  doctorId: string;
  userId: string;
  email: string;
  accountStatus: string;
  registrationNumber: string;
};

export default function AdminUsers() {
  const [specialisations, setSpecialisations] = useState<Specialisation[]>([]);
  const [loadingSpecialisations, setLoadingSpecialisations] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<DoctorCreated | null>(null);

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [qualification, setQualification] = useState("");
  const [specialisationId, setSpecialisationId] = useState("");
  const [consultationFee, setConsultationFee] = useState("0");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    let active = true;
    apiRequest<Specialisation[]>("specialisations")
      .then((items) => {
        if (active) {
          setSpecialisations(items);
          if (items.length > 0) setSpecialisationId(items[0].id);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Unable to load specialisations.");
        }
      })
      .finally(() => {
        if (active) setLoadingSpecialisations(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function activateCreatedDoctor() {
    if (!success) return;
    setError("");
    setActivating(true);
    try {
      const activated = await apiRequest<{ accountStatus: string }>(
        `admin/users/${success.userId}/activate`,
        { method: "PATCH" }
      );
      setSuccess({ ...success, accountStatus: activated.accountStatus });
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "The doctor was created but could not be activated.");
    } finally {
      setActivating(false);
    }
  }

  async function createDoctor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess(null);

    if (
      newPassword.length < 8 ||
      !/[A-Za-z]/.test(newPassword) ||
      !/\d/.test(newPassword) ||
      !/[^A-Za-z0-9]/.test(newPassword)
    ) {
      setError(
        "The password must contain at least 8 characters, including a letter, a number and a symbol."
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("The password and confirmation do not match.");
      return;
    }
    if (new TextEncoder().encode(newPassword).length > 72) {
      setError("The password must not exceed 72 UTF-8 bytes.");
      return;
    }
    if (!specialisationId) {
      setError("Select a specialisation before creating the doctor.");
      return;
    }

    setSubmitting(true);
    try {
      const created = await apiRequest<DoctorCreated>("doctors", {
        method: "POST",
        body: JSON.stringify({
          email,
          firstName,
          lastName,
          registrationNumber,
          qualification: qualification || null,
          specialisationId,
          consultationFee: Number(consultationFee),
          initialPassword: newPassword,
          confirmPassword,
        }),
      });
      setSuccess(created);
      setEmail("");
      setFirstName("");
      setLastName("");
      setRegistrationNumber("");
      setQualification("");
      setConsultationFee("0");
      setNewPassword("");
      setConfirmPassword("");
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Unable to create the doctor account.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Workspace
      role="admin"
      title="Staff Accounts"
      description="Create and manage doctor accounts securely."
    >
      <div className="space-y-6">
        <section className="card">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-slate-900">Create a doctor account</h2>
            <p className="mt-1 text-sm text-slate-500">
              Enter the doctor&apos;s professional details and set an initial password.
              The password is securely hashed by the backend before it is stored.
            </p>
          </div>

          {error && (
            <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {success && (
            <div role="status" className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">
              <p className="font-semibold">Doctor account created successfully.</p>
              <p className="mt-1">{success.message}</p>
              <p className="mt-2">Email: {success.email}</p>
              <p>Registration number: {success.registrationNumber}</p>
              <p>Account status: <strong>{success.accountStatus}</strong></p>
              {success.accountStatus === "PENDING" ? (
                <div className="mt-3">
                  <p className="mb-3 text-xs">The doctor cannot sign in until an administrator activates this account.</p>
                  <button type="button" onClick={() => void activateCreatedDoctor()} disabled={activating} className="primary-button disabled:opacity-60">
                    {activating ? "Activating account…" : "Activate doctor account"}
                  </button>
                </div>
              ) : (
                <p className="mt-2 text-xs">The account is active. The doctor can now sign in using the email address and password set above.</p>
              )}
            </div>
          )}

          <form onSubmit={createDoctor} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">
                First name
                <input required maxLength={100} value={firstName} onChange={(e) => setFirstName(e.target.value)} className="field w-full" autoComplete="given-name" />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Last name
                <input required maxLength={100} value={lastName} onChange={(e) => setLastName(e.target.value)} className="field w-full" autoComplete="family-name" />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Email address
                <input required type="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} className="field w-full" autoComplete="email" />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Medical registration number
                <input required maxLength={100} value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} className="field w-full" />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Qualification
                <input maxLength={255} value={qualification} onChange={(e) => setQualification(e.target.value)} className="field w-full" placeholder="e.g. MBBS, MD" />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Specialisation
                <select required value={specialisationId} onChange={(e) => setSpecialisationId(e.target.value)} disabled={loadingSpecialisations || specialisations.length === 0} className="field w-full">
                  {loadingSpecialisations ? <option value="">Loading specialisations…</option> : null}
                  {!loadingSpecialisations && specialisations.length === 0 ? <option value="">No active specialisations found</option> : null}
                  {specialisations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
              <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
                Consultation fee (LKR)
                <input required type="number" min="0" step="0.01" value={consultationFee} onChange={(e) => setConsultationFee(e.target.value)} className="field w-full sm:max-w-sm" />
              </label>
            </div>

            <div className="border-t border-slate-200 pt-5">
              <h3 className="font-semibold text-slate-900">Initial login password</h3>
              <p className="mt-1 text-sm text-slate-500">
                Use at least 8 characters, including a letter, a number and a symbol. For
                compatibility with the current BCrypt configuration, the UTF-8 encoded
                password must not exceed 72 bytes.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">
                  New password
                  <input required type="password" minLength={8} maxLength={72} autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="field w-full" />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Confirm password
                  <input required type="password" minLength={8} maxLength={72} autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="field w-full" />
                </label>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" disabled={submitting || loadingSpecialisations || specialisations.length === 0} className="primary-button disabled:cursor-not-allowed disabled:opacity-60">
                {submitting ? "Creating doctor…" : "Create doctor account"}
              </button>
              <p className="text-xs text-slate-500">Passwords are never displayed again or returned by the API.</p>
            </div>
          </form>
        </section>

        <section className="card">
          <h2 className="text-lg font-bold text-slate-900">Account security</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-600">
            <li>Only authenticated administrators and managers can call the doctor-creation endpoint.</li>
            <li>The backend validates the password and confirmation independently.</li>
            <li>Passwords are stored as salted BCrypt hashes (work factor 12), never as plaintext or reversible AES-GCM ciphertext.</li>
            <li>Use the deployed HTTPS site; do not send passwords through email, chat, or logs.</li>
          </ul>
        </section>
      </div>
    </Workspace>
  );
}
