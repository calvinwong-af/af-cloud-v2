'use client';

import type { PackageRow, OrderType } from './_types';
import { PACKAGING_TYPES } from './_constants';

// ─── Props ───────────────────────────────────────────────────────────────────

interface StepCargoProps {
  cargoDescription: string;
  setCargoDescription: (s: string) => void;
  cargoHsCode: string;
  setCargoHsCode: (s: string) => void;
  cargoDg: boolean;
  setCargoDg: (b: boolean) => void;
  packageRows: PackageRow[];
  setPackageRows: (rows: PackageRow[]) => void;
  orderType: OrderType;
  // When true, only the package table is shown (used for step 4 non-FCL)
  packagesOnly?: boolean;
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

export function StepCargo({
  cargoDescription,
  setCargoDescription,
  cargoHsCode,
  setCargoHsCode,
  cargoDg,
  setCargoDg,
  packageRows,
  setPackageRows,
  packagesOnly,
}: StepCargoProps) {
  function addPackage() {
    setPackageRows([...packageRows, { packaging_type: 'CARTON', quantity: 1, gross_weight_kg: null, volume_cbm: null }]);
  }
  function removePackage(i: number) {
    if (packageRows.length > 1) setPackageRows(packageRows.filter((_, idx) => idx !== i));
  }
  function updatePackage(i: number, field: keyof PackageRow, value: string | number | null) {
    setPackageRows(packageRows.map((p, idx) => idx === i ? { ...p, [field]: value } : p));
  }

  // When packagesOnly=true, only the package table is rendered (step 4 for non-FCL)
  if (packagesOnly) {
    return (
      <div className="space-y-4">
        <p className="text-xs text-[var(--text-muted)]">Enter the total gross weight and volume for each package row.</p>
        {packageRows.map((p, i) => (
          <div key={i} className="border border-[var(--border)] rounded-lg p-3">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="grid grid-cols-3 gap-2 flex-1 items-end">
                <div className="col-span-1">
                  <FieldLabel required>Packaging</FieldLabel>
                  <select value={p.packaging_type} onChange={e => updatePackage(i, 'packaging_type', e.target.value)} className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--sky)] h-[38px] align-middle">
                    {PACKAGING_TYPES.map(pt => <option key={pt.value} value={pt.value}>{pt.label}</option>)}
                  </select>
                </div>
                <div>
                  <FieldLabel required>Qty</FieldLabel>
                  <input type="number" min={1} value={p.quantity} onChange={e => updatePackage(i, 'quantity', parseInt(e.target.value) || 1)} className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--sky)] h-[38px]" />
                </div>
                <div>
                  <FieldLabel>Total Weight (kg)</FieldLabel>
                  <input type="number" min={0} step="0.01" value={p.gross_weight_kg ?? ''} placeholder="—" onChange={e => updatePackage(i, 'gross_weight_kg', e.target.value ? parseFloat(e.target.value) : null)} className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--sky)] h-[38px]" />
                </div>
              </div>
              {packageRows.length > 1 && (
                <button onClick={() => removePackage(i)} className="mt-5 text-red-400 hover:text-red-600 text-lg leading-none flex-shrink-0">×</button>
              )}
            </div>
            <div className="w-1/3 pr-2">
              <FieldLabel>Total Volume (CBM)</FieldLabel>
              <input type="number" min={0} step="0.001" value={p.volume_cbm ?? ''} placeholder="—" onChange={e => updatePackage(i, 'volume_cbm', e.target.value ? parseFloat(e.target.value) : null)} className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--sky)]" />
            </div>
          </div>
        ))}
        <button onClick={addPackage} className="w-full py-2 border border-dashed border-[var(--border)] rounded-lg text-sm text-[var(--sky)] hover:bg-[var(--sky-mist)] transition-colors">
          + Add Package
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <FieldLabel>Cargo Description</FieldLabel>
        <textarea
          value={cargoDescription}
          onChange={e => setCargoDescription(e.target.value)}
          placeholder="e.g. Electronic components, automotive parts"
          rows={3}
          className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--sky)] focus:border-transparent resize-none"
        />
      </div>
      <div>
        <FieldLabel>HS Code</FieldLabel>
        <input
          type="text"
          value={cargoHsCode}
          onChange={e => setCargoHsCode(e.target.value)}
          placeholder="e.g. 8471.30"
          className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--sky)] focus:border-transparent"
        />
      </div>
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="dg-check"
          checked={cargoDg}
          onChange={e => setCargoDg(e.target.checked)}
          className="w-4 h-4 accent-[var(--sky)]"
        />
        <label htmlFor="dg-check" className="text-sm text-[var(--text)]">
          This shipment contains Dangerous Goods (DG)
        </label>
      </div>
      {cargoDg && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
          DG classification details can be added after the shipment order is created.
        </div>
      )}
    </div>
  );
}
