"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";

type AdminStats = {
  totalUsers: number;
  totalDoctors: number;
  totalPatients: number;
  totalAppointments: number;
  bookedAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  noShowAppointments: number;
  completedPayments: number;
  completedPaymentTotalLkr: number;
};

const countFields = [
  "totalUsers",
  "totalDoctors",
  "totalPatients",
  "totalAppointments",
  "bookedAppointments",
  "completedAppointments",
  "cancelledAppointments",
  "noShowAppointments",
  "completedPayments",
] as const;

const numberFormatter = new Intl.NumberFormat("en-LK");
const currencyFormatter = new Intl.NumberFormat("en-LK", {
  style: "currency",
  currency: "LKR",
  maximumFractionDigits: 2,
});

function parseAdminStats(value: unknown): AdminStats {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("The backend returned invalid dashboard statistics.");
  }

  const record = value as Record<string, unknown>;
  for (const field of countFields) {
    if (
      typeof record[field] !== "number" ||
      !Number.isSafeInteger(record[field]) ||
      record[field] < 0
    ) {
      throw new Error("The backend returned invalid dashboard statistics.");
    }
  }

  if (
    typeof record.completedPaymentTotalLkr !== "number" ||
    !Number.isFinite(record.completedPaymentTotalLkr) ||
    record.completedPaymentTotalLkr < 0
  ) {
    throw new Error("The backend returned invalid dashboard statistics.");
  }

  return record as AdminStats;
}

async function fetchAdminStats(): Promise<AdminStats> {
  const response = await apiRequest<unknown>("admin/stats");
  return parseAdminStats(response);
}

function getErrorMessage(cause: unknown): string {
  return cause instanceof Error
    ? cause.message
    : "Unable to load administrator dashboard statistics.";
}

function MetricCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: number;
  detail: string;
  tone: "blue" | "teal" | "violet" | "amber";
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    teal: "bg-teal-50 text-teal-700",
    violet: "bg-violet-50 text-violet-700",
    amber: "bg-amber-50 text-amber-700",
  };

  return (
    <article className="card">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tones[tone]}`}>
          Live
        </span>
      </div>
      <p className="mt-5 text-3xl font-bold tracking-tight text-slate-950">
        {numberFormatter.format(value)}
      </p>
      <p className="mt-2 text-sm text-slate-500">{detail}</p>
    </article>
  );
}

export default function AdminDashboardContent() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setStats(await fetchAdminStats());
    } catch (cause: unknown) {
      setError(getErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchAdminStats()
      .then((nextStats) => {
        if (active) setStats(nextStats);
      })
      .catch((cause: unknown) => {
        if (active) setError(getErrorMessage(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const appointmentStatuses = stats
    ? [
        { label: "Booked", count: stats.bookedAppointments, color: "bg-blue-600" },
        { label: "Completed", count: stats.completedAppointments, color: "bg-teal-600" },
        { label: "Cancelled", count: stats.cancelledAppointments, color: "bg-amber-500" },
        { label: "No-show", count: stats.noShowAppointments, color: "bg-rose-500" },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
            System overview
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Live totals from the MediChannel backend.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadStats()}
          disabled={loading}
          className="secondary-button disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Refreshing…" : "Refresh data"}
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void loadStats()}
            disabled={loading}
            className="font-semibold underline underline-offset-2 disabled:opacity-60"
          >
            Try again
          </button>
        </div>
      )}

      {loading && !stats ? (
        <p className="card text-sm text-slate-500" role="status" aria-live="polite">
          Loading live dashboard data…
        </p>
      ) : stats ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="System totals">
            <MetricCard
              label="Registered accounts"
              value={stats.totalUsers}
              detail="Across all account roles"
              tone="blue"
            />
            <MetricCard
              label="Doctors"
              value={stats.totalDoctors}
              detail="Doctor profiles in the system"
              tone="teal"
            />
            <MetricCard
              label="Patients"
              value={stats.totalPatients}
              detail="Patient profiles in the system"
              tone="violet"
            />
            <MetricCard
              label="Appointments"
              value={stats.totalAppointments}
              detail="All recorded appointments"
              tone="amber"
            />
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
            <article className="card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Appointment activity
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Current totals by appointment status.
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
                  {numberFormatter.format(stats.totalAppointments)} total
                </span>
              </div>

              <div className="mt-6 space-y-5">
                {appointmentStatuses.map((status) => {
                  const percentage =
                    stats.totalAppointments === 0
                      ? 0
                      : Math.min(
                          (status.count / stats.totalAppointments) * 100,
                          100
                        );

                  return (
                    <div key={status.label}>
                      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium text-slate-700">{status.label}</span>
                        <span className="tabular-nums text-slate-500">
                          {numberFormatter.format(status.count)}
                        </span>
                      </div>
                      <div
                        className="h-2 overflow-hidden rounded-full bg-slate-100"
                        role="meter"
                        aria-label={`${status.label} appointments`}
                        aria-valuemin={0}
                        aria-valuemax={Math.max(stats.totalAppointments, 1)}
                        aria-valuenow={Math.min(
                          status.count,
                          stats.totalAppointments
                        )}
                      >
                        <div
                          className={`h-full rounded-full ${status.color}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>

            <article className="card flex flex-col">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">
                  Payments
                </p>
                <h2 className="mt-2 text-lg font-bold text-slate-900">
                  Completed transactions
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Successfully completed payments recorded by the backend.
                </p>
              </div>
              <p className="mt-7 text-3xl font-bold tracking-tight text-slate-950">
                {currencyFormatter.format(stats.completedPaymentTotalLkr)}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                {numberFormatter.format(stats.completedPayments)} completed{" "}
                {stats.completedPayments === 1 ? "payment" : "payments"}
              </p>
            </article>
          </section>

          <section className="grid gap-4 md:grid-cols-2" aria-label="Administration links">
            <Link
              href="/admin/users"
              className="card transition-colors hover:border-blue-200 hover:bg-blue-50/40"
            >
              <h2 className="font-bold text-slate-900">Staff accounts</h2>
              <p className="mt-2 text-sm text-slate-500">
                Review and manage doctor and manager accounts.
              </p>
              <span className="mt-4 inline-block text-sm font-semibold text-blue-700">
                Open account management →
              </span>
            </Link>
            <Link
              href="/admin/audit-logs"
              className="card transition-colors hover:border-blue-200 hover:bg-blue-50/40"
            >
              <h2 className="font-bold text-slate-900">Audit logs</h2>
              <p className="mt-2 text-sm text-slate-500">
                Open the administrative activity page.
              </p>
              <span className="mt-4 inline-block text-sm font-semibold text-blue-700">
                View audit logs →
              </span>
            </Link>
          </section>
        </>
      ) : !error ? (
        <p className="card text-sm text-slate-500">
          Dashboard statistics are not available.
        </p>
      ) : null}
    </div>
  );
}
