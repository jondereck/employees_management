export function TimelineSkeleton() {
  return (
    <ol className="relative ml-3 border-l pl-5 space-y-6 animate-pulse">
      {[1, 2, 3].map((i) => (
        <li key={i} className="mb-6 last:mb-0">
          <span className="absolute -left-3 mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-muted" />
          <div className="flex flex-col gap-2">
            <div className="h-4 w-32 rounded bg-muted" />
            <div className="h-3 w-24 rounded bg-muted/70" />
            <div className="h-3 w-48 rounded bg-muted/50" />
          </div>
        </li>
      ))}
    </ol>
  );
}
