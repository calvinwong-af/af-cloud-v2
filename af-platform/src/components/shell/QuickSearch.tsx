"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2 } from "lucide-react";
import { searchShipmentsAction } from "@/app/actions/shipments";
import type { SearchResult } from "@/app/actions/shipments";
import { SHIPMENT_STATUS_LABELS, SHIPMENT_STATUS_COLOR } from "@/lib/types";

const STATUS_DOT_COLORS: Record<string, string> = {
  gray: "#9ca3af",
  yellow: "#eab308",
  blue: "#3b82f6",
  orange: "#f97316",
  teal: "#14b8a6",
  sky: "#0ea5e9",
  indigo: "#6366f1",
  purple: "#a855f7",
  red: "#ef4444",
  green: "#22c55e",
};

export function QuickSearch() {
  const router = useRouter();
  const [active, setActive] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // ⌘K shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setActive(true);
      }
      if (e.key === "Escape") {
        close();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Focus input when activated
  useEffect(() => {
    if (active) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [active]);

  // Click outside to close
  useEffect(() => {
    if (!active) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [active]);

  function close() {
    setActive(false);
    setQuery("");
    setResults([]);
    setSearched(false);
    setLoading(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }

  const doSearch = useCallback((value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length < 3) {
      setResults([]);
      setSearched(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const res = await searchShipmentsAction(value.trim(), "id", 8);
      setResults(res);
      setSearched(true);
      setLoading(false);
    }, 300);
  }, []);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setQuery(value);
    doSearch(value);
  }

  function handleSelect(shipmentId: string) {
    close();
    router.push(`/shipments/${shipmentId}`);
  }

  if (!active) {
    return (
      <div
        onClick={() => setActive(true)}
        className="flex items-center gap-2 rounded-lg px-3 py-1.5 cursor-pointer"
        style={{ background: "var(--surface)", width: 220 }}
      >
        <Search size={14} style={{ color: "var(--text-muted)" }} />
        <span className="flex-1 text-xs" style={{ color: "var(--text-muted)" }}>
          Quick search…
        </span>
        <kbd
          className="font-mono text-[0.6rem] px-1.5 py-0.5 rounded"
          style={{
            background: "white",
            color: "var(--text-muted)",
            border: "1px solid var(--border)",
          }}
        >
          ⌘K
        </kbd>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative" style={{ width: 320 }}>
      {/* Input */}
      <div
        className="flex items-center gap-2 rounded-lg px-3 py-1.5"
        style={{ background: "var(--surface)", border: "1px solid var(--sky)" }}
      >
        {loading ? (
          <Loader2 size={14} className="animate-spin" style={{ color: "var(--sky)" }} />
        ) : (
          <Search size={14} style={{ color: "var(--sky)" }} />
        )}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          placeholder="Search by shipment ID…"
          className="flex-1 text-xs bg-transparent outline-none"
          style={{ color: "var(--text)" }}
          onKeyDown={(e) => {
            if (e.key === "Escape") close();
            if (e.key === "Enter" && results.length === 1) {
              handleSelect(results[0].shipment_id);
            }
          }}
        />
        <kbd
          className="font-mono text-[0.6rem] px-1.5 py-0.5 rounded cursor-pointer"
          style={{
            background: "white",
            color: "var(--text-muted)",
            border: "1px solid var(--border)",
          }}
          onClick={close}
        >
          Esc
        </kbd>
      </div>

      {/* Dropdown */}
      {(searched || loading) && query.trim().length >= 3 && (
        <div
          className="absolute top-full left-0 right-0 mt-1 rounded-lg shadow-lg border overflow-hidden z-50"
          style={{ background: "white", borderColor: "var(--border)" }}
        >
          {loading && !searched && (
            <div className="px-4 py-3 text-xs text-center" style={{ color: "var(--text-muted)" }}>
              Searching…
            </div>
          )}
          {searched && results.length === 0 && (
            <div className="px-4 py-3 text-xs text-center" style={{ color: "var(--text-muted)" }}>
              No results found
            </div>
          )}
          {results.map((r) => {
            const color = SHIPMENT_STATUS_COLOR[r.status] ?? "gray";
            const dotColor = STATUS_DOT_COLORS[color] ?? "#9ca3af";
            const label = SHIPMENT_STATUS_LABELS[r.status] ?? r.status_label;
            return (
              <button
                key={r.shipment_id}
                onClick={() => handleSelect(r.shipment_id)}
                className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-[var(--surface)] transition-colors text-left"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold" style={{ color: "var(--text)" }}>
                      {r.shipment_id}
                    </span>
                    <span
                      className="flex items-center gap-1 text-[0.65rem] px-1.5 py-0.5 rounded-full"
                      style={{ background: `${dotColor}15`, color: dotColor }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: dotColor }} />
                      {label}
                    </span>
                  </div>
                  <div className="text-[0.65rem] mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
                    {r.company_name && <span>{r.company_name}</span>}
                    {r.origin_port && r.destination_port && (
                      <span className="ml-1.5">
                        {r.company_name ? " · " : ""}
                        {r.origin_port} → {r.destination_port}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
