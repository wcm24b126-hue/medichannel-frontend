"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import type { Doctor } from "@/types";

export default function DoctorSearch() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiRequest<Doctor[]>("doctors")
      .then(setDoctors)
      .catch(() => setError("Could not load doctors. Check that the backend is running."))
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
              LKR {doctor.fee.toLocaleString()}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              {doctor.bio || ""}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
