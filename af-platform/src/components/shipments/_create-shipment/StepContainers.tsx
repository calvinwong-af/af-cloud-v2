'use client';

import type { ContainerRow } from './_types';
import { CONTAINER_SIZES, CONTAINER_TYPES } from './_constants';

// ─── Props ───────────────────────────────────────────────────────────────────

interface StepContainersProps {
  containerRows: ContainerRow[];
  setContainerRows: (rows: ContainerRow[]) => void;
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-medium text-[var(--text-mid)] mb-1">
      {children}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function StepContainers({ containerRows, setContainerRows }: StepContainersProps) {
  function addContainer() {
    setContainerRows([...containerRows, { container_size: '20GP', container_type: 'DRY', quantity: 1 }]);
  }
  function removeContainer(i: number) {
    if (containerRows.length > 1) setContainerRows(containerRows.filter((_, idx) => idx !== i));
  }
  function updateContainer(i: number, field: keyof ContainerRow, value: string | number) {
    setContainerRows(containerRows.map((c, idx) => idx === i ? { ...c, [field]: value } : c));
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--text-muted)]">Container numbers and seal numbers are assigned later.</p>
      {containerRows.map((c, i) => (
        <div key={i} className="grid grid-cols-12 gap-2 items-end border border-[var(--border)] rounded-lg p-3">
          <div className="col-span-4">
            <FieldLabel required>Size</FieldLabel>
            <select value={c.container_size} onChange={e => updateContainer(i, 'container_size', e.target.value)} className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--sky)]">
              {CONTAINER_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="col-span-4">
            <FieldLabel required>Type</FieldLabel>
            <select value={c.container_type} onChange={e => updateContainer(i, 'container_type', e.target.value)} className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--sky)]">
              {CONTAINER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="col-span-3">
            <FieldLabel required>Qty</FieldLabel>
            <input type="number" min={1} value={c.quantity} onChange={e => updateContainer(i, 'quantity', parseInt(e.target.value) || 1)} className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--sky)]" />
          </div>
          <div className="col-span-1 flex justify-center pb-0.5">
            {containerRows.length > 1 && (
              <button onClick={() => removeContainer(i)} className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
            )}
          </div>
        </div>
      ))}
      <button onClick={addContainer} className="w-full py-2 border border-dashed border-[var(--border)] rounded-lg text-sm text-[var(--sky)] hover:bg-[var(--sky-mist)] transition-colors">
        + Add Container
      </button>
    </div>
  );
}
