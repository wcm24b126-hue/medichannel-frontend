import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MediClinic · Lanka Care Hospital",
  description:
    "Book hospital appointments, follow your queue and consult with Lanka Care Hospital.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
