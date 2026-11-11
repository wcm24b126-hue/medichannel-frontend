import Workspace from "@/components/common/workspace";

export default function DoctorConsultation() {
  return (
    <Workspace role="doctor" title="Consultations" description="Manage online consultations and clinical records.">
      <div className="card">
        <h2 className="text-lg font-bold">Consultation Workspace</h2>
        <p className="mt-2 text-sm text-slate-500">
          The treating doctor can communicate with the patient and save the
          diagnosis summary, advice and prescription.
        </p>
        <p className="mt-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
          Medical notes and chat must only be accessible to the patient and
          their treating doctor. Managers and administrators must not access them.
        </p>
      </div>
    </Workspace>
  );
}
