'use client';

interface TerminalSelectorProps {
  terminals: Array<{ terminal_id: string; name: string; is_default: boolean }>;
  value: string;
  onChange: (id: string) => void;
  label?: string;
}

export default function TerminalSelector({ terminals, value, onChange, label = 'Terminal' }: TerminalSelectorProps) {
  return (
    <div className="mt-2">
      <label className="block text-xs font-medium text-[var(--text-mid)] mb-1">{label}</label>
      <div className="flex gap-2 flex-wrap">
        {terminals.map(t => (
          <button
            key={t.terminal_id}
            type="button"
            onClick={() => onChange(t.terminal_id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              value === t.terminal_id
                ? 'bg-[var(--slate)] text-white border-[var(--slate)]'
                : 'bg-white text-[var(--text-mid)] border-[var(--border)] hover:border-[var(--sky)]'
            }`}
          >
            {t.name}
            {t.is_default && value !== t.terminal_id && (
              <span className="ml-1 text-[var(--text-muted)]">(default)</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
