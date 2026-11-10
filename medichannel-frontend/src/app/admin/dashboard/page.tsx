import Workspace from "@/components/common/workspace";
import WorkspaceContent from "@/components/common/workspace-content";

export default function AdminDashboard() {
  return (
    <Workspace role="admin" title="Administrator Dashboard" description="Manage staff accounts and monitor the system.">
      <WorkspaceContent
        cards={[
          { title: "Staff Accounts", value: "—" },
          { title: "Active Accounts", value: "—" },
          { title: "System Events", value: "—" },
        ]}
        sections={[
          { title: "Account Administration", description: "Create doctor and manager accounts and manage account activation." },
          { title: "System Monitoring", description: "Review system status and audit activity without accessing patient medical records." },
        ]}
      />
    </Workspace>
  );
}
