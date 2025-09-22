
import TogglePublicButton from "@/app/(dashboard)/[departmentId]/(routes)/settings/components/toggle-public-button";


type Props = {
  departmentId: string;
  employeeId: string;
  publicEnabled: boolean;
  title?: string;
  actions?: React.ReactNode; // ActionBar goes here
  hint?: string; // small line under title
};

export default function AdminHeaderCard({
  departmentId,
  employeeId,
  publicEnabled,
  title = "Employee Information",
  actions,
  hint = "Manage visibility, review details, and perform quick actions.",
}: Props) {
  return (
    <div className="bg-white rounded-xl shadow-sm border p-6 space-y-5">
      {/* title */}
      <div>
        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">{title}</h2>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>

      {/* status row */}
      <div className="flex flex-wrap items-center gap-3">
        <TogglePublicButton
          departmentId={departmentId}
          employeeId={employeeId}
          initialEnabled={!!publicEnabled}
        />
    
      </div>

      {/* actions slot */}
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
