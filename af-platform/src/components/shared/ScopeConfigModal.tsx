'use client';

import { useState, useEffect } from 'react';
import { Loader2, X, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { fetchShipmentScopeAction, updateShipmentScopeAction, fetchTransportOrderByTaskAction, setHaulageAreaAction } from '@/app/actions/ground-transport';
import { createQuotationAction, updateQuotationScopeSnapshotAction, setTlxReleaseAction } from '@/app/actions/quotations';
import { fetchHaulageAreasAction } from '@/app/actions/geography';
import type { HaulageArea } from '@/app/actions/geography';

// ---------------------------------------------------------------------------
// Incoterm scope rules — single authoritative copy
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

function getModeLabel(mode: ScopeMode): string {
  if (mode === 'IGNORED') return 'Not in Scope';
  return mode.charAt(0) + mode.slice(1).toLowerCase();
}

function getModeBadgeClass(mode: ScopeMode): string {
  switch (mode) {
    case 'ASSIGNED': return 'bg-sky-100 text-sky-700';
    case 'TRACKED': return 'bg-amber-100 text-amber-800';
    case 'IGNORED': return 'bg-gray-200 text-gray-600';
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ScopeConfigModalProps {
  shipmentId: string;
  orderType: string;
  incoterm: string;
  transactionType: string;
  containerSummary?: string | null;
  containerSizes?: string[];
  containerNumbers?: string[];
  originPortCode?: string | null;
  originPortName?: string | null;
  destinationPortCode?: string | null;
  destinationPortName?: string | null;
  mode: 'configure' | 'create-quotation';
  quotationRef?: string | null;
  onClose: () => void;
  onSaved?: () => void;
  onScopeUpdated?: (newScope: Record<string, string>, newTlxRelease: boolean) => void;
  onCreated?: (quotationRef: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ScopeConfigModal({
  shipmentId, orderType, incoterm, transactionType,
  containerSummary, containerSizes, containerNumbers,
  originPortCode, originPortName, destinationPortCode, destinationPortName,
  mode, quotationRef,
  onClose, onSaved, onScopeUpdated, onCreated,
}: ScopeConfigModalProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Scope state
  const eligibleKeys = getEligibleScopeKeys(incoterm, transactionType);
  const [scope, setScope] = useState<Record<string, ScopeMode>>({});
  const [tlxRelease, setTlxRelease] = useState(false);
  const [initialTlxRelease, setInitialTlxRelease] = useState(false);

  // Area state
  const [areasByLeg, setAreasByLeg] = useState<Record<string, HaulageArea[]>>({});
  const [areasLoading, setAreasLoading] = useState<Record<string, boolean>>({});
  const [areaSearch, setAreaSearch] = useState<Record<string, string>>({});
  const [areaOpen, setAreaOpen] = useState<Record<string, boolean>>({});
  const [selectedAreaId, setSelectedAreaId] = useState<Record<string, number | null>>({});

  // Notes (create-quotation mode only)
  const [notes, setNotes] = useState('');

  // Helper to fetch areas for a leg
  async function fetchAreasForLeg(key: string): Promise<HaulageArea[]> {
    const portCode = key === 'first_mile' ? originPortCode : destinationPortCode;
    if (!portCode) return [];
    const sizes = containerSizes && containerSizes.length > 0
      ? Array.from(new Set([...containerSizes, 'wildcard']))
      : ['wildcard'];
    const result = await fetchHaulageAreasAction(portCode, sizes);
    return result.success ? result.data : [];
  }

  // Helper to load existing GT order area for a leg
  async function loadExistingArea(key: string): Promise<number | null> {
    const taskRef = key === 'first_mile' ? 'ORIGIN_HAULAGE' : 'DESTINATION_HAULAGE';
    const stopType = key === 'first_mile' ? 'pickup' : 'dropoff';
    const result = await fetchTransportOrderByTaskAction(shipmentId, taskRef);
    if (result.success) {
      const stop = result.data.stops.find(s => s.stop_type === stopType);
      return stop?.area_id ?? null;
    }
    return null;
  }

  // Load existing scope on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await fetchShipmentScopeAction(shipmentId);
        if (cancelled) return;
        if (result.success && result.data) {
          const rawData = result.data as unknown as Record<string, unknown>;
          const loaded: Record<string, ScopeMode> = {};
          for (const key of eligibleKeys) {
            loaded[key] = (rawData[key] as ScopeMode) ?? 'IGNORED';
          }
          setScope(loaded);
          const tlx = !!rawData.tlx_release;
          setTlxRelease(tlx);
          setInitialTlxRelease(tlx);

          // Fetch areas and existing GT order area for ASSIGNED haulage legs
          const assignedHaulageLegs = ['first_mile', 'last_mile'].filter(k => loaded[k] === 'ASSIGNED');
          if (assignedHaulageLegs.length > 0) {
            for (const key of assignedHaulageLegs) {
              if (cancelled) break;
              setAreasLoading(prev => ({ ...prev, [key]: true }));
              const [areas, existingAreaId] = await Promise.all([
                fetchAreasForLeg(key),
                loadExistingArea(key),
              ]);
              if (cancelled) break;
              setAreasByLeg(prev => ({ ...prev, [key]: areas }));
              if (existingAreaId != null) {
                setSelectedAreaId(prev => ({ ...prev, [key]: existingAreaId }));
                const match = areas.find(a => a.area_id === existingAreaId);
                if (match) {
                  setAreaSearch(prev => ({ ...prev, [key]: match.area_name }));
                }
              }
              setAreasLoading(prev => ({ ...prev, [key]: false }));
            }
          }
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

  // Handle scope toggle
  function handleScopeChange(key: string, newMode: ScopeMode) {
    setScope(prev => ({ ...prev, [key]: newMode }));

    // Fetch areas when toggling a haulage leg to ASSIGNED
    if ((key === 'first_mile' || key === 'last_mile') && newMode === 'ASSIGNED' && !areasByLeg[key]) {
      setAreasLoading(prev => ({ ...prev, [key]: true }));
      Promise.all([fetchAreasForLeg(key), loadExistingArea(key)]).then(([areas, existingAreaId]) => {
        setAreasByLeg(prev => ({ ...prev, [key]: areas }));
        if (existingAreaId != null) {
          setSelectedAreaId(prev => ({ ...prev, [key]: existingAreaId }));
          const match = areas.find(a => a.area_id === existingAreaId);
          if (match) {
            setAreaSearch(prev => ({ ...prev, [key]: match.area_name }));
          }
        }
        setAreasLoading(prev => ({ ...prev, [key]: false }));
      });
    }

    // Clear area selection when toggling away from ASSIGNED
    if ((key === 'first_mile' || key === 'last_mile') && newMode !== 'ASSIGNED') {
      setSelectedAreaId(prev => ({ ...prev, [key]: null }));
      setAreaSearch(prev => ({ ...prev, [key]: '' }));
    }
  }

  function canGoNext(): boolean {
    if (step !== 1) return true;
    for (const key of ['first_mile', 'last_mile']) {
      if (scope[key] === 'ASSIGNED' && (areasByLeg[key] ?? []).length > 0 && selectedAreaId[key] == null) {
        return false;
      }
    }
    return true;
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const scopePayload = {
        first_mile: (scope.first_mile as ScopeMode) ?? 'IGNORED',
        export_clearance: (scope.export_clearance as ScopeMode) ?? 'IGNORED',
        import_clearance: (scope.import_clearance as ScopeMode) ?? 'IGNORED',
        last_mile: (scope.last_mile as ScopeMode) ?? 'IGNORED',
        tlx_release: tlxRelease,
      };

      // 1. Save scope to shipment
      const scopeResult = await updateShipmentScopeAction(shipmentId, scopePayload);
      if (!scopeResult || !scopeResult.success) {
        setError(scopeResult?.error ?? 'Failed to save scope');
        setSubmitting(false);
        return;
      }

      // 2. Save area selections to GT orders (non-blocking — scope already saved)
      const areaPromises: Promise<unknown>[] = [];
      for (const key of ['first_mile', 'last_mile'] as const) {
        if (scope[key] === 'ASSIGNED' && selectedAreaId[key] != null) {
          areaPromises.push(
            setHaulageAreaAction({
              shipmentId,
              legKey: key,
              areaId: selectedAreaId[key]!,
              orderType,
              portUnCode: key === 'first_mile' ? originPortCode : destinationPortCode,
              portName: key === 'first_mile' ? originPortName : destinationPortName,
              containerNumbers: containerNumbers ?? [],
            }).catch(err => console.error(`[setHaulageAreaAction:${key}]`, err))
          );
        }
      }
      if (areaPromises.length > 0) {
        await Promise.all(areaPromises);
      }

      if (mode === 'configure') {
        // If quotation context, also update quotation
        if (quotationRef) {
          // Stamp scope snapshot
          const snapResult = await updateQuotationScopeSnapshotAction(quotationRef, scope);
          if (!snapResult || !snapResult.success) {
            setError(snapResult?.error ?? 'Failed to update quotation scope');
            setSubmitting(false);
            return;
          }

          // TLX release — only if changed
          if (tlxRelease !== initialTlxRelease) {
            const tlxResult = await setTlxReleaseAction(quotationRef, tlxRelease);
            if (!tlxResult || !tlxResult.success) {
              setError(tlxResult?.error ?? 'Failed to update telex release');
              setSubmitting(false);
              return;
            }
          }

          onScopeUpdated?.(scope, tlxRelease);
        } else {
          onSaved?.();
        }
      } else {
        // mode === 'create-quotation'
        const result = await createQuotationAction({
          shipment_id: shipmentId,
          scope_snapshot: scope,
          notes: notes.trim() || null,
        });

        if (!result) { setError('No response from server'); setSubmitting(false); return; }
        if (result.success) {
          onCreated?.(result.data.quotation_ref);
        } else {
          setError(result.error ?? 'Failed to create quotation');
        }
      }
    } catch {
      setError(mode === 'create-quotation' ? 'Failed to create quotation' : 'Failed to save scope');
    }
    setSubmitting(false);
  }

  const modalTitle = mode === 'configure' ? 'Configure Scope' : 'Create Quotation';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{modalTitle}</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Step {step} of 2
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step indicators */}
        <div className="flex gap-1 px-5 pt-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i + 1 <= step ? 'bg-[var(--sky)]' : 'bg-gray-200'
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
              {/* Step 1: Scope Flags + Area */}
              {step === 1 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-900 mb-3">Confirm Scope</p>
                  {containerSummary && (
                    <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mb-3">
                      <span className="text-xs text-gray-500">Containers</span>
                      <span className="font-mono text-xs text-gray-700">{containerSummary}</span>
                    </div>
                  )}

                  {/* Telex Release — top row, conditional on export_clearance === ASSIGNED */}
                  <div style={{
                    maxHeight: scope['export_clearance'] === 'ASSIGNED' ? '80px' : '0px',
                    opacity: scope['export_clearance'] === 'ASSIGNED' ? 1 : 0,
                    overflow: 'hidden',
                    transition: 'max-height 300ms ease-in-out, opacity 200ms ease-in-out',
                  }}>
                    <div className="flex items-center justify-between py-2">
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
                  </div>

                  {eligibleKeys.length === 0 ? (
                    <p className="text-sm text-gray-500 py-4">No scope legs applicable for this incoterm.</p>
                  ) : (
                    eligibleKeys.map(key => {
                      const isHaulageLeg = key === 'first_mile' || key === 'last_mile';
                      const isAssigned = scope[key] === 'ASSIGNED';
                      const legAreas = areasByLeg[key] ?? [];
                      const search = areaSearch[key] ?? '';
                      const filteredAreas = legAreas.filter(a =>
                        !search ||
                        a.area_name.toLowerCase().includes(search.toLowerCase()) ||
                        a.area_code.toLowerCase().includes(search.toLowerCase())
                      );

                      return (
                        <div key={key}>
                          {/* Scope toggle row */}
                          <div className="flex items-center justify-between gap-3 py-2">
                            <span className="text-sm text-gray-900">{getScopeLabel(key, orderType)}</span>
                            <div className="flex rounded-lg border border-gray-200 overflow-hidden gap-0.5 p-0.5">
                              {(['ASSIGNED', 'TRACKED', 'IGNORED'] as ScopeMode[]).map(m => (
                                <button
                                  key={m}
                                  onClick={() => handleScopeChange(key, m)}
                                  className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                                    scope[key] === m
                                      ? m === 'ASSIGNED'
                                        ? 'bg-[var(--sky)] text-white'
                                        : m === 'TRACKED'
                                        ? 'bg-amber-100 text-amber-800'
                                        : 'bg-gray-200 text-gray-600'
                                      : 'text-gray-500 hover:bg-gray-100'
                                  }`}
                                >
                                  {getModeLabel(m)}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Area combobox — only for first_mile / last_mile when ASSIGNED */}
                          {isHaulageLeg && (
                            <div
                              style={{
                                maxHeight: isAssigned ? '200px' : '0px',
                                opacity: isAssigned ? 1 : 0,
                                overflow: isAssigned ? 'visible' : 'hidden',
                                transition: 'max-height 300ms ease-in-out, opacity 200ms ease-in-out',
                              }}
                            >
                              <div className="ml-2 pl-3 border-l-2 border-sky-100 pb-3">
                                <label className="block text-xs text-gray-500 mb-1">Area / Zone</label>
                                {areasLoading[key] ? (
                                  <div className="flex items-center gap-2 py-2 text-xs text-gray-400">
                                    <Loader2 className="w-3 h-3 animate-spin" /> Loading areas...
                                  </div>
                                ) : legAreas.length === 0 ? (
                                  <p className="text-xs text-gray-400 py-1">No haulage areas found for this port</p>
                                ) : (
                                  <div className="relative">
                                    <input
                                      type="text"
                                      value={areaSearch[key] ?? ''}
                                      onChange={e => {
                                        setAreaSearch(prev => ({ ...prev, [key]: e.target.value }));
                                        setAreaOpen(prev => ({ ...prev, [key]: true }));
                                        setSelectedAreaId(prev => ({ ...prev, [key]: null }));
                                      }}
                                      onFocus={() => setAreaOpen(prev => ({ ...prev, [key]: true }))}
                                      onBlur={() => setTimeout(() => setAreaOpen(prev => ({ ...prev, [key]: false })), 200)}
                                      placeholder="Search area or zone..."
                                      className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white text-gray-900 placeholder:text-gray-400"
                                    />
                                    {areaOpen[key] && (
                                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                                        {filteredAreas.length === 0 ? (
                                          <div className="px-3 py-2 text-xs text-gray-400">No matching areas</div>
                                        ) : (
                                          filteredAreas.map(a => (
                                            <button
                                              key={a.area_id}
                                              type="button"
                                              onMouseDown={() => {
                                                setSelectedAreaId(prev => ({ ...prev, [key]: a.area_id }));
                                                setAreaSearch(prev => ({ ...prev, [key]: a.area_name }));
                                                setAreaOpen(prev => ({ ...prev, [key]: false }));
                                              }}
                                              className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 text-left"
                                            >
                                              <span className="text-gray-900">{a.area_name}</span>
                                              <span className="text-xs text-gray-400 font-mono ml-2">{a.area_code}</span>
                                            </button>
                                          ))
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* Step 2: Review & Confirm */}
              {step === 2 && (
                <div className="space-y-4">
                  <p className="text-sm font-medium text-gray-900">Review & Confirm</p>

                  <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Shipment</span>
                      <span className="text-xs font-medium text-gray-900">{shipmentId}</span>
                    </div>

                    {containerSummary && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">Containers</span>
                        <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 border border-gray-200">
                          {containerSummary}
                        </span>
                      </div>
                    )}

                    {/* Scope summary */}
                    <div>
                      <span className="text-xs text-gray-500 block mb-1.5">Scope</span>
                      <div className="space-y-1">
                        {eligibleKeys.map(key => {
                          const areaId = selectedAreaId[key];
                          const areaName = areaId != null
                            ? (areasByLeg[key] ?? []).find(a => a.area_id === areaId)?.area_name ?? null
                            : null;
                          return (
                            <div key={key}>
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-900">{getScopeLabel(key, orderType)}</span>
                                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${getModeBadgeClass(scope[key] ?? 'IGNORED')}`}>
                                  {getModeLabel(scope[key] ?? 'IGNORED')}
                                </span>
                              </div>
                              {scope[key] === 'ASSIGNED' && areaName && (
                                <div className="text-[11px] text-gray-500 ml-3 mt-0.5">
                                  {areaName}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* TLX release */}
                    {scope['export_clearance'] === 'ASSIGNED' && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">Telex Release</span>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${tlxRelease ? 'bg-sky-100 text-sky-700' : 'bg-gray-200 text-gray-600'}`}>
                          {tlxRelease ? 'Yes' : 'No'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Notes (optional)</label>
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 resize-none"
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
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200">
          <div>
            {step > 1 && (
              <button
                onClick={() => { setError(null); setStep(s => s - 1); }}
                disabled={submitting}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
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
              className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
            {step === 2 ? (
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
                {mode === 'create-quotation' ? 'Create Quotation' : 'Save'}
              </button>
            ) : (
              <button
                onClick={() => { setError(null); setStep(s => s + 1); }}
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
