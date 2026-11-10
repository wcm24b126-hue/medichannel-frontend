import Workspace from "@/components/common/workspace";
import WorkspaceContent from "@/components/common/workspace-content";

export default function ManagerReports() {
  return (
    <Workspace role="manager" title="Reports" description="Review hospital operations and performance.">
      <WorkspaceContent
        cards={[
          { title: "Appointments per Day", value: "—" },
          { title: "No-show Rate", value: "—" },
          { title: "Average Doctor Rating", value: "—" },
        ]}
        sections={[
          { title: "Appointment Reports", description: "Physical and online appointment totals should be calculated by the backend." },
          { title: "Revenue Reports", description: "Revenue and top doctor statistics should be calculated from database records." },
        ]}
      />
    </Workspace>
  );
}
