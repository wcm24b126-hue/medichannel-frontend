import Workspace from "@/components/common/workspace";
import WorkspaceContent from "@/components/common/workspace-content";

export default function ManagerDashboard() {
  return (
    <Workspace role="manager" title="Manager Dashboard" description="Hospital channelling operations overview.">
      <WorkspaceContent
        cards={[
          { title: "Today's Sessions", value: "—" },
          { title: "Appointments Today", value: "—" },
          { title: "Revenue Today", value: "—" },
        ]}
        sections={[
          { title: "Session Overview", description: "Monitor today's sessions and their current status." },
          { title: "Hospital Operations", description: "Manage doctors, rooms, sessions, reception, notices and feedback." },
        ]}
      />
    </Workspace>
  );
}
