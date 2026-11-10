import Workspace from "@/components/common/workspace";

export default function ProfilePage() {
  return (
    <Workspace
      role="patient"
      title="My Profile"
      description="View and manage your personal account information."
    >
      <div className="card max-w-2xl">
        <h2 className="text-lg font-bold">Personal Information</h2>
        <p className="mt-2 text-sm text-slate-500">
          Your name, NIC, date of birth, phone number, email and address should
          be loaded from the authenticated customer profile API.
        </p>
        <p className="mt-4 text-sm text-amber-800">
          Personal information must be returned only to the authenticated owner.
        </p>
      </div>
    </Workspace>
  );
}
