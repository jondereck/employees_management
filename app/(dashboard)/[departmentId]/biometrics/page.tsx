import BioLogUploader from "./BioLogUploader";

export default function Page() {
  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-semibold mb-4">Biometrics Uploader</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Upload the monthly “Employee Attendance Record” (.xlsx). We’ll compute Late & Undertime based on earliest-in & latest-out.
      </p>
      <BioLogUploader />
    </div>
  );
}
