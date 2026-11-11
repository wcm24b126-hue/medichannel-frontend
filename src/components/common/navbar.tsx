import Link from "next/link";

export default function Navbar() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="container-main flex min-h-18 items-center justify-between gap-4">
        <Link href="/" className="text-2xl font-extrabold text-blue-700">
          MediChannel
        </Link>

        <nav className="flex flex-wrap items-center gap-5 text-sm font-medium text-slate-700">
          <Link href="/">Home</Link>
          <Link href="/doctors">Find Doctors</Link>
          <Link href="/appointments">Appointments</Link>
          <Link href="/login">Login</Link>
          <Link
            href="/register"
            className="rounded-lg bg-blue-600 px-4 py-2 text-white"
          >
            Register
          </Link>
        </nav>
      </div>
    </header>
  );
}
