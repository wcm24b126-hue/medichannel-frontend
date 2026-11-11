import Workspace from "@/components/common/workspace";
import WorkspaceContent from "@/components/common/workspace-content";

export default function DoctorDashboard() {
  return (
    <Workspace role="doctor" title="Doctor Dashboard" description="Overview of your sessions and appointments.">
      <WorkspaceContent
        cards={[
          { title: "Today's Sessions", value: "—" },
          { title: "Patients Waiting", value: "—" },
          { title: "Completed Today", value: "—" },
        ]}
        sections={[
          { title: "Today's Schedule", description: "Your assigned sessions and start times will be displayed here." },
          { title: "Queue Management", description: "Start a session, call the next patient and update appointment status." },
        ]}
      />
    </Workspace>
  );
}
