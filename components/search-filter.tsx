"use client";
import { FC, useEffect, useMemo, useRef, useState } from "react";
import { X, Search, Command, Loader2 } from "lucide-react";
import clsx from "clsx";

interface SearchFilterProps {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  isDebouncing?: boolean;
}

const MODE_STYLES: Record<string, { label: string; color: string; bg: string; border: string }> = {
  pos:  { label: "Position", color: "text-purple-600", bg: "bg-purple-100", border: "border-purple-200" },
  nick: { label: "Nickname", color: "text-green-600",  bg: "bg-green-100",  border: "border-green-200"  },
  off:  { label: "Office",   color: "text-sky-600",    bg: "bg-sky-100",    border: "border-sky-200"    },
  type: { label: "Appt.",    color: "text-amber-600",  bg: "bg-amber-100",  border: "border-amber-200"  },
  note: { label: "Note",    color: "text-teal-600",   bg: "bg-teal-100",   border: "border-teal-200"   },
};

const SearchFilter: FC<SearchFilterProps> = ({ searchTerm, setSearchTerm, isDebouncing }) => {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Parse mode and the remaining query text
  const { mode, queryText } = useMemo(() => {
    const match = searchTerm.match(/^\?([a-z]+)\s*(.*)/i);
    if (match && MODE_STYLES[match[1].toLowerCase()]) {
      return { mode: match[1].toLowerCase(), queryText: match[2] };
    }
    return { mode: null, queryText: searchTerm };
  }, [searchTerm]);

  const style = mode ? MODE_STYLES[mode] : null;

  // Keyboard shortcut: CMD/CTRL + /
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMac = typeof window !== 'undefined' && navigator.platform.toUpperCase().includes("MAC");
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="w-full max-w-auto mx-auto space-y-2">
      <div 
        className={clsx(
          "relative flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all duration-200 shadow-sm",
          isFocused ? "ring-2 ring-blue-500/20 border-blue-500 bg-white" : "bg-gray-50/50 border-gray-200"
        )}
      >
        {/* Context-aware Icon */}
        <div className="flex items-center">
          {isDebouncing ? (
            <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
          ) : (
            <Search className={clsx("h-4 w-4 transition-colors", isFocused ? "text-blue-500" : "text-gray-400")} />
          )}
        </div>

        {/* The "Token" View */}
        <div className="flex flex-1 items-center gap-1.5 min-w-0">
          {style && (
            <span className={clsx(
              "flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider border",
              style.bg, style.color, style.border
            )}>
              {style.label}
            </span>
          )}
          
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent outline-none text-sm text-gray-900 placeholder:text-gray-400 min-w-[50px]"
            placeholder={mode ? "Type search query..." : 'Search... (try "?pos ")'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {searchTerm && (
            <button
              onClick={() => { setSearchTerm(""); inputRef.current?.focus(); }}
              className="p-1 rounded-md hover:bg-gray-200/50 transition-colors"
              title="Clear search"
            >
              <X className="h-3.5 w-3.5 text-gray-500" />
            </button>
          )}
          <div className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-gray-200 bg-white text-[10px] text-gray-400 font-medium">
            <Command className="h-2.5 w-2.5" /> /
          </div>
        </div>
      </div>

      {/* Suggestion Quick-Links (Only show if user types '?' or is focused and empty) */}
      {isFocused && (searchTerm === "?" || searchTerm === "") && (
        <div className="flex flex-wrap gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
          {Object.entries(MODE_STYLES).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => setSearchTerm(`?${key} `)}
              className={clsx(
                "text-[11px] px-2 py-1 rounded-lg border transition-all hover:scale-105",
                cfg.bg, cfg.color, cfg.border
              )}
            >
              <span className="opacity-60 font-mono">?</span>{key}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchFilter;