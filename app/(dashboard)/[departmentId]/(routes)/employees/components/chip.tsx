// components/ui/Chip.tsx
export default function Chip({
  label,
  onRemove,
}: { label: string; onRemove?: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700">
      <span className="truncate max-w-[180px]" title={label}>{label}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-gray-500 hover:bg-gray-200"
          aria-label={`Remove ${label}`}
          title="Remove"
        >
          ×
        </button>
      )}
    </span>
  );
}
