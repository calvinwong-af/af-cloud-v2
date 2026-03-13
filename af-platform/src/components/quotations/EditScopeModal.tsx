'use client';

import { useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { updateShipmentScopeAction } from '@/app/actions/ground-transport';
import type { ScopeFlags } from '@/app/actions/ground-transport';
import { updateQuotationScopeSnapshotAction, setTlxReleaseAction } from '@/app/actions/quotations';

// ---------------------------------------------------------------------------
// Incoterm scope rules (mirrored from CreateQuotationModal)
// ---------------------------------------------------------------------------

type ScopeMode = 'ASSIGNED' | 'TRACKED' | 'IGNORED';

const INCOTERM_TASK_RULES: Record<string, Record<string, string[]>> = {
  EXW: {
    EXPORT: [],
    IMPORT: ['first_mile', 'export_clearance', 'freight', 'import_clearance', 'last_mile'],
    DOMESTIC: ['first_mile', 'freight', 'import_clearance', 'last_mile'],
  },
  FCA: {
    EXPORT: ['export_clearance'],
    IMPORT: ['first_mile', 'freight', 'import_clearance', 'last_mile'],
    DOMESTIC: ['freight', 'last_mile'],
  },
  FOB: {
    EXPORT: ['first_mile', 'export_clearance'],
    IMPORT: ['freight', 'import_clearance', 'last_mile'],
    DOMESTIC: ['first_mile', 'freight', 'last_mile'],
  },
  CFR: {
    EXPORT: ['first_mile', 'export_clearance', 'freight'],
    IMPORT: ['import_clearance', 'last_mile'],
    DOMESTIC: ['first_mile', 'freight', 'last_mile'],
  },
  CIF: {
    EXPORT: ['first_mile', 'export_clearance', 'freight'],
    IMPORT: ['import_clearance', 'last_mile'],
    DOMESTIC: ['first_mile', 'freight', 'last_mile'],
  },
  CNF: {
    EXPORT: ['first_mile', 'export_clearance', 'freight'],
    IMPORT: ['import_clearance', 'last_mile'],
    DOMESTIC: ['first_mile', 'freight', 'last_mile'],
  },
  CPT: {
    EXPORT: ['first_mile', 'export_clearance', 'freight'],
    IMPORT: ['import_clearance', 'last_mile'],
    DOMESTIC: ['first_mile', 'freight', 'last_mile'],
  },
  CIP: {
    EXPORT: ['first_mile', 'export_clearance', 'freight'],
    IMPORT: ['import_clearance', 'last_mile'],
    DOMESTIC: ['first_mile', 'freight', 'last_mile'],
  },
  DAP: {
    EXPORT: ['first_mile', 'export_clearance', 'freight', 'import_clearance', 'last_mile'],
    IMPORT: ['freight', 'import_clearance', 'last_mile'],
    DOMESTIC: ['first_mile', 'freight', 'last_mile'],
  },
  DPU: {
    EXPORT: ['first_mile', 'export_clearance', 'freight', 'import_clearance', 'last_mile'],
    IMPORT: ['freight', 'import_clearance', 'last_mile'],
    DOMESTIC: ['first_mile', 'freight', 'last_mile'],
  },
  DDP: {
    EXPORT: ['first_mile', 'export_clearance', 'freight', 'import_clearance', 'last_mile'],
    IMPORT: ['freight', 'import_clearance', 'last_mile'],
    DOMESTIC: ['first_mile', 'freight', 'last_mile'],
  },
};

const ALL_SCOPE_KEYS = ['first_mile', 'export_clearance', 'freight', 'import_clearance', 'last_mile'];

function getEligibleScopeKeys(incoterm: string, transactionType: string): string[] {
  if (!incoterm || !transactionType) return ALL_SCOPE_KEYS;
  const rules = INCOTERM_TASK_RULES[incoterm.toUpperCase()];
  if (!rules) return ALL_SCOPE_KEYS;
  return rules[transactionType.toUpperCase()] ?? ALL_SCOPE_KEYS;
}

function getScopeLabel(key: string, orderType: string): string {
  switch (key) {
    case 'first_mile':
      return orderType === 'SEA_FCL' ? 'First Mile Haulage' : 'First Mile Trucking';
    case 'export_clearance':
      return 'Export Clearance';
    case 'freight':
      return 'Freight';
    case 'import_clearance':
      return 'Import Clearance';
    case 'last_mile':
      return orderType === 'SEA_FCL' ? 'Last Mile Haulage' : 'Last Mile Trucking';
    default:
      return key;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface EditScopeModalProps {
  quotationRef: string;
  shipmentId: string;
  incoterm: string;
  transactionType: string;
  orderType: string;
  currentScope: Record<string, string>;
  currentTlxRelease: boolean;
  onClose: () => void;
  onSaved: (newScope: Record<string, string>, newTlxRelease: boolean) => void;
}

export function EditScopeModal({
  quotationRef,
  shipmentId,
  incoterm,
  transactionType,
  orderType,
  currentScope,
  currentTlxRelease,
  onClose,
  onSaved,
}: EditScopeModalProps) {
  const [scope, setScope] = useState<Record<string, string>>({ ...currentScope });
  const [tlxRelease, setTlxRelease] = useState(currentTlxRelease);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eligibleKeys = getEligibleScopeKeys(incoterm, transactionType);

  function handleScopeChange(key: string, mode: ScopeMode) {
    setScope(prev => ({ ...prev, [key]: mode }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      // 1. Build scope payload and save to shipment
      const scopePayload: ScopeFlags = {
        first_mile: (scope.first_mile as ScopeMode) ?? 'IGNORED',
        export_clearance: (scope.export_clearance as ScopeMode) ?? 'IGNORED',
        import_clearance: (scope.import_clearance as ScopeMode) ?? 'IGNORED',
        last_mile: (scope.last_mile as ScopeMode) ?? 'IGNORED',
        freight: (scope.freight as ScopeMode) ?? 'IGNORED',
      };
      const scopeResult = await updateShipmentScopeAction(shipmentId, scopePayload);
      if (!scopeResult || !scopeResult.success) {
        setError(scopeResult?.error ?? 'Failed to save scope to shipment');
        setSaving(false);
        return;
      }

      // 2. Stamp scope snapshot on quotation
      const snapshotResult = await updateQuotationScopeSnapshotAction(quotationRef, scope);
      if (!snapshotResult || !snapshotResult.success) {
        setError(snapshotResult?.error ?? 'Failed to update quotation scope');
        setSaving(false);
        return;
      }

      // 3. TLX release — only if changed
      if (tlxRelease !== currentTlxRelease) {
        const tlxResult = await setTlxReleaseAction(quotationRef, tlxRelease);
        if (!tlxResult || !tlxResult.success) {
          setError(tlxResult?.error ?? 'Failed to update telex release');
          setSaving(false);
          return;
        }
      }

      onSaved(scope, tlxRelease);
    } catch {
      setError('Failed to save scope');
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h2 className="text-sm font-semibold text-[var(--text)]">Edit Scope</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-1">
          {/* TLX Release — first row, Yes/No radio toggle */}
          <div className="flex items-center justify-between gap-3 py-2">
            <span className="text-sm text-gray-900">Telex Release</span>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden gap-0.5 p-0.5">
              {([true, false] as const).map(val => (
                <button
                  key={String(val)}
                  onClick={() => setTlxRelease(val)}
                  className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    tlxRelease === val
                      ? val
                        ? 'bg-[var(--sky)] text-white'
                        : 'bg-gray-200 text-gray-600'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {val ? 'Yes' : 'No'}
                </button>
              ))}
            </div>
          </div>

          {eligibleKeys.length > 0 && <hr className="border-[var(--border)] my-1" />}

          {eligibleKeys.length === 0 ? null : eligibleKeys.map(key => (
            <div key={key} className="flex items-center justify-between gap-3 py-2">
              <span className="text-sm text-gray-900">{getScopeLabel(key, orderType)}</span>
              <div className="flex rounded-lg border border-gray-200 overflow-hidden gap-0.5 p-0.5">
                {(['ASSIGNED', 'TRACKED', 'IGNORED'] as ScopeMode[]).map(mode => (
                  <button
                    key={mode}
                    onClick={() => handleScopeChange(key, mode)}
                    className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      scope[key] === mode
                        ? mode === 'ASSIGNED'
                          ? 'bg-[var(--sky)] text-white'
                          : mode === 'TRACKED'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-gray-200 text-gray-600'
                        : 'text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    {mode.charAt(0) + mode.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {error && (
            <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">{error}</div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--border)]">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-[var(--sky)] rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
