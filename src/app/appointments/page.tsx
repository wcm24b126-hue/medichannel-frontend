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

type PagedResponse<T> = {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
};

function canCancel(appointment: Appointment) {
  if (!appointment.sessionDate) return false;
  const start = new Date(
    `${appointment.sessionDate}T${appointment.sessionStartTime || "00:00"}:00`
  );
  return !Number.isNaN(start.getTime()) && Date.now() < start.getTime() - 3 * 60 * 60 * 1000;
}

function periodForStart(startTime: string) {
  const start = String(startTime || "").slice(0, 5);
  if (start === "07:00") return "MORNING";
  if (start === "13:00") return "EVENING";
  return "";
}

function isClinicBreakNow() {
  const clock = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Colombo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
  return clock >= "11:00" && clock < "13:00";
}

export default function AppointmentsPage() {
  const [activeAppointments, setActiveAppointments] = useState<Appointment[]>([]);
  const [historyAppointments, setHistoryAppointments] = useState<Appointment[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [historyTotalElements, setHistoryTotalElements] = useState(0);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [period, setPeriod] = useState("");
  const [reason, setReason] = useState("");
  const [today, setToday] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const fetchAppData = useCallback(
    (signal?: AbortSignal, targetPage = page) =>
      Promise.all([
        apiRequest<Appointment[]>("appointments/me/active", { signal }),
        apiRequest<PagedResponse<Appointment>>(
          `appointments/me/history?page=${targetPage}&size=20`,
          { signal }
        ),
        apiRequest<Session[]>("sessions", { signal }),
      ]),
    [page]
  );

  const applyAppointmentsPayload = useCallback(
    (activeRows: Appointment[], historyPayload: PagedResponse<Appointment>) => {
      setActiveAppointments(Array.isArray(activeRows) ? activeRows : []);
      setHistoryAppointments(
        Array.isArray(historyPayload?.content) ? historyPayload.content : []
      );
      setPage(Number.isFinite(historyPayload?.page) ? historyPayload.page : 0);
      setTotalPages(Math.max(1, Number(historyPayload?.totalPages) || 1));
      setHistoryTotalElements(Number(historyPayload?.totalElements) || 0);
    },
    []
  );

  const loadData = useCallback(
    async (targetPage = page) => {
      setError("");
      try {
        const [activeRows, historyPayload, sessionRows] = await fetchAppData(
          undefined,
          targetPage
        );
        applyAppointmentsPayload(activeRows, historyPayload);
        setSessions(sessionRows);
        setToday(new Date().toISOString().slice(0, 10));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Unable to load appointments.");
      } finally {
        setLoading(false);
      }
    },
    [applyAppointmentsPayload, fetchAppData, page]
  );

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    fetchAppData(controller.signal)
      .then(([activeRows, historyPayload, sessionRows]) => {
        if (!active) return;
        applyAppointmentsPayload(activeRows, historyPayload);
        setSessions(sessionRows);
        setToday(new Date().toISOString().slice(0, 10));
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "Unable to load appointments.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [applyAppointmentsPayload, fetchAppData]);

  const availableSessions = useMemo(() => {
    if (!today) return [];
    return sessions.filter(
      (session) =>
        session.sessionDate >= today &&
        session.remainingAppointments > 0 &&
        ["OPEN", "SCHEDULED"].includes(session.status)
    );
  }, [sessions, today]);

  const activePendingPaymentCount = activeAppointments.filter(
    (appointment) => appointment.paymentStatus === "PENDING"
  ).length;

  async function bookAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const selectedSession = sessions.find((item) => item.sessionId === sessionId);

    if (!period) {
      setError("Please choose Morning or Evening for this booking.");
      setSaving(false);
      return;
    }
    if (period !== periodForStart(selectedSession?.startTime || "")) {
      setError("The selected period does not match this session.");
      setSaving(false);
      return;
    }
    if (isClinicBreakNow()) {
      setError("No appointment numbers are issued during the 11:00–13:00 break.");
      setSaving(false);
      return;
    }

    setSaving(true);
    try {
      const created = await apiRequest<Appointment>("appointments", {
        method: "POST",
        body: JSON.stringify({ sessionId, reason, period }),
      });
      setMessage(`Appointment booked: ${created.bookingReference}`);
      setReason("");
      setPeriod("");
      setSessionId("");
      await loadData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to book appointment.");
    } finally {
      setSaving(false);
    }
  }

  async function payAppointment(appointmentId: string) {
    setError("");
    setMessage("");
    try {
      await apiRequest(`appointments/${appointmentId}/payments`, {
        method: "POST",
        body: JSON.stringify({ method: "CARD" }),
      });
      setMessage("Payment recorded.");
      await loadData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to record payment.");
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
        <div className="card"><p className="text-sm text-slate-500">Active appointments</p><p className="mt-2 text-2xl font-bold">{activeAppointments.length}</p></div>
        <div className="card"><p className="text-sm text-slate-500">Closed history</p><p className="mt-2 text-2xl font-bold">{historyTotalElements}</p></div>
        <div className="card"><p className="text-sm text-slate-500">Active pending payments</p><p className="mt-2 text-2xl font-bold">{activePendingPaymentCount}</p></div>
      </div>

      <section className="card mt-6">
        <h2 className="text-lg font-bold">Book an Appointment</h2>
        <form onSubmit={bookAppointment} className="mt-4 grid gap-4">
          <label className="text-sm font-medium">
            Available session
            <select
              className="field"
              value={sessionId}
              onChange={(event) => {
                const nextId = event.target.value;
                setSessionId(nextId);
                setPeriod(
                  periodForStart(
                    sessions.find((item) => item.sessionId === nextId)?.startTime || ""
                  )
                );
              }}
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
            Time period
            <select
              className="field"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              required
            >
              <option value="">Choose a period</option>
              <option value="MORNING">Morning · 07:00 – 11:00</option>
              <option value="EVENING">Evening · 13:00 – 15:00</option>
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
          <button className="primary-button sm:w-fit" disabled={saving || !sessionId || !period || isClinicBreakNow()}>
            {saving ? "Booking..." : "Book appointment"}
          </button>
        </form>
        {!loading && availableSessions.length === 0 && (
          <p className="mt-3 text-sm text-slate-500">No future sessions with availability were returned by the backend.</p>
        )}
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-lg font-bold">Active &amp; Upcoming Appointments</h2>
        {loading && <p role="status" className="muted">Loading appointments...</p>}
        {!loading && !error && activeAppointments.length === 0 && (
          <p className="card text-slate-500">You have no active or upcoming appointments.</p>
        )}
        <div className="grid gap-4">
          {activeAppointments.map((appointment) => (
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
              <div className="mt-4 flex flex-wrap gap-3">
                {appointment.paymentStatus === "PENDING" &&
                  ["BOOKED", "ARRIVED"].includes(appointment.status) && (
                    <button className="secondary-button" onClick={() => void payAppointment(appointment.appointmentId)}>
                      Pay now
                    </button>
                  )}
                {appointment.consultationType === "PHYSICAL" &&
                  appointment.status === "BOOKED" &&
                  appointment.paymentStatus === "PAID" && (
                    <button className="secondary-button" onClick={() => void updateAppointment(appointment.appointmentId, "check-in")}>
                      Check in
                    </button>
                  )}
                {appointment.status === "BOOKED" &&
                  appointment.paymentStatus === "PENDING" &&
                  canCancel(appointment) && (
                    <button className="text-sm font-semibold text-red-700" onClick={() => void updateAppointment(appointment.appointmentId, "cancel")}>
                      Cancel appointment
                    </button>
                  )}
                {(appointment.status === "IN_CONSULTATION" ||
                  appointment.status === "COMPLETED") && (
                  <a
                    className="text-sm font-semibold text-blue-700 underline"
                    href={`/mediclinic-system.html#consult-${appointment.appointmentId}`}
                  >
                    {appointment.consultationType === "ONLINE" &&
                    appointment.status === "IN_CONSULTATION"
                      ? "Join online consultation"
                      : "Open consultation"}
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-lg font-bold">Closed Appointment History</h2>
        {!loading && !error && historyAppointments.length === 0 && (
          <p className="card text-slate-500">No closed appointment history was returned for your account.</p>
        )}
        <div className="grid gap-4">
          {historyAppointments.map((appointment) => (
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
              <div className="mt-4 flex flex-wrap gap-3">
                {appointment.status === "COMPLETED" && (
                  <a
                    className="text-sm font-semibold text-blue-700 underline"
                    href={`/mediclinic-system.html#consult-${appointment.appointmentId}`}
                  >
                    Open consultation
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
        {!loading && historyTotalElements > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3 text-xs">
            <span className="text-slate-500">
              History page {page + 1} of {totalPages} ({historyTotalElements} total)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="secondary-button"
                disabled={page <= 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Previous
              </button>
              <button
                type="button"
                className="secondary-button"
                disabled={page + 1 >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
        <p className="mt-4 text-sm text-slate-500">
          Follow your live queue number, now-serving update and notifications in the{" "}
          <a className="font-semibold text-blue-700 underline" href="/mediclinic-system.html#appointments">
            full patient appointments view
          </a>
          .
        </p>
      </section>

      {message && <p role="status" className="mt-4 text-sm text-green-700">{message}</p>}
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    </Workspace>
  );
}
