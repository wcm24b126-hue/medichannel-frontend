import Link from "next/link";
import type { ReactNode } from "react";

type Item = {
  label: string;
  href: string;
};

const navigation: Record<string, Item[]> = {
  patient: [
    { label: "My Appointments", href: "/appointments" },
    { label: "Find Doctors", href: "/doctors" },
    { label: "My Profile", href: "/profile" },
    { label: "Consultation", href: "/consultation" },
  ],
  doctor: [
    { label: "Dashboard", href: "/doctor/dashboard" },
    { label: "My Sessions", href: "/doctor/sessions" },
    { label: "Consultations", href: "/doctor/consultation" },
  ],
  manager: [
    { label: "Dashboard", href: "/manager/dashboard" },
    { label: "Doctors", href: "/manager/doctors" },
    { label: "Sessions", href: "/manager/sessions" },
    { label: "Reception", href: "/manager/reception" },
    { label: "Reports", href: "/manager/reports" },
  ],
  admin: [
    { label: "Dashboard", href: "/admin/dashboard" },
    { label: "Staff Accounts", href: "/admin/users" },
    { label: "Audit Logs", href: "/admin/audit-logs" },
  ],
};

export default function Workspace({
  role,
  title,
  description,
  children,
}: {
  role: "patient" | "doctor" | "manager" | "admin";
  title: string;
  description: string;
  children?: ReactNode;
}) {
  const items = navigation[role];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-white px-4 py-3 sm:gap-4 sm:px-6 sm:py-4">
        <Link href="/" className="text-lg font-extrabold text-blue-700 sm:text-xl">
          MediChannel
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <span className="rounded-full bg-blue-50 px-3 py-1 font-semibold uppercase text-blue-700">
            {role}
          </span>
          <form action="/api/auth/logout" method="post">
            <button className="text-slate-600 hover:text-red-600">
              Logout
            </button>
          </form>
        </div>
      </header>

      <div className="mx-auto grid min-w-0 max-w-7xl gap-4 px-3 py-5 sm:gap-6 sm:px-4 sm:py-7 md:grid-cols-[230px_1fr]">
        <aside className="card h-fit min-w-0">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400 md:mb-4">
            Navigation
          </p>
          <nav className="flex min-w-0 max-w-full gap-2 overflow-x-auto pb-1 md:flex-col md:overflow-visible md:pb-0">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700 md:py-3"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <main className="min-w-0">
          <div className="mb-7">
            <h1 className="page-title">{title}</h1>
            <p className="mt-2 text-sm text-slate-500">{description}</p>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
