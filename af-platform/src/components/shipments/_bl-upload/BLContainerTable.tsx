'use client';

import { X } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BLContainer {
  container_number: string | null;
  container_type: string | null;
  seal_number: string | null;
  packages: string | null;
  weight_kg: number | null;
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface BLContainerTableProps {
  containers: BLContainer[];
  onChange: (containers: BLContainer[]) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function BLContainerTable({ containers, onChange }: BLContainerTableProps) {
  const inputBase = 'w-full px-2 py-1.5 text-xs border rounded-lg text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--sky)] focus:border-transparent';

  function updateRow(i: number, field: keyof BLContainer, value: string | number | null) {
    onChange(containers.map((c, idx) => idx === i ? { ...c, [field]: value } : c));
  }

  function addRow() {
    onChange([...containers, { container_number: null, container_type: null, seal_number: null, packages: null, weight_kg: null }]);
  }

  function removeRow(i: number) {
    if (containers.length > 1) onChange(containers.filter((_, idx) => idx !== i));
  }

  return (
    <div className="border border-[var(--border)] rounded-lg overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-[var(--surface)]">
          <tr>
            <th className="text-left px-3 py-2 text-[var(--text-muted)] font-medium">Container No.</th>
            <th className="text-left px-3 py-2 text-[var(--text-muted)] font-medium">Type</th>
            <th className="text-left px-3 py-2 text-[var(--text-muted)] font-medium">Seal</th>
            <th className="text-left px-3 py-2 text-[var(--text-muted)] font-medium">Packages</th>
            <th className="text-right px-3 py-2 text-[var(--text-muted)] font-medium">Weight (kg)</th>
            <th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {containers.map((c, i) => (
            <tr key={i} className="border-t border-[var(--border)]">
              <td className="px-2 py-1.5">
                <input
                  type="text"
                  value={c.container_number ?? ''}
                  onChange={e => updateRow(i, 'container_number', e.target.value || null)}
                  className={`${inputBase} font-mono`}
                  placeholder="e.g. ABCU1234567"
                />
              </td>
              <td className="px-2 py-1.5">
                <input
                  type="text"
                  value={c.container_type ?? ''}
                  onChange={e => updateRow(i, 'container_type', e.target.value || null)}
                  className={inputBase}
                  placeholder="e.g. DRY"
                />
              </td>
              <td className="px-2 py-1.5">
                <input
                  type="text"
                  value={c.seal_number ?? ''}
                  onChange={e => updateRow(i, 'seal_number', e.target.value || null)}
                  className={inputBase}
                  placeholder="Seal no."
                />
              </td>
              <td className="px-2 py-1.5">
                <input
                  type="text"
                  value={c.packages ?? ''}
                  onChange={e => updateRow(i, 'packages', e.target.value || null)}
                  className={inputBase}
                  placeholder="Qty"
                />
              </td>
              <td className="px-2 py-1.5">
                <input
                  type="number"
                  value={c.weight_kg ?? ''}
                  onChange={e => updateRow(i, 'weight_kg', e.target.value ? parseFloat(e.target.value) : null)}
                  className={`${inputBase} text-right`}
                  placeholder="—"
                  min={0}
                  step="0.01"
                />
              </td>
              <td className="px-2 py-1.5 text-center">
                {containers.length > 1 && (
                  <button
                    onClick={() => removeRow(i)}
                    className="text-[var(--text-muted)] hover:text-red-500 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        onClick={addRow}
        className="w-full py-2 text-xs text-[var(--sky)] hover:bg-[var(--sky-mist)] border-t border-[var(--border)] transition-colors"
      >
        + Add Container Row
      </button>
    </div>
  );
}
