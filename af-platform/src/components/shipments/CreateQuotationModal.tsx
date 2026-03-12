'use client';

import { useState, useEffect } from 'react';
import { Loader2, X, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { fetchShipmentScopeAction, updateShipmentScopeAction } from '@/app/actions/ground-transport';
import type { ScopeFlags } from '@/app/actions/ground-transport';
import { createQuotationAction } from '@/app/actions/quotations';
import type { QuotationTransportDetail } from '@/app/actions/quotations';

// ---------------------------------------------------------------------------
// Incoterm scope rules (mirrors ScopeConfigDialog / backend)
// ---------------------------------------------------------------------------

type ScopeMode = 'ASSIGNED' | 'TRACKED' | 'IGNORED';

const INCOTERM_TASK_RULES: Record<string, Record<string, string[]>> = {
  EXW: {
    EXPORT: [],
    IMPORT: ['first_mile', 'export_clearance', 'import_clearance', 'last_mile'],
    DOMESTIC: ['first_mile', 'import_clearance', 'last_mile'],
  },
  FCA: {
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

// ---------------------------------------------------------------------------
// Vehicle types
// ---------------------------------------------------------------------------

const VEHICLE_TYPES = [
  { id: 'lorry_1t', label: '1 Ton Lorry', category: 'lorry' },
  { id: 'lorry_3t', label: '3 Ton Lorry', category: 'lorry' },
  { id: 'lorry_5t', label: '5 Ton Lorry', category: 'lorry' },
  { id: 'lorry_10t', label: '10 Ton Lorry', category: 'lorry' },
  { id: 'trailer_20', label: '20ft Trailer', category: 'trailer' },
  { id: 'trailer_40', label: '40ft Trailer', category: 'trailer' },
];

function getDefaultVehicleType(orderType: string, containerSizes: string[]): string {
  if (orderType !== 'SEA_FCL' || containerSizes.length === 0) return '';
  if (containerSizes.includes('40HC') || containerSizes.includes('40')) return 'trailer_40';
  if (containerSizes.includes('20')) return 'trailer_20';
  return '';
}

function getVehicleOptions(orderType: string) {
  if (orderType === 'SEA_FCL') return VEHICLE_TYPES;
  return VEHICLE_TYPES.filter(v => v.category === 'lorry');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getScopeLabel(key: string, orderType: string): string {
  switch (key) {
    case 'first_mile':
      return orderType === 'SEA_FCL' ? 'First Mile Haulage' : 'First Mile Trucking';
    case 'export_clearance':
      return 'Export Clearance';
    case 'import_clearance':
      return 'Import Clearance';
    case 'last_mile':
      return orderType === 'SEA_FCL' ? 'Last Mile Haulage' : 'Last Mile Trucking';
    default:
      return key;
  }
}

function getModeBadgeClass(mode: ScopeMode): string {
  switch (mode) {
    case 'ASSIGNED': return 'bg-sky-100 text-sky-700';
    case 'TRACKED': return 'bg-amber-100 text-amber-800';
    case 'IGNORED': return 'bg-gray-200 text-gray-600';
  }
}

function getVehicleLabel(id: string): string {
  return VEHICLE_TYPES.find(v => v.id === id)?.label ?? id;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface CreateQuotationModalProps {
  shipmentId: string;
  orderType: string;
  incoterm: string;
  transactionType: string;
  containerSizes: string[];
  onClose: () => void;
  onCreated: (quotationRef: string) => void;
}

export default function CreateQuotationModal({
  shipmentId, orderType, incoterm, transactionType, containerSizes, onClose, onCreated,
}: CreateQuotationModalProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Scope state
  const eligibleKeys = getEligibleScopeKeys(incoterm, transactionType);
  const [scope, setScope] = useState<Record<string, ScopeMode>>({});

  // Transport details state
  const [transportDetails, setTransportDetails] = useState<Record<string, { vehicle_type_id: string; address: string }>>({});

  // Notes
  const [notes, setNotes] = useState('');

  // Load existing scope on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await fetchShipmentScopeAction(shipmentId);
        if (cancelled) return;
        if (result.success && result.data) {
          const loaded: Record<string, ScopeMode> = {};
          for (const key of eligibleKeys) {
            loaded[key] = (result.data as Record<string, string>)[key] as ScopeMode ?? 'IGNORED';
          }
          setScope(loaded);

          // Init transport details for ASSIGNED transport legs
          const defaultVehicle = getDefaultVehicleType(orderType, containerSizes);
          const td: Record<string, { vehicle_type_id: string; address: string }> = {};
          for (const key of ['first_mile', 'last_mile']) {
            if (loaded[key] === 'ASSIGNED') {
              td[key] = { vehicle_type_id: defaultVehicle, address: '' };
            }
          }
          setTransportDetails(td);
        } else {
          const init: Record<string, ScopeMode> = {};
          for (const key of eligibleKeys) init[key] = 'IGNORED';
          setScope(init);
        }
      } catch {
        setError('Failed to load scope');
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipmentId]);

  // Update transport details when scope changes
  function handleScopeChange(key: string, mode: ScopeMode) {
    setScope(prev => ({ ...prev, [key]: mode }));

    if (key === 'first_mile' || key === 'last_mile') {
      if (mode === 'ASSIGNED') {
        setTransportDetails(prev => ({
          ...prev,
          [key]: prev[key] ?? { vehicle_type_id: getDefaultVehicleType(orderType, containerSizes), address: '' },
        }));
      } else {
        setTransportDetails(prev => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }
    }
  }

  const assignedTransportLegs = Object.keys(transportDetails);
  const hasTransportStep = assignedTransportLegs.length > 0;
  const totalSteps = hasTransportStep ? 3 : 2;

  // Effective step mapping: if no transport step, step 2 = review
  const isReviewStep = hasTransportStep ? step === 3 : step === 2;
  const isTransportStep = hasTransportStep && step === 2;

  function canGoNext(): boolean {
    if (step === 1) return true;
    if (isTransportStep) {
      return assignedTransportLegs.every(key => {
        const td = transportDetails[key];
        return td && td.address.trim() !== '' && td.vehicle_type_id !== '';
      });
    }
    return true;
  }

  function handleNext() {
    if (!canGoNext()) return;
    setError(null);
    setStep(s => s + 1);
  }

  function handleBack() {
    setError(null);
    setStep(s => s - 1);
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      // 1. Save scope back to shipment
      const scopePayload: ScopeFlags = {
        first_mile: (scope.first_mile as ScopeMode) ?? 'IGNORED',
        export_clearance: (scope.export_clearance as ScopeMode) ?? 'IGNORED',
        import_clearance: (scope.import_clearance as ScopeMode) ?? 'IGNORED',
        last_mile: (scope.last_mile as ScopeMode) ?? 'IGNORED',
      };
      const scopeResult = await updateShipmentScopeAction(shipmentId, scopePayload);
      if (!scopeResult) { setError('No response from scope save'); setSubmitting(false); return; }
      if (!scopeResult.success) { setError(scopeResult.error ?? 'Failed to save scope'); setSubmitting(false); return; }

      // 2. Create quotation
      const tdPayload: QuotationTransportDetail[] = assignedTransportLegs.map(key => ({
        leg: key as 'first_mile' | 'last_mile',
        vehicle_type_id: transportDetails[key].vehicle_type_id,
        address: transportDetails[key].address,
      }));

      const result = await createQuotationAction({
        shipment_id: shipmentId,
        scope_snapshot: scope,
        transport_details: tdPayload,
        notes: notes.trim() || null,
      });

      if (!result) { setError('No response from server'); setSubmitting(false); return; }
      if (result.success) {
        onCreated(result.data.quotation_ref);
      } else {
        setError(result.error ?? 'Failed to create quotation');
      }
    } catch {
      setError('Failed to create quotation');
    }
    setSubmitting(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-[var(--card)] rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <div>
            <h2 className="text-base font-semibold text-[var(--text)]">Create Quotation</h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Step {step} of {totalSteps}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[var(--surface)] text-[var(--text-muted)]">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step indicators */}
        <div className="flex gap-1 px-5 pt-3">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i + 1 <= step ? 'bg-[var(--sky)]' : 'bg-[var(--border)]'
              }`}
            />
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-[var(--sky)]" />
            </div>
          ) : (
            <>
              {/* Step 1: Scope Confirmation */}
              {step === 1 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-[var(--text)]">Confirm Scope</p>
                  {eligibleKeys.length === 0 ? (
                    <p className="text-sm text-[var(--text-muted)] py-4">
                      No scope legs applicable for this incoterm.
                    </p>
                  ) : (
                    eligibleKeys.map(key => (
                      <div key={key} className="flex items-center justify-between gap-3">
                        <span className="text-sm text-[var(--text)]">{getScopeLabel(key, orderType)}</span>
                        <div className="flex rounded-lg border border-[var(--border)] overflow-hidden gap-0.5 p-0.5">
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
                                  : 'text-[var(--text-muted)] hover:bg-[var(--surface)]'
                              }`}
                            >
                              {mode.charAt(0) + mode.slice(1).toLowerCase()}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Step 2: Transport Details (conditional) */}
              {isTransportStep && (
                <div className="space-y-5">
                  <p className="text-sm font-medium text-[var(--text)]">Transport Details</p>
                  {assignedTransportLegs.map(key => (
                    <div key={key} className="space-y-2.5 p-3 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
                      <p className="text-xs font-semibold text-[var(--text)] uppercase tracking-wide">
                        {key === 'first_mile' ? 'First Mile' : 'Last Mile'}
                      </p>
                      <div>
                        <label className="block text-xs text-[var(--text-muted)] mb-1">Vehicle Type</label>
                        <select
                          value={transportDetails[key]?.vehicle_type_id ?? ''}
                          onChange={e => setTransportDetails(prev => ({
                            ...prev,
                            [key]: { ...prev[key], vehicle_type_id: e.target.value },
                          }))}
                          className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--text)]"
                        >
                          <option value="">Select vehicle type</option>
                          {getVehicleOptions(orderType).map(v => (
                            <option key={v.id} value={v.id}>{v.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-[var(--text-muted)] mb-1">
                          {key === 'first_mile' ? 'Pickup Address' : 'Delivery Address'}
                        </label>
                        <input
                          type="text"
                          value={transportDetails[key]?.address ?? ''}
                          onChange={e => setTransportDetails(prev => ({
                            ...prev,
                            [key]: { ...prev[key], address: e.target.value },
                          }))}
                          placeholder={key === 'first_mile' ? 'Pickup address' : 'Delivery address'}
                          className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--text)] placeholder:text-[var(--text-muted)]"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Review Step */}
              {isReviewStep && (
                <div className="space-y-4">
                  <p className="text-sm font-medium text-[var(--text)]">Review & Confirm</p>

                  <div className="p-3 rounded-lg bg-[var(--surface)] border border-[var(--border)] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[var(--text-muted)]">Shipment</span>
                      <span className="text-xs font-medium text-[var(--text)]">{shipmentId}</span>
                    </div>

                    {/* Scope summary */}
                    <div>
                      <span className="text-xs text-[var(--text-muted)] block mb-1.5">Scope</span>
                      <div className="space-y-1">
                        {eligibleKeys.map(key => (
                          <div key={key} className="flex items-center justify-between">
                            <span className="text-xs text-[var(--text)]">{getScopeLabel(key, orderType)}</span>
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${getModeBadgeClass(scope[key] ?? 'IGNORED')}`}>
                              {scope[key] ?? 'IGNORED'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Transport details summary */}
                    {assignedTransportLegs.length > 0 && (
                      <div>
                        <span className="text-xs text-[var(--text-muted)] block mb-1.5">Transport</span>
                        <div className="space-y-1.5">
                          {assignedTransportLegs.map(key => (
                            <div key={key} className="text-xs text-[var(--text)]">
                              <span className="font-medium">{key === 'first_mile' ? 'First Mile' : 'Last Mile'}</span>
                              {' — '}
                              {getVehicleLabel(transportDetails[key]?.vehicle_type_id ?? '')}
                              <br />
                              <span className="text-[var(--text-muted)]">{transportDetails[key]?.address}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-xs text-[var(--text-muted)] mb-1">Notes (optional)</label>
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--text)] placeholder:text-[var(--text-muted)] resize-none"
                      placeholder="Any additional notes..."
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {/* Error */}
          {error && (
            <div className="mt-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--border)]">
          <div>
            {step > 1 && (
              <button
                onClick={handleBack}
                disabled={submitting}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[var(--text-mid)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface)] transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Back
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={submitting}
              className="px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
            >
              Cancel
            </button>
            {isReviewStep ? (
              <button
                onClick={handleSubmit}
                disabled={submitting || loading}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-[var(--sky)] rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                Create Quotation
              </button>
            ) : (
              <button
                onClick={handleNext}
                disabled={!canGoNext() || loading}
                className="flex items-center gap-1 px-4 py-1.5 text-xs font-medium text-white bg-[var(--sky)] rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
