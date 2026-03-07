'use client';

import { useState, useRef, useEffect } from 'react';
import TerminalSelector from '@/components/shared/TerminalSelector';

interface PortTerminal {
  terminal_id: string;
  name: string;
  is_default: boolean;
}

interface PortComboboxOption {
  value: string;
  label: string;
  sublabel?: string;
  terminals?: PortTerminal[];
  has_terminals?: boolean;
}

export function PortCombobox({
  value,
  onChange,
  options,
  placeholder,
  className,
  withTerminal,
  terminalValue,
  onTerminalChange,
}: {
  value: string;
  onChange: (value: string) => void;
  options: PortComboboxOption[];
  placeholder?: string;
  className?: string;
  withTerminal?: boolean;
  terminalValue?: string;
  onTerminalChange?: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState<number>(-1);
  const listRef = useRef<HTMLDivElement>(null);

  // Clear query when value is externally cleared
  useEffect(() => {
    if (!value) setQuery('');
  }, [value]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlighted >= 0 && listRef.current) {
      const item = listRef.current.children[highlighted] as HTMLElement;
      item?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlighted]);

  // Auto-apply default terminal when port is set but terminal is empty.
  // Fires when value, options, or terminalValue changes — covers both:
  // (a) async ports data arriving after mount with pre-filled port
  // (b) port change clearing the terminal, triggering re-assignment
  useEffect(() => {
    if (!withTerminal || !value || !options.length || terminalValue || !onTerminalChange) return;
    const opt = options.find(o => o.value === value);
    if (!opt?.terminals?.length) return;
    const def = opt.terminals.find(t => t.is_default) ?? opt.terminals[0];
    onTerminalChange(def.terminal_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, options, terminalValue]);

  const filtered = query.trim().length === 0
    ? options.slice(0, 80)
    : options.filter(o =>
        o.label.toLowerCase().includes(query.toLowerCase()) ||
        o.value.toLowerCase().includes(query.toLowerCase()) ||
        (o.sublabel ?? '').toLowerCase().includes(query.toLowerCase())
      ).slice(0, 80);

  const selectedOption = options.find(o => o.value === value);
  const selectedLabel = selectedOption?.label ?? '';
  const inputValue = open ? query : selectedLabel;

  function handleSelect(opt: PortComboboxOption) {
    onChange(opt.value);
    setQuery(opt.label);
    setOpen(false);
    setHighlighted(-1);

    // Terminal auto-apply on port selection
    if (withTerminal && onTerminalChange) {
      const terminals = opt.terminals ?? [];
      if (terminals.length > 0) {
        const def = terminals.find(t => t.is_default) ?? terminals[0];
        onTerminalChange(def.terminal_id);
      } else {
        onTerminalChange('');
      }
    }
  }

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
          handleSelect(filtered[highlighted]);
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

  const inputCls = className ?? 'w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--sky)] focus:border-transparent';

  const showTerminal = withTerminal && selectedOption?.has_terminals && (selectedOption.terminals?.length ?? 0) > 0 && onTerminalChange;

  return (
    <>
    <div className="relative">
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
        onBlur={() => {
          setOpen(false);
          setHighlighted(-1);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        className={inputCls}
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
                handleSelect(o);
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
    {showTerminal && (
      <TerminalSelector
        terminals={selectedOption!.terminals!}
        value={terminalValue ?? ''}
        onChange={onTerminalChange!}
      />
    )}
    </>
  );
}
