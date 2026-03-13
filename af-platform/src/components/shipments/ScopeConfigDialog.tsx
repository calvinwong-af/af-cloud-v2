'use client';

import { useState, useEffect } from 'react';
import { Loader2, X } from 'lucide-react';
import { fetchShipmentScopeAction, updateShipmentScopeAction } from '@/app/actions/ground-transport';
import type { ScopeFlags } from '@/app/actions/ground-transport';

type ScopeMode = 'ASSIGNED' | 'TRACKED' | 'IGNORED';

interface ScopeConfigDialogProps {
  shipmentId: string;
  orderType: string;
  incoterm: string;
  transactionType: string;
  onClose: () => void;
  onSaved: () => void;
}

const SCOPE_KEYS: (keyof ScopeFlags)[] = ['first_mile', 'export_clearance', 'import_clearance', 'last_mile'];

// Mirror of backend logic/incoterm_tasks.py get_eligible_scope_keys
const INCOTERM_TASK_RULES: Record<string, Record<string, string[]>> = {
  EXW: {
    EXPORT: [],
    IMPORT: ['first_mile', 'export_clearance', 'import_clearance', 'last_mile'],
    DOMESTIC: ['first_mile', 'import_clearance', 'last_mile'],
  },
  FCA: {
    // Seller delivers to named place already cleared for export — exporter only scopes export_clearance
    // Importer scope = EXW import minus export_clearance (seller already handled it)
    EXPORT: ['export_clearance'],
    IMPORT: ['first_mile', 'import_clearance', 'last_mile'],
    DOMESTIC: ['last_mile'],
  },
  FOB: {
    EXPORT: ['first_mile', 'export_clearance'],
    IMPORT: ['import_clearance', 'last_mile'],
    DOMESTIC: ['first_mile', 'last_mile'],
  },
  CFR: {
    EXPORT: ['first_mile', 'export_clearance'],
    IMPORT: ['import_clearance', 'last_mile'],
    DOMESTIC: ['first_mile', 'last_mile'],
  },
  CIF: {
    EXPORT: ['first_mile', 'export_clearance'],
    IMPORT: ['import_clearance', 'last_mile'],
    DOMESTIC: ['first_mile', 'last_mile'],
  },
  CNF: {
    EXPORT: ['first_mile', 'export_clearance'],
    IMPORT: ['import_clearance', 'last_mile'],
    DOMESTIC: ['first_mile', 'last_mile'],
  },
  CPT: {
    EXPORT: ['first_mile', 'export_clearance'],
    IMPORT: ['import_clearance', 'last_mile'],
    DOMESTIC: ['first_mile', 'last_mile'],
  },
  CIP: {
    EXPORT: ['first_mile', 'export_clearance'],
    IMPORT: ['import_clearance', 'last_mile'],
    DOMESTIC: ['first_mile', 'last_mile'],
  },
  DAP: {
    EXPORT: ['first_mile', 'export_clearance', 'import_clearance', 'last_mile'],
    IMPORT: ['import_clearance', 'last_mile'],
    DOMESTIC: ['first_mile', 'last_mile'],
  },
  DPU: {
    EXPORT: ['first_mile', 'export_clearance', 'import_clearance', 'last_mile'],
    IMPORT: ['import_clearance', 'last_mile'],
    DOMESTIC: ['first_mile', 'last_mile'],
  },
  DDP: {
    EXPORT: ['first_mile', 'export_clearance', 'import_clearance', 'last_mile'],
    IMPORT: ['import_clearance', 'last_mile'],
    DOMESTIC: ['first_mile', 'last_mile'],
  },
};

function getEligibleScopeKeys(incoterm: string, transactionType: string): string[] {
  const rules = INCOTERM_TASK_RULES[incoterm.toUpperCase()];
  if (!rules) return [];
  return rules[transactionType.toUpperCase()] ?? [];
}

function getScopeLabel(key: keyof ScopeFlags, orderType: string): string {
  switch (key) {
    case 'first_mile':
      return orderType === 'SEA_FCL' ? 'First Mile Haulage' : 'First Mile Trucking';
    case 'export_clearance':
      return 'Export Clearance';
    case 'import_clearance':
      return 'Import Clearance';
    case 'last_mile':
      return orderType === 'SEA_FCL' ? 'Last Mile Haulage' : 'Last Mile Trucking';
  }
  return key;
}

const MODE_OPTIONS: { value: ScopeMode; label: string; desc: string }[] = [
  { value: 'ASSIGNED', label: 'Assigned', desc: 'AcceleFreight manages this leg' },
  { value: 'TRACKED', label: 'Tracked', desc: 'Another party manages; AF monitors only' },
  { value: 'IGNORED', label: 'Not in Scope', desc: 'Excluded entirely' },
];

export default function ScopeConfigDialog({
  shipmentId,
  orderType,
  incoterm,
  transactionType,
  onClose,
  onSaved,
}: ScopeConfigDialogProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<Record<string, ScopeMode>>({});

  // Eligible keys derived from incoterm rules — stable regardless of stored scope values
  const eligibleKeys = getEligibleScopeKeys(incoterm, transactionType);

  useEffect(() => {
    async function load() {
      try {
        const result = await fetchShipmentScopeAction(shipmentId);
        if (!result) { setError('No response'); setLoading(false); return; }
        if (result.success) {
          setScope(result.data as unknown as Record<string, ScopeMode>);
        } else {
          setError(result.error);
        }
      } catch {
        setError('Failed to load scope');
      }
      setLoading(false);
    }
    load();
  }, [shipmentId]);

  // Show keys that are eligible per incoterm rules
  const visibleKeys = SCOPE_KEYS.filter(k => eligibleKeys.includes(k));

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const result = await updateShipmentScopeAction(shipmentId, scope as Partial<ScopeFlags>);
      if (!result) { setError('No response'); setSaving(false); return; }
      if (result.success) {
        onSaved();
        onClose();
      } else {
        setError(result.error);
      }
    } catch {
      setError('Failed to save scope');
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h3 className="text-base font-semibold text-[var(--text)]">Configure Scope</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--surface)] transition-colors">
            <X className="w-4 h-4 text-[var(--text-muted)]" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-[var(--sky)]" />
            </div>
          ) : visibleKeys.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] text-center py-4">
              No configurable scope legs for this incoterm.
            </p>
          ) : (
            <div className="space-y-5">
              {visibleKeys.map(key => (
                <div key={key}>
                  <div className="text-sm font-medium text-[var(--text)] mb-2">
                    {getScopeLabel(key, orderType)}
                  </div>
                  <div className="flex gap-1 rounded-lg border border-[var(--border)] p-0.5">
                    {MODE_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setScope(prev => ({ ...prev, [key]: opt.value }))}
                        className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${
                          scope[key] === opt.value
                            ? opt.value === 'ASSIGNED'
                              ? 'bg-[var(--sky)] text-white'
                              : opt.value === 'TRACKED'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-gray-200 text-gray-600'
                            : 'text-[var(--text-muted)] hover:bg-[var(--surface)]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {scope[key] === 'TRACKED' && (
                    <p className="text-[11px] text-[var(--text-muted)] mt-1 italic">
                      You will be able to monitor timing only. No action functions available.
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--border)]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="px-4 py-2 text-sm font-medium text-white bg-[var(--sky)] rounded-lg transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
