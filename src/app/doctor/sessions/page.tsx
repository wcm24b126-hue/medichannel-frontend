import Workspace from "@/components/common/workspace";

export default function DoctorSessions() {
  return (
    <Workspace role="doctor" title="My Sessions" description="View your sessions and patient queues.">
      <div className="card">
        <h2 className="text-lg font-bold">Session List</h2>
        <p className="mt-2 text-sm text-slate-500">
          Session information and patient lists will be loaded from the
          authenticated doctor&apos;s sessions API.
        </p>
        <p className="mt-4 text-sm text-slate-500">
          Session actions: Start Session, Call Next, Complete, No-show and End Session.
        </p>
      </div>
    </Workspace>
  );
}
