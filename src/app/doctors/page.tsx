import PublicLayout from "@/components/common/public-layout";
import DoctorSearch from "@/components/doctors/doctor-search";

export default function DoctorsPage() {
  return (
    <PublicLayout>
      <h1 className="page-title">Find a Doctor</h1>
      <p className="mb-7 mt-2 text-slate-500">
        Search for doctors by name or specialisation.
      </p>
      <DoctorSearch />
    </PublicLayout>
  );
}
