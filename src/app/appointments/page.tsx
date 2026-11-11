"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Workspace from "@/components/common/workspace";
import { apiRequest } from "@/lib/api";

type Session = {
  sessionId: string;
  doctorName: string;
  specialisation: string;
  sessionDate: string;
  startTime: string;
  consultationType: "PHYSICAL" | "ONLINE";
  roomNumber: string | null;
  remainingAppointments: number;
  feeLkr: number;
  status: string;
};

type Appointment = {
  appointmentId: string;
  bookingReference: string;
  sessionId: string;
  appointmentNumber: number;
  sessionDate: string;
  sessionStartTime: string;
  estimatedConsultationTime: string | null;
  status: string;
  paymentStatus: string;
  consultationFeeLkr: number;
  doctorName: string;
  specialisation: string;
  consultationType: "PHYSICAL" | "ONLINE";
  roomNumber: string | null;
};

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [reason, setReason] = useState("");
  const [today, setToday] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadData = useCallback(async () => {
    setError("");
    try {
      const [appointmentRows, sessionRows] = await Promise.all([
        apiRequest<Appointment[]>("appointments/me"),
        apiRequest<Session[]>("sessions"),
      ]);
      setAppointments(appointmentRows);
      setSessions(sessionRows);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load appointments.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([
      apiRequest<Appointment[]>("appointments/me"),
      apiRequest<Session[]>("sessions"),
    ])
      .then(([appointmentRows, sessionRows]) => {
        if (!active) return;
        setAppointments(appointmentRows);
        setSessions(sessionRows);
        setToday(new Date().toISOString().slice(0, 10));
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error ? cause.message : "Unable to load appointments."
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const availableSessions = useMemo(() => {
    if (!today) return [];
    return sessions.filter(
      (session) =>
        session.sessionDate >= today &&
        session.remainingAppointments > 0 &&
        ["OPEN", "SCHEDULED"].includes(session.status)
    );
  }, [sessions, today]);

  const completedCount = appointments.filter(
    (appointment) => appointment.status === "COMPLETED"
  ).length;
  const pendingPaymentCount = appointments.filter(
    (appointment) => appointment.paymentStatus === "PENDING"
  ).length;

  async function bookAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);
    try {
      const created = await apiRequest<Appointment>("appointments", {
        method: "POST",
        body: JSON.stringify({ sessionId, reason }),
      });
      setMessage(`Appointment booked: ${created.bookingReference}`);
      setReason("");
      setSessionId("");
      await loadData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to book appointment.");
    } finally {
      setSaving(false);
    }
  }

  async function updateAppointment(
    appointmentId: string,
    action: "cancel" | "check-in"
  ) {
    setError("");
    setMessage("");
    try {
      await apiRequest<Appointment>(`appointments/${appointmentId}/${action}`, {
        method: "PATCH",
      });
      setMessage(action === "cancel" ? "Appointment cancelled." : "Check-in completed.");
      await loadData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update appointment.");
    }
  }

  return (
    <Workspace
      role="patient"
      title="My Appointments"
      description="Book and manage your hospital appointments."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card"><p className="text-sm text-slate-500">Appointments</p><p className="mt-2 text-2xl font-bold">{appointments.length}</p></div>
        <div className="card"><p className="text-sm text-slate-500">Completed</p><p className="mt-2 text-2xl font-bold">{completedCount}</p></div>
        <div className="card"><p className="text-sm text-slate-500">Pending payments</p><p className="mt-2 text-2xl font-bold">{pendingPaymentCount}</p></div>
      </div>

      <section className="card mt-6">
        <h2 className="text-lg font-bold">Book an Appointment</h2>
        <form onSubmit={bookAppointment} className="mt-4 grid gap-4">
          <label className="text-sm font-medium">
            Available session
            <select
              className="field"
              value={sessionId}
              onChange={(event) => setSessionId(event.target.value)}
              required
              disabled={availableSessions.length === 0}
            >
              <option value="">Select a session</option>
              {availableSessions.map((session) => (
                <option key={session.sessionId} value={session.sessionId}>
                  {session.doctorName} · {session.specialisation} · {session.sessionDate} {session.startTime} · {session.consultationType} · LKR {session.feeLkr}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            Reason for visit
            <textarea
              className="field min-h-24"
              maxLength={2000}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              required
            />
          </label>
          <button className="primary-button sm:w-fit" disabled={saving || !sessionId}>
            {saving ? "Booking..." : "Book appointment"}
          </button>
        </form>
        {!loading && availableSessions.length === 0 && (
          <p className="mt-3 text-sm text-slate-500">No future sessions with availability were returned by the backend.</p>
        )}
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-lg font-bold">Appointment History</h2>
        {loading && <p role="status" className="muted">Loading appointments...</p>}
        {!loading && !error && appointments.length === 0 && (
          <p className="card text-slate-500">No appointments were returned for your account.</p>
        )}
        <div className="grid gap-4">
          {appointments.map((appointment) => (
            <article className="card" key={appointment.appointmentId}>
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <h3 className="font-bold">{appointment.doctorName}</h3>
                  <p className="text-sm text-blue-700">{appointment.specialisation}</p>
                  <p className="mt-2 text-sm text-slate-600">
                    {appointment.sessionDate} at {appointment.sessionStartTime}
                    {appointment.roomNumber ? ` · Room ${appointment.roomNumber}` : " · Online"}
                  </p>
                </div>
                <div className="text-sm">
                  <p>Ref: {appointment.bookingReference}</p>
                  <p>Appointment no. {appointment.appointmentNumber}</p>
                  <p>Status: {appointment.status}</p>
                  <p>Payment: {appointment.paymentStatus}</p>
                </div>
              </div>
              {["BOOKED", "ARRIVED"].includes(appointment.status) && (
                <div className="mt-4 flex flex-wrap gap-3">
                  {appointment.status === "BOOKED" && (
                    <button className="secondary-button" onClick={() => updateAppointment(appointment.appointmentId, "check-in")}>
                      Check in
                    </button>
                  )}
                  <button className="text-sm font-semibold text-red-700" onClick={() => updateAppointment(appointment.appointmentId, "cancel")}>
                    Cancel appointment
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
        <p className="mt-4 text-sm text-slate-500">
          Live queue position and estimated wait time are not currently exposed by a patient queue API.
        </p>
      </section>

      {message && <p role="status" className="mt-4 text-sm text-green-700">{message}</p>}
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    </Workspace>
  );
}
