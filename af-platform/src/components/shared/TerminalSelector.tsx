'use client';

import { useEffect } from 'react';

interface TerminalSelectorProps {
  terminals: Array<{ terminal_id: string; name: string; is_default: boolean }>;
  value: string;
  onChange: (id: string) => void;
  label?: string;
}

export default function TerminalSelector({ terminals, value, onChange, label = 'Terminal' }: TerminalSelectorProps) {
  // Auto-select the default terminal when terminals list changes and nothing is selected
  useEffect(() => {
    if (!value && terminals.length > 0) {
      const defaultTerminal = terminals.find(t => t.is_default) ?? terminals[0];
      onChange(defaultTerminal.terminal_id);
    }
  }, [terminals]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mt-2">
      <label className="block text-xs font-medium text-[var(--text-mid)] mb-1">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--sky)] focus:border-transparent"
      >
        <option value="">Select terminal...</option>
        {terminals.map(t => (
          <option key={t.terminal_id} value={t.terminal_id}>
            {t.name}{t.is_default ? ' (default)' : ''}
          </option>
        ))}
      </select>
    </div>
  );
}
