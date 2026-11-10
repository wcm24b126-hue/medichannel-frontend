import Workspace from "@/components/common/workspace";
import WorkspaceContent from "@/components/common/workspace-content";

export default function AppointmentsPage() {
  return (
    <Workspace
      role="patient"
      title="My Appointments"
      description="View your upcoming and previous hospital appointments."
    >
      <WorkspaceContent
        cards={[
          { title: "Upcoming Appointments", value: "—", description: "Loaded from your account" },
          { title: "Completed Appointments", value: "—", description: "Loaded from your account" },
          { title: "Pending Payments", value: "—", description: "Loaded from your account" },
        ]}
        sections={[
          { title: "Appointment History", description: "Your appointment records will appear here after connecting the appointments API." },
          { title: "Live Queue", description: "The current serving number and patients ahead of you will appear here when a session is running." },
        ]}
      />
    </Workspace>
  );
}
