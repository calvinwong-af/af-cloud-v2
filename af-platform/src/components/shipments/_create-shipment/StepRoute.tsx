'use client';

import { useState, useRef, useEffect } from 'react';
import TerminalSelector from '@/components/shared/TerminalSelector';
import type { Port, OrderType } from './_types';
import { INCOTERMS } from './_constants';

// ─── Props ───────────────────────────────────────────────────────────────────

interface StepRouteProps {
  originCode: string;
  setOriginCode: (p: string) => void;
  destCode: string;
  setDestCode: (p: string) => void;
  originTerminalId: string;
  setOriginTerminalId: (t: string) => void;
  destTerminalId: string;
  setDestTerminalId: (t: string) => void;
  incoterm: string;
  setIncoterm: (t: string) => void;
  ports: Port[];
  orderType: OrderType;
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-medium text-[var(--text-mid)] mb-1">
      {children}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

// ─── Searchable Combobox ──────────────────────────────────────────────────────

function Combobox({ value, onChange, options, placeholder }: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; sublabel?: string }[];
  placeholder?: string;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState<number>(-1);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!value) setQuery('');
  }, [value]);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setHighlighted(-1);
        const selected = options.find(o => o.value === value);
        setQuery(selected?.label ?? '');
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [value, options]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlighted >= 0 && listRef.current) {
      const item = listRef.current.children[highlighted] as HTMLElement;
      item?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlighted]);

  const filtered = query.trim().length === 0
    ? options.slice(0, 80)
    : options.filter(o =>
        o.label.toLowerCase().includes(query.toLowerCase()) ||
        o.value.toLowerCase().includes(query.toLowerCase()) ||
        (o.sublabel ?? '').toLowerCase().includes(query.toLowerCase())
      ).slice(0, 80);

  const selectedLabel = options.find(o => o.value === value)?.label ?? '';
  const inputValue = open ? query : selectedLabel;

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setQuery('');
        setOpen(true);
        setHighlighted(0);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlighted(h => Math.min(h + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlighted(h => Math.max(h - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlighted >= 0 && filtered[highlighted]) {
          const chosen = filtered[highlighted];
          onChange(chosen.value);
          setQuery(chosen.label);
          setOpen(false);
          setHighlighted(-1);
        }
        break;
      case 'Escape':
        setOpen(false);
        setHighlighted(-1);
        {
          const selected = options.find(o => o.value === value);
          setQuery(selected?.label ?? '');
        }
        break;
      case 'Tab':
        setOpen(false);
        setHighlighted(-1);
        break;
    }
  }

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={inputValue}
        onChange={e => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlighted(0);
          if (e.target.value === '') onChange('');
        }}
        onFocus={() => {
          setQuery('');
          setOpen(true);
          setHighlighted(-1);
        }}
        onMouseDown={() => {
          if (!open) {
            setQuery('');
            setOpen(true);
            setHighlighted(-1);
          }
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--sky)] focus:border-transparent"
      />
      {open && filtered.length > 0 && (
        <div
          ref={listRef}
          className="absolute z-50 w-full mt-1 bg-white border border-[var(--border)] rounded-lg shadow-lg max-h-56 overflow-y-auto"
        >
          {filtered.map((o, i) => (
            <div
              key={o.value}
              onMouseDown={e => {
                e.preventDefault();
                onChange(o.value);
                setQuery(o.label);
                setOpen(false);
                setHighlighted(-1);
              }}
              onMouseEnter={() => setHighlighted(i)}
              className={`px-3 py-2 text-sm cursor-pointer ${
                i === highlighted
                  ? 'bg-[var(--sky-mist)]'
                  : o.value === value
                  ? 'bg-[var(--sky-pale)]'
                  : 'hover:bg-[var(--sky-mist)]'
              }`}
            >
              <div className="text-[var(--text)]">{o.label}</div>
              {o.sublabel && <div className="text-xs text-[var(--text-muted)]">{o.sublabel}</div>}
            </div>
          ))}
        </div>
      )}
      {open && filtered.length === 0 && query.trim().length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-[var(--border)] rounded-lg shadow-lg px-3 py-2 text-sm text-[var(--text-muted)]">
          No results for &quot;{query}&quot;
        </div>
      )}
    </div>
  );
}

// ─── Port filtering ───────────────────────────────────────────────────────────

function isAirport(port: Port): boolean {
  // Matches port_type values like 'AIR', 'airport', 'AIRPORT', 'air_port' etc.
  return port.port_type?.toLowerCase().includes('air') ?? false;
}

function getSeaPorts(ports: Port[]): Port[] {
  return ports.filter(p => !isAirport(p));
}

function getAirports(ports: Port[]): Port[] {
  return ports.filter(p => isAirport(p));
}

// ─── Component ───────────────────────────────────────────────────────────────

export function StepRoute({
  originCode,
  setOriginCode,
  destCode,
  setDestCode,
  originTerminalId,
  setOriginTerminalId,
  destTerminalId,
  setDestTerminalId,
  incoterm,
  setIncoterm,
  ports,
  orderType,
}: StepRouteProps) {
  const seaPorts = getSeaPorts(ports);
  const airports = getAirports(ports);
  const activePorts = orderType === 'AIR' ? airports : seaPorts;
  const portOptions = activePorts.map(p => ({
    value: p.un_code,
    label: p.name || p.un_code,
    sublabel: `${p.un_code}${p.country ? ' · ' + p.country : ''}`,
  }));

  const incotermOptions = INCOTERMS.map(i => ({ value: i, label: i }));

  const originPort = activePorts.find(p => p.un_code === originCode);
  const destPort = activePorts.find(p => p.un_code === destCode);

  return (
    <div className="space-y-5">
      <div>
        <FieldLabel required>Origin Port</FieldLabel>
        <Combobox
          value={originCode}
          onChange={setOriginCode}
          options={portOptions}
          placeholder="Search by port name or UN code…"
        />
        {originPort && (
          <p className="text-xs text-[var(--text-muted)] mt-1">{originPort.un_code} · {originPort.country}</p>
        )}
        {originPort?.has_terminals && (
          <TerminalSelector
            terminals={originPort.terminals}
            value={originTerminalId}
            onChange={setOriginTerminalId}
          />
        )}
      </div>
      <div>
        <FieldLabel required>Destination Port</FieldLabel>
        <Combobox
          value={destCode}
          onChange={setDestCode}
          options={portOptions}
          placeholder="Search by port name or UN code…"
        />
        {destPort && (
          <p className="text-xs text-[var(--text-muted)] mt-1">{destPort.un_code} · {destPort.country}</p>
        )}
        {destPort?.has_terminals && (
          <TerminalSelector
            terminals={destPort.terminals}
            value={destTerminalId}
            onChange={setDestTerminalId}
          />
        )}
      </div>
      <div>
        <FieldLabel required>Incoterm</FieldLabel>
        <Combobox
          value={incoterm}
          onChange={setIncoterm}
          options={incotermOptions}
          placeholder="Select or type incoterm…"
        />
      </div>
    </div>
  );
}
