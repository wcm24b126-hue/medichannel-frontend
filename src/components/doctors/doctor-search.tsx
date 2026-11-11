"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
type DoctorResponse = {
  doctorId: string;
  firstName: string;
  lastName: string;
  qualification: string | null;
  biography: string | null;
  specialisation: string;
  consultationFee: number | null;
  available: boolean;
};

type Doctor = {
  id: string;
  fullName: string;
  specialisation: string;
  qualifications: string | null;
  fee: number | null;
  bio: string | null;
  available: boolean;
};

export default function DoctorSearch() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiRequest<DoctorResponse[]>("doctors")
      .then((rows) =>
        setDoctors(
          rows.map((doctor) => ({
            id: doctor.doctorId,
            fullName: `${doctor.firstName} ${doctor.lastName}`,
            specialisation: doctor.specialisation,
            qualifications: doctor.qualification,
            fee: doctor.consultationFee,
            bio: doctor.biography,
            available: doctor.available,
          }))
        )
      )
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : "Could not load doctors.")
      )
      .finally(() => setLoading(false));
  }, []);

  const filtered = doctors.filter((doctor) =>
    `${doctor.fullName} ${doctor.specialisation}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <div>
      <input
        className="field mb-6"
        placeholder="Search doctor or specialisation..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />

      {loading && <p className="muted">Loading doctors...</p>}
      {error && <p className="rounded-lg bg-red-50 p-4 text-red-700">{error}</p>}

      {!loading && !error && filtered.length === 0 && (
        <p className="card text-slate-500">No doctors found.</p>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        {filtered.map((doctor) => (
          <article className="card" key={doctor.id}>
            <h2 className="text-lg font-bold">{doctor.fullName}</h2>
            <p className="mt-1 text-sm text-blue-700">
              {doctor.specialisation}
            </p>
            <p className="mt-3 text-sm text-slate-500">
              {doctor.qualifications || "Qualifications not provided"}
            </p>
            <p className="mt-4 font-bold">
              {doctor.fee === null
                ? "Consultation fee not set"
                : `LKR ${doctor.fee.toLocaleString()}`}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              {doctor.bio || ""}
            </p>
            {!doctor.available && (
              <p className="mt-2 text-sm font-medium text-amber-700">Not currently available</p>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
