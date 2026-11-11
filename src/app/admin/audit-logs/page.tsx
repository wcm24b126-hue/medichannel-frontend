import Workspace from "@/components/common/workspace";

export default function AuditLogs() {
  return (
    <Workspace role="admin" title="Audit Logs" description="Review administrative and system activity.">
      <div className="card">
        <h2 className="text-lg font-bold">System Audit History</h2>
        <p className="mt-2 text-sm text-slate-500">
          Audit events will be loaded from the audit log API.
        </p>
        <p className="mt-4 text-sm text-amber-800">
          Audit records must not contain passwords, authentication tokens,
          personal medical details or consultation messages.
        </p>
      </div>
    </Workspace>
  );
}
