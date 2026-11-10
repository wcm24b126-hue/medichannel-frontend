import Workspace from "@/components/common/workspace";

export default function ReceptionPage() {
  return (
    <Workspace role="manager" title="Reception" description="Manage today's appointments and patient check-ins.">
      <div className="card">
        <h2 className="text-lg font-bold">Reception Management</h2>
        <p className="mt-2 text-sm text-slate-500">
          Search today&apos;s appointments, mark patients as arrived, record
          payments and register walk-in bookings.
        </p>
        <p className="mt-4 text-sm text-slate-500">
          Payment methods: CASH or CARD. Payment statuses: PENDING or PAID.
        </p>
      </div>
    </Workspace>
  );
}
