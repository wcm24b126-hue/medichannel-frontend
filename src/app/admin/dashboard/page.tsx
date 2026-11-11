import Workspace from "@/components/common/workspace";
import AdminDashboardContent from "@/components/admin/admin-dashboard";

export default function AdminDashboard() {
  return (
    <Workspace role="admin" title="Administrator Dashboard" description="Manage staff accounts and monitor the system.">
      <AdminDashboardContent />
    </Workspace>
  );
}
