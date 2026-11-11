import Workspace from "@/components/common/workspace";

export default function ConsultationPage() {
  return (
    <Workspace
      role="patient"
      title="Online Consultation"
      description="Access your private online consultation with your treating doctor."
    >
      <div className="card">
        <h2 className="text-lg font-bold">Private Consultation Room</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          The consultation room becomes available when your doctor starts your
          online appointment. Chat messages must be private and encrypted.
        </p>
        <p className="mt-4 rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
          WebSocket chat will be enabled after the Spring Boot WebSocket service
          is implemented.
        </p>
      </div>
    </Workspace>
  );
}
