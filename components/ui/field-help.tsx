import type { ReactNode } from "react";

export function FieldHelp({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="text-sm font-medium flex items-center gap-2">{label}</div>
      {children}
      {help ? <p className="text-xs text-muted-foreground">{help}</p> : null}
    </div>
  );
}
