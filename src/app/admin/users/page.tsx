import Workspace from "@/components/common/workspace";

export default function AdminUsers() {
  return (
    <Workspace role="admin" title="Staff Accounts" description="Create and manage doctor and manager accounts.">
      <div className="card">
        <h2 className="text-lg font-bold">Staff Account Management</h2>
        <p className="mt-2 text-sm text-slate-500">
          Administrators can create DOCTOR and MANAGER accounts, activate or
          deactivate accounts and reset staff passwords.
        </p>
        <p className="mt-4 text-sm text-amber-800">
          Public registration must never allow a user to select the DOCTOR,
          MANAGER or ADMIN role.
        </p>
      </div>
    </Workspace>
  );
}
