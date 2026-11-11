import Workspace from "@/components/common/workspace";

export default function ManagerSessions() {
  return (
    <Workspace role="manager" title="Manage Sessions" description="Create and manage hospital channelling sessions.">
      <div className="card">
        <h2 className="text-lg font-bold">Session Management</h2>
        <p className="mt-2 text-sm text-slate-500">
          Create, edit, delay and cancel physical or online sessions.
          Session capacity and booking rules must be enforced by the backend.
        </p>
      </div>
    </Workspace>
  );
}
