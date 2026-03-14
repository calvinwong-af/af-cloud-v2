'use client';

import { useState, useRef, useEffect } from 'react';
import type { OrderType, Company } from './_types';
import { ORDER_TYPES } from './_constants';

// ─── Props ───────────────────────────────────────────────────────────────────

interface StepOrderProps {
  orderType: OrderType;
  setOrderType: (t: OrderType) => void;
  transactionType: 'IMPORT' | 'EXPORT';
  setTransactionType: (t: 'IMPORT' | 'EXPORT') => void;
  companyId: string;
  setCompanyId: (id: string) => void;
  cargoReadyDate: string;
  setCargoReadyDate: (d: string) => void;
  companies: Company[];
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-medium text-[var(--text-mid)] mb-1">
      {children}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

// ─── Date Input (DD / MMM / YYYY) ────────────────────────────────────────────

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function DateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  // value = 'YYYY-MM-DD' or ''
  const parts = value ? value.split('-') : ['', '', ''];
  const year  = parts[0] ?? '';
  const month = parts[1] ?? '';
  const day   = parts[2] ?? '';

  function emit(d: string, m: string, y: string) {
    if (d && m && y && y.length === 4) {
      onChange(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`);
    } else if (!d && !m && !y) {
      onChange('');
    }
  }

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => currentYear + i);
  const days  = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));

  const sel = "px-2 py-2 text-sm border border-[var(--border)] rounded-lg bg-white text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--sky)] focus:border-transparent";

  return (
    <div className="flex items-center gap-2">
      {/* Day */}
      <select value={day} onChange={e => emit(e.target.value, month, year)} className={`${sel} w-[72px]`}>
        <option value="">DD</option>
        {days.map(d => <option key={d} value={d}>{d}</option>)}
      </select>
      {/* Month */}
      <select value={month ? String(parseInt(month)) : ''} onChange={e => { const m = e.target.value ? String(parseInt(e.target.value)).padStart(2,'0') : ''; emit(day, m, year); }} className={`${sel} w-[88px]`}>
        <option value="">MMM</option>
        {MONTHS.map((label, i) => <option key={label} value={String(i+1)}>{label}</option>)}
      </select>
      {/* Year */}
      <select value={year} onChange={e => emit(day, month, e.target.value)} className={`${sel} w-[88px]`}>
        <option value="">YYYY</option>
        {years.map(y => <option key={y} value={String(y)}>{y}</option>)}
      </select>
    </div>
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

// ─── Component ───────────────────────────────────────────────────────────────

export function StepOrder({
  orderType,
  setOrderType,
  transactionType,
  setTransactionType,
  companyId,
  setCompanyId,
  cargoReadyDate,
  setCargoReadyDate,
  companies,
}: StepOrderProps) {
  const companyOptions = companies.map(c => ({
    value: c.company_id,
    label: c.name,
    sublabel: c.company_id,
  }));

  const selectedCompany = companies.find(c => c.company_id === companyId);

  return (
    <div className="space-y-5">
      <div>
        <FieldLabel required>Order Type</FieldLabel>
        <div className="grid grid-cols-3 gap-2">
          {ORDER_TYPES.map(t => (
            <button
              key={t.value}
              onClick={() => setOrderType(t.value as OrderType)}
              className={`flex flex-col items-center justify-center px-2 py-2.5 rounded-lg border text-center transition-colors ${
                orderType === t.value
                  ? 'bg-[var(--slate)] text-white border-[var(--slate)]'
                  : 'bg-white text-[var(--text)] border-[var(--border)] hover:border-[var(--sky)]'
              }`}
            >
              <span className="text-xs font-semibold leading-tight">{t.label}</span>
              <span className={`text-[10px] mt-0.5 leading-tight ${orderType === t.value ? 'text-white/60' : 'text-[var(--text-muted)]'}`}>{t.sublabel}</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <FieldLabel required>Transaction Type</FieldLabel>
        <div className="flex gap-2">
          {(['EXPORT', 'IMPORT'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTransactionType(t)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                transactionType === t
                  ? 'bg-[var(--slate)] text-white border-[var(--slate)]'
                  : 'bg-white text-[var(--text-mid)] border-[var(--border)] hover:border-[var(--sky)]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div>
        <FieldLabel required>Customer Company</FieldLabel>
        <Combobox
          value={companyId}
          onChange={setCompanyId}
          options={companyOptions}
          placeholder="Search by company name or ID…"
        />
        {selectedCompany && (
          <p className="text-xs text-[var(--text-muted)] mt-1">{selectedCompany.company_id}</p>
        )}
      </div>
      <div>
        <FieldLabel>Cargo Ready Date</FieldLabel>
        <DateInput value={cargoReadyDate} onChange={setCargoReadyDate} />
      </div>
    </div>
  );
}
