import AutoDTRWizard from "@/components/tools/auto-dtr/AutoDTRWizard";

export default function AutoDTRPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Auto DTR</h1>
        <p className="text-sm text-muted-foreground">
          Generate Daily Time Records from biometrics logs, respecting holidays and manual exclusions.
        </p>
      </div>
      <AutoDTRWizard />
    </div>
  );
}
