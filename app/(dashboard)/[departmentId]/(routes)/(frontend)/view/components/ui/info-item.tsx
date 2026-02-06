export function InfoItem({
  label,
  value,
}: {
  label: string;
  value?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">
        {label}
      </span>
      <span className="text-sm">
        {value ?? "—"}
      </span>
    </div>
  );
}
