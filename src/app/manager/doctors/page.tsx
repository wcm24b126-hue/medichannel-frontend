import Workspace from "@/components/common/workspace";

export default function ManagerDoctors() {
  return (
    <Workspace role="manager" title="Manage Doctors" description="Manage doctor profiles and specialisations.">
      <div className="card">
        <h2 className="text-lg font-bold">Doctor Management</h2>
        <p className="mt-2 text-sm text-slate-500">
          This area will connect to the doctor management API.
        </p>
        <p className="mt-4 text-sm text-slate-500">
          Manage doctor name, SLMC registration number, specialisation,
          qualifications, consultation fee and biography.
        </p>
      </div>
    </Workspace>
  );
}
