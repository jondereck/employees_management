// components/search-filter.tsx
"use client";
import { FC, useEffect, useMemo, useRef } from "react";
import { X, Search } from "lucide-react";
import clsx from "clsx";

interface SearchFilterProps {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  isDebouncing?: boolean; // optional, pass !!(debounced !== instant)
}



const MODE_STYLES: Record<string, { label: string; badge: string; ring: string; bg: string; border: string }> = {
  pos:  { label: "Position search", badge: "bg-purple-100 text-purple-700", ring: "focus:ring-purple-500", bg: "bg-purple-50", border: "border-purple-300" },
  nick: { label: "Nickname search", badge: "bg-green-100 text-green-700",  ring: "focus:ring-green-500",  bg: "bg-green-50",  border: "border-green-300"  },
  off:  { label: "Office search",    badge: "bg-sky-100 text-sky-700",     ring: "focus:ring-sky-500",    bg: "bg-sky-50",    border: "border-sky-300"   },
  type: { label: "Appointment",      badge: "bg-amber-100 text-amber-700", ring: "focus:ring-amber-500",  bg: "bg-amber-50",  border: "border-amber-300" },
};

const detectMode = (q: string) => {
  const m = q.trim().match(/^\?([a-z]+)/i);
  return m?.[1]?.toLowerCase() ?? null;
};

const SearchFilter: FC<SearchFilterProps> = ({ searchTerm, setSearchTerm, isDebouncing }) => {
  const mode = useMemo(() => detectMode(searchTerm), [searchTerm]);
  const style = mode && MODE_STYLES[mode] ? MODE_STYLES[mode] : null;
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut: CMD/CTRL + /
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const base =
    "w-full rounded-xl border px-4 py-2.5 pl-10 pr-10 transition-colors outline-none focus:ring-2 placeholder:text-gray-400";

  return (
    <div className="space-y-1">
      <div className="relative">
        {/* Left icon */}
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />

        <input
          ref={inputRef}
          type="text"
          className={clsx(
            base,
            style
              ? `${style.bg} ${style.border} ${style.ring}`
              : "bg-white border-gray-300 focus:ring-blue-500"
          )}
          placeholder='Search… tip: "?pos planning", "?off treasury", "?nick neo"'
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          aria-label={`Search employees${style ? ` — ${style.label}` : ""}`}
        />

        {/* Right: clear button */}
        {searchTerm && (
          <button
            onClick={() => setSearchTerm("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-gray-100"
            aria-label="Clear search"
            type="button"
          >
            <X className="h-4 w-4 text-gray-500" />
          </button>
        )}
      </div>

      {/* Helper line: mode label + debounce dot */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-2">
          {style ? (
            <span className={clsx("inline-flex items-center gap-1 px-2 py-0.5 rounded-full", style.badge)}>
              <span className="font-medium">?</span> {style.label}
            </span>
          ) : (
            <span className="text-gray-400">Type to search • <kbd className="rounded border px-1">Ctrl/⌘</kbd>/<kbd className="rounded border px-1">/</kbd></span>
          )}
        </div>
        {isDebouncing ? (
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-pulse" /> updating…
          </span>
        ) : null}
      </div>
    </div>
  );
};

export default SearchFilter;
