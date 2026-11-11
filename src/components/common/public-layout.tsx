import type { ReactNode } from "react";
import Navbar from "./navbar";
import Footer from "./footer";

export default function PublicLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <Navbar />
      <main className="container-main min-h-[70vh] py-10">
        {children}
      </main>
      <Footer />
    </>
  );
}
