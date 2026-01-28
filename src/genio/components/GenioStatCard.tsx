// components/GenioStatCard.tsx
export function GenioStatCard({
  total,
  male,
  female,
}: {
  total?: string;
  male?: string;
  female?: string;
}) {
  return (
    <div className="mb-2 rounded-xl border bg-white px-4 py-3 shadow-sm">
      {total && (
        <p className="text-sm font-semibold text-primary">
          Total Employees: {total}
        </p>
      )}

      <div className="mt-1 flex gap-4 text-xs text-muted-foreground">
        {male && <span>♂ Male: {male}</span>}
        {female && <span>♀ Female: {female}</span>}
      </div>
    </div>
  );
}
