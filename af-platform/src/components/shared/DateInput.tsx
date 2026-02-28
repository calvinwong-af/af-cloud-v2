'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Clock } from 'lucide-react';
import { createPortal } from 'react-dom';

// ---------------------------------------------------------------------------
// Shared date / datetime inputs — DD/MM/YYYY with calendar dropdown
// ---------------------------------------------------------------------------

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS   = ['Mo','Tu','We','Th','Fr','Sa','Su'];

const pad = (n: number) => String(n).padStart(2, '0');

// ---------------------------------------------------------------------------
// Calendar grid (shared by both DateInput and DateTimeInput)
// ---------------------------------------------------------------------------

function CalendarGrid({
  year, month, selectedDay, selectedMonth, selectedYear,
  onSelect, onMonthChange,
}: {
  year: number; month: number;
  selectedDay: number | null; selectedMonth: number | null; selectedYear: number | null;
  onSelect: (d: Date) => void;
  onMonthChange: (y: number, m: number) => void;
}) {
  const firstDay = new Date(year, month, 1);
  // Monday = 0 .. Sunday = 6
  const startDow = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const today = new Date();
  const todayY = today.getFullYear();
  const todayM = today.getMonth();
  const todayD = today.getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div>
      {/* Month/year header */}
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => {
            const prev = month === 0 ? 11 : month - 1;
            const y = month === 0 ? year - 1 : year;
            onMonthChange(y, prev);
          }}
          className="p-1 rounded hover:bg-[var(--surface)] text-[var(--text-muted)]"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <span className="text-xs font-semibold text-[var(--text)]">
          {MONTHS[month]} {year}
        </span>
        <button
          type="button"
          onClick={() => {
            const next = month === 11 ? 0 : month + 1;
            const y = month === 11 ? year + 1 : year;
            onMonthChange(y, next);
          }}
          className="p-1 rounded hover:bg-[var(--surface)] text-[var(--text-muted)]"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map(d => (
          <div key={d} className="text-center text-[10px] font-medium text-[var(--text-muted)] py-0.5">{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          if (day === null) return <div key={i} />;
          const isToday = year === todayY && month === todayM && day === todayD;
          const isSelected = year === selectedYear && month === selectedMonth && day === selectedDay;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(new Date(year, month, day))}
              className={`text-[11px] py-1 rounded transition-colors ${
                isSelected
                  ? 'bg-[var(--sky)] text-white font-semibold'
                  : isToday
                    ? 'bg-[var(--sky-pale)] text-[var(--sky)] font-semibold'
                    : 'text-[var(--text)] hover:bg-[var(--surface)]'
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TimePicker — simple HH : MM input fields
// ---------------------------------------------------------------------------

function TimeField({
  value, max, onChange,
}: {
  value: number; max: number;
  onChange: (v: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 2);
    setDraft(raw);
    if (raw === '') return;
    const n = parseInt(raw, 10);
    if (!isNaN(n) && n >= 0 && n <= max) onChange(n);
  }

  function handleFocus(e: React.FocusEvent<HTMLInputElement>) {
    setEditing(true);
    setDraft('');
    e.target.select();
  }

  function handleBlur() {
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowUp') { e.preventDefault(); onChange(value >= max ? 0 : value + 1); setDraft(''); }
    if (e.key === 'ArrowDown') { e.preventDefault(); onChange(value <= 0 ? max : value - 1); setDraft(''); }
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      value={editing ? draft : pad(value)}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className="w-10 text-center text-sm font-mono font-medium border border-[var(--border)] rounded-lg py-1.5 bg-white text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--sky)]"
      maxLength={2}
    />
  );
}

function TimePicker({
  hour, minute, onChangeHour, onChangeMinute,
}: {
  hour: number; minute: number;
  onChangeHour: (h: number) => void;
  onChangeMinute: (m: number) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-2 border-t border-[var(--border)] pt-3 mt-2">
      <Clock className="w-3.5 h-3.5 text-[var(--text-muted)]" />
      <TimeField value={hour} max={23} onChange={onChangeHour} />
      <span className="text-sm font-bold text-[var(--text-muted)]">:</span>
      <TimeField value={minute} max={59} onChange={onChangeMinute} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// useDropdownPosition — calculate portal position
// ---------------------------------------------------------------------------

function useDropdownPosition(anchorRef: React.RefObject<HTMLDivElement | null>, open: boolean) {
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    if (!open || !anchorRef.current) { setPos(null); return; }
    const rect = anchorRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 260) });
  }, [open, anchorRef]);

  return pos;
}

// ---------------------------------------------------------------------------
// DateInput — DD/MM/YYYY with calendar dropdown
// ---------------------------------------------------------------------------

export function DateInput({
  value,
  onChange,
  className = '',
  placeholder = 'DD/MM/YYYY',
  ...rest
}: {
  value: string;
  onChange: (isoDate: string) => void;
  className?: string;
  placeholder?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'placeholder'>) {
  const [display, setDisplay] = useState(() => isoToDisplay(value));
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pos = useDropdownPosition(anchorRef, open);

  // Calendar view state
  const parsed = parseISO(value);
  const [viewYear, setViewYear] = useState(parsed?.getFullYear() ?? new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.getMonth() ?? new Date().getMonth());

  // Sync display when external value changes
  useEffect(() => { setDisplay(isoToDisplay(value)); }, [value]);

  // Reset view when opening
  useEffect(() => {
    if (open) {
      const d = parseISO(value) ?? new Date();
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }, [open, value]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (anchorRef.current?.contains(e.target as Node)) return;
      if (dropdownRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  function handleTextChange(e: React.ChangeEvent<HTMLInputElement>) {
    const cleaned = e.target.value.replace(/[^0-9/]/g, '');
    const formatted = autoSlash(cleaned);
    setDisplay(formatted);
    const iso = displayToISO(formatted);
    if (iso) onChange(iso);
    else if (formatted === '') onChange('');
  }

  function handleBlur() {
    if (display === '') { onChange(''); return; }
    const iso = displayToISO(display);
    if (iso) { onChange(iso); setDisplay(isoToDisplay(iso)); }
  }

  function handleCalendarSelect(d: Date) {
    const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    onChange(iso);
    setOpen(false);
  }

  const selDate = parseISO(value);

  return (
    <div ref={anchorRef} className="relative">
      <div className="flex">
        <input
          type="text"
          inputMode="numeric"
          value={display}
          onChange={handleTextChange}
          onBlur={handleBlur}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className={className}
          maxLength={10}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="absolute right-0 top-0 bottom-0 px-2 flex items-center text-[var(--text-muted)] hover:text-[var(--sky)]"
        >
          <Calendar className="w-3.5 h-3.5" />
        </button>
      </div>

      {open && pos && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[300] bg-white border border-[var(--border)] rounded-xl shadow-lg p-3"
          style={{ top: pos.top, left: pos.left, width: pos.width, minWidth: 260 }}
        >
          <CalendarGrid
            year={viewYear}
            month={viewMonth}
            selectedDay={selDate?.getDate() ?? null}
            selectedMonth={selDate?.getMonth() ?? null}
            selectedYear={selDate?.getFullYear() ?? null}
            onSelect={handleCalendarSelect}
            onMonthChange={(y, m) => { setViewYear(y); setViewMonth(m); }}
          />
        </div>,
        document.body
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DateTimeInput — DD/MM/YYYY HH:mm with calendar + time picker dropdown
// ---------------------------------------------------------------------------

export function DateTimeInput({
  value,
  onChange,
  className = '',
  placeholder = 'DD/MM/YYYY HH:mm',
  ...rest
}: {
  value: string;
  onChange: (datetimeLocal: string) => void;
  className?: string;
  placeholder?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'placeholder'>) {
  const [display, setDisplay] = useState(() => datetimeToDisplay(value));
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pos = useDropdownPosition(anchorRef, open);

  const parsed = parseDatetime(value);
  const [viewYear, setViewYear] = useState(parsed?.getFullYear() ?? new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.getMonth() ?? new Date().getMonth());
  const [hour, setHour] = useState(parsed?.getHours() ?? 0);
  const [minute, setMinute] = useState(parsed?.getMinutes() ?? 0);

  useEffect(() => { setDisplay(datetimeToDisplay(value)); }, [value]);

  // Reset view when opening
  useEffect(() => {
    if (open) {
      const d = parseDatetime(value) ?? new Date();
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
      setHour(d.getHours());
      setMinute(d.getMinutes());
    }
  }, [open, value]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (anchorRef.current?.contains(e.target as Node)) return;
      if (dropdownRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  const emitValue = useCallback((d: Date, h: number, m: number) => {
    const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(h)}:${pad(m)}`;
    onChange(iso);
  }, [onChange]);

  function handleTextChange(e: React.ChangeEvent<HTMLInputElement>) {
    const cleaned = e.target.value.replace(/[^0-9/: ]/g, '');
    const formatted = autoSlashDatetime(cleaned);
    setDisplay(formatted);
    const dt = displayToDatetime(formatted);
    if (dt) onChange(dt);
    else if (formatted === '') onChange('');
  }

  function handleBlur() {
    if (display === '') { onChange(''); return; }
    const dt = displayToDatetime(display);
    if (dt) { onChange(dt); setDisplay(datetimeToDisplay(dt)); return; }
    // If user entered just a date (DD/MM/YYYY) without time, default to 00:00
    const dateOnly = displayToISO(display.trim());
    if (dateOnly) {
      const withTime = `${dateOnly}T00:00`;
      onChange(withTime);
      setDisplay(datetimeToDisplay(withTime));
    }
  }

  function handleCalendarSelect(d: Date) {
    emitValue(d, hour, minute);
  }

  function handleHourChange(h: number) {
    setHour(h);
    const d = parseDatetime(value) ?? new Date();
    emitValue(d, h, minute);
  }

  function handleMinuteChange(m: number) {
    setMinute(m);
    const d = parseDatetime(value) ?? new Date();
    emitValue(d, hour, m);
  }

  const selDate = parseDatetime(value);

  return (
    <div ref={anchorRef} className="relative">
      <div className="flex">
        <input
          type="text"
          inputMode="numeric"
          value={display}
          onChange={handleTextChange}
          onBlur={handleBlur}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className={className}
          maxLength={16}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="absolute right-0 top-0 bottom-0 px-2 flex items-center text-[var(--text-muted)] hover:text-[var(--sky)]"
        >
          <Calendar className="w-3.5 h-3.5" />
        </button>
      </div>

      {open && pos && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[300] bg-white border border-[var(--border)] rounded-xl shadow-lg p-3"
          style={{ top: pos.top, left: pos.left, width: pos.width, minWidth: 280 }}
        >
          <CalendarGrid
            year={viewYear}
            month={viewMonth}
            selectedDay={selDate?.getDate() ?? null}
            selectedMonth={selDate?.getMonth() ?? null}
            selectedYear={selDate?.getFullYear() ?? null}
            onSelect={handleCalendarSelect}
            onMonthChange={(y, m) => { setViewYear(y); setViewMonth(m); }}
          />
          <TimePicker
            hour={hour}
            minute={minute}
            onChangeHour={handleHourChange}
            onChangeMinute={handleMinuteChange}
          />
        </div>,
        document.body
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Conversion helpers
// ---------------------------------------------------------------------------

function parseISO(iso: string): Date | null {
  if (!iso) return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return isNaN(d.getTime()) ? null : d;
}

function parseDatetime(dt: string): Date | null {
  if (!dt) return null;
  // Try full datetime first
  const m = dt.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (m) {
    const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
    return isNaN(d.getTime()) ? null : d;
  }
  // Fall back to date-only (treat as 00:00)
  const dm = dt.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dm) {
    const d = new Date(+dm[1], +dm[2] - 1, +dm[3], 0, 0);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** YYYY-MM-DD → DD/MM/YYYY */
function isoToDisplay(iso: string): string {
  if (!iso) return '';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** DD/MM/YYYY → YYYY-MM-DD (returns '' if invalid) */
function displayToISO(display: string): string {
  const m = display.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return '';
  const [, dd, mm, yyyy] = m;
  const d = new Date(+yyyy, +mm - 1, +dd);
  if (isNaN(d.getTime()) || d.getDate() !== +dd) return '';
  return `${yyyy}-${mm}-${dd}`;
}

/** Auto-insert slashes: "2802" → "28/02", "28022026" → "28/02/2026" */
function autoSlash(raw: string): string {
  const digits = raw.replace(/\//g, '');
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return digits.slice(0, 2) + '/' + digits.slice(2);
  return digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4, 8);
}

/** YYYY-MM-DDTHH:mm → DD/MM/YYYY HH:mm (also handles date-only → 00:00) */
function datetimeToDisplay(dt: string): string {
  if (!dt) return '';
  const m = dt.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}`;
  // Date-only fallback
  const dm = dt.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dm) return `${dm[3]}/${dm[2]}/${dm[1]} 00:00`;
  return '';
}

/** DD/MM/YYYY HH:mm → YYYY-MM-DDTHH:mm (returns '' if invalid) */
function displayToDatetime(display: string): string {
  const m = display.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/);
  if (!m) return '';
  const [, dd, mm, yyyy, hh, min] = m;
  const d = new Date(+yyyy, +mm - 1, +dd, +hh, +min);
  if (isNaN(d.getTime()) || d.getDate() !== +dd) return '';
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

/** Auto-insert slashes and colon for datetime */
function autoSlashDatetime(raw: string): string {
  const parts = raw.split(/\s+/);
  const datePart = autoSlash(parts[0] || '');
  if (parts.length < 2) return datePart;
  const timeRaw = parts[1].replace(/:/g, '');
  let timePart = '';
  if (timeRaw.length <= 2) timePart = timeRaw;
  else timePart = timeRaw.slice(0, 2) + ':' + timeRaw.slice(2, 4);
  return datePart + ' ' + timePart;
}
