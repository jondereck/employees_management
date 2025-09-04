// CheckboxListPicker.tsx (or inline in your file)
import { useMemo, useState } from "react";

export function CheckboxListPicker({
  value,           // selected items
  onChange,        // (next: string[]) => void
  options,         // all items
  placeholder = "Search positions…",
  maxHeight = 180, // px
}: {
  value: string[];
  onChange: (next: string[]) => void;
  options: string[];
  placeholder?: string;
  maxHeight?: number;
}) {

  const truncate = (s: string, n = 32) =>
  s.length > n ? s.slice(0, n - 1) + "…" : s;


  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return options;
    return options.filter(o => o.toLowerCase().includes(needle));
  }, [q, options]);

  const toggle = (opt: string) => {
    const next = value.includes(opt)
      ? value.filter(v => v !== opt)
      : [...value, opt];
    onChange(next);
  };

  const selectFiltered = () => {
    const set = new Set(value);
    filtered.forEach(f => set.add(f));
    onChange(Array.from(set));
  };

  const clearFiltered = () => {
    const remove = new Set(filtered);
    onChange(value.filter(v => !remove.has(v)));
  };

  return (
    <div className="space-y-1">
      {/* search + actions */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          className="border rounded px-2 py-1 text-xs w-full"
        />
        <button
          type="button"
          onClick={selectFiltered}
          className="text-[11px] text-blue-600 hover:underline whitespace-nowrap"
          title="Add all items currently shown"
        >
          Select filtered
        </button>
        <button
          type="button"
          onClick={clearFiltered}
          className="text-[11px] text-blue-600 hover:underline whitespace-nowrap"
          title="Clear all items currently shown"
        >
          Clear filtered
        </button>
      </div>

      {/* list */}
      <div
        className="border rounded bg-white p-2"
        style={{ maxHeight, overflowY: "auto" }}
      >
        {filtered.length === 0 ? (
          <div className="text-xs text-gray-500">No matches</div>
        ) : (
          <ul className="space-y-1">
            {filtered.map((opt) => (
              <li key={opt}>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={value.includes(opt)}
                    onChange={() => toggle(opt)}
                  />
                 <span className="block truncate" title={opt}>{truncate(opt, 40)}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* tiny status */}
      <div className="text-[11px] text-gray-500">
        Selected: {value.length}
      </div>
    </div>
  );
}
