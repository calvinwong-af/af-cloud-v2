'use client';

import { useState, useEffect } from 'react';
import { Loader2, X, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { fetchShipmentScopeAction, updateShipmentScopeAction } from '@/app/actions/ground-transport';
import type { ScopeFlags } from '@/app/actions/ground-transport';
import { createQuotationAction } from '@/app/actions/quotations';
import type { QuotationTransportDetail } from '@/app/actions/quotations';
import { fetchHaulageAreasAction } from '@/app/actions/geography';
import type { HaulageArea } from '@/app/actions/geography';

// ---------------------------------------------------------------------------
// Incoterm scope rules (mirrors ScopeConfigDialog / backend)
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
  containerSummary?: string | null;
  originPortCode?: string | null;
  destinationPortCode?: string | null;
  onClose: () => void;
  onCreated: (quotationRef: string) => void;
}

export default function CreateQuotationModal({
  shipmentId, orderType, incoterm, transactionType, containerSizes, containerSummary,
  originPortCode, destinationPortCode, onClose, onCreated,
}: CreateQuotationModalProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Scope state
  const eligibleKeys = getEligibleScopeKeys(incoterm, transactionType);
  const [scope, setScope] = useState<Record<string, ScopeMode>>({});

  // Transport details state — includes area_id
  const [transportDetails, setTransportDetails] = useState<Record<string, { vehicle_type_id: string; address: string; area_id: number | null }>>({});

  // Area state
  const [areasByLeg, setAreasByLeg] = useState<Record<string, HaulageArea[]>>({});
  const [areasLoading, setAreasLoading] = useState(false);

  // Area combobox state
  const [areaSearch, setAreaSearch] = useState<Record<string, string>>({});
  const [areaOpen, setAreaOpen] = useState<Record<string, boolean>>({});

  // Notes
  const [notes, setNotes] = useState('');

  // Helper to fetch areas for a leg
  async function fetchAreasForLeg(key: string): Promise<HaulageArea[]> {
    const portCode = key === 'first_mile' ? originPortCode : destinationPortCode;
    if (!portCode) return [];
    const sizes = containerSizes.length > 0
      ? Array.from(new Set([...containerSizes, 'wildcard']))
      : ['wildcard'];
    const result = await fetchHaulageAreasAction(portCode, sizes);
    return result.success ? result.data : [];
  }

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
            loaded[key] = (result.data as unknown as Record<string, string>)[key] as ScopeMode ?? 'IGNORED';
          }
          setScope(loaded);

          // Init transport details for ASSIGNED transport legs
          const defaultVehicle = getDefaultVehicleType(orderType, containerSizes);
          const td: Record<string, { vehicle_type_id: string; address: string; area_id: number | null }> = {};
          for (const key of ['first_mile', 'last_mile']) {
            if (loaded[key] === 'ASSIGNED') {
              td[key] = { vehicle_type_id: defaultVehicle, address: '', area_id: null };
            }
          }
          setTransportDetails(td);

          // Fetch haulage areas for ASSIGNED transport legs
          setAreasLoading(true);
          const areaFetches: Record<string, HaulageArea[]> = {};
          for (const key of ['first_mile', 'last_mile']) {
            if (loaded[key] === 'ASSIGNED') {
              if (!cancelled) {
                areaFetches[key] = await fetchAreasForLeg(key);
              }
            }
          }
          if (!cancelled) {
            setAreasByLeg(areaFetches);
            setAreasLoading(false);
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

  // Update transport details when scope changes
  function handleScopeChange(key: string, mode: ScopeMode) {
    setScope(prev => ({ ...prev, [key]: mode }));

    if (key === 'first_mile' || key === 'last_mile') {
      if (mode === 'ASSIGNED') {
        setTransportDetails(prev => ({
          ...prev,
          [key]: prev[key] ?? { vehicle_type_id: getDefaultVehicleType(orderType, containerSizes), address: '', area_id: null },
        }));
        // Fetch areas if not already loaded
        if (!areasByLeg[key]) {
          fetchAreasForLeg(key).then(areas => {
            setAreasByLeg(prev => ({ ...prev, [key]: areas }));
          });
        }
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

  function canGoNext(): boolean {
    if (step === 1) {
      return assignedTransportLegs.every(key => {
        const td = transportDetails[key];
        if (!td) return false;
        if (orderType !== 'SEA_FCL' && td.vehicle_type_id === '') return false;
        if ((areasByLeg[key] ?? []).length > 0 && td.area_id === null) return false;
        return true;
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
        freight: (scope.freight as ScopeMode) ?? 'IGNORED',
      };
      const scopeResult = await updateShipmentScopeAction(shipmentId, scopePayload);
      if (!scopeResult) { setError('No response from scope save'); setSubmitting(false); return; }
      if (!scopeResult.success) { setError(scopeResult.error ?? 'Failed to save scope'); setSubmitting(false); return; }

      // 2. Create quotation
      const tdPayload: QuotationTransportDetail[] = assignedTransportLegs.map(key => ({
        leg: key as 'first_mile' | 'last_mile',
        vehicle_type_id: orderType === 'SEA_FCL' ? null : (transportDetails[key].vehicle_type_id || null),
        address: transportDetails[key].address,
        area_id: transportDetails[key].area_id ?? null,
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Create Quotation</h2>
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
              {/* Step 1: Scope & Transport (combined) */}
              {step === 1 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-900 mb-3">Confirm Scope</p>
                  {containerSummary && (
                    <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mb-3">
                      <span className="text-xs text-gray-500">Containers</span>
                      <span className="font-mono text-xs text-gray-700">{containerSummary}</span>
                    </div>
                  )}
                  {eligibleKeys.length === 0 ? (
                    <p className="text-sm text-gray-500 py-4">No scope legs applicable for this incoterm.</p>
                  ) : (
                    eligibleKeys.map(key => {
                      const isTransportLeg = key === 'first_mile' || key === 'last_mile';
                      const isAssigned = scope[key] === 'ASSIGNED';

                      const search = areaSearch[key] ?? '';
                      const filteredAreas = (areasByLeg[key] ?? []).filter(a =>
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

                          {/* Animated transport detail expansion — only for first_mile / last_mile */}
                          {isTransportLeg && (
                            <div
                              style={{
                                maxHeight: isAssigned ? '400px' : '0px',
                                opacity: isAssigned ? 1 : 0,
                                overflow: 'hidden',
                                transition: 'max-height 300ms ease-in-out, opacity 200ms ease-in-out',
                              }}
                            >
                              <div className="ml-2 pl-3 border-l-2 border-sky-100 pb-3 space-y-2.5">

                                {/* Vehicle Type — LCL/AIR only, not FCL */}
                                {orderType !== 'SEA_FCL' && (
                                  <div>
                                    <label className="block text-xs text-gray-500 mb-1">Vehicle Type</label>
                                    <select
                                      value={transportDetails[key]?.vehicle_type_id ?? ''}
                                      onChange={e => setTransportDetails(prev => ({
                                        ...prev,
                                        [key]: { ...prev[key], vehicle_type_id: e.target.value },
                                      }))}
                                      className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white text-gray-900"
                                    >
                                      <option value="">Select vehicle type</option>
                                      {getVehicleOptions(orderType).map(v => (
                                        <option key={v.id} value={v.id}>{v.label}</option>
                                      ))}
                                    </select>
                                  </div>
                                )}

                                {/* Area / Zone combobox */}
                                <div>
                                  <label className="block text-xs text-gray-500 mb-1">Area / Zone</label>
                                  {areasLoading ? (
                                    <div className="flex items-center gap-2 py-2 text-xs text-gray-400">
                                      <Loader2 className="w-3 h-3 animate-spin" /> Loading areas…
                                    </div>
                                  ) : (areasByLeg[key] ?? []).length === 0 ? (
                                    <p className="text-xs text-gray-400 py-1">No haulage areas found for this port</p>
                                  ) : (
                                    <div className="relative">
                                      <input
                                        type="text"
                                        value={areaSearch[key] ?? ''}
                                        onChange={e => {
                                          setAreaSearch(prev => ({ ...prev, [key]: e.target.value }));
                                          setAreaOpen(prev => ({ ...prev, [key]: true }));
                                          setTransportDetails(prev => ({ ...prev, [key]: { ...prev[key], area_id: null } }));
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
                                                  setTransportDetails(prev => ({ ...prev, [key]: { ...prev[key], area_id: a.area_id } }));
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

                                {/* Address */}
                                <div>
                                  <label className="block text-xs text-gray-500 mb-1">
                                    {key === 'first_mile' ? 'Pickup Address (optional)' : 'Delivery Address (optional)'}
                                  </label>
                                  <textarea
                                    value={transportDetails[key]?.address ?? ''}
                                    onChange={e => setTransportDetails(prev => ({
                                      ...prev,
                                      [key]: { ...prev[key], address: e.target.value },
                                    }))}
                                    placeholder={key === 'first_mile' ? 'Pickup address' : 'Delivery address'}
                                    rows={3}
                                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 resize-none"
                                  />
                                </div>

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

                    {/* Container summary pill — FCL only */}
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
                        {eligibleKeys.map(key => (
                          <div key={key} className="flex items-center justify-between">
                            <span className="text-xs text-gray-900">{getScopeLabel(key, orderType)}</span>
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
                        <span className="text-xs text-gray-500 block mb-1.5">Transport</span>
                        <div className="space-y-1.5">
                          {assignedTransportLegs.map(key => {
                            const areaName = (areasByLeg[key] ?? []).find(a => a.area_id === transportDetails[key]?.area_id)?.area_name ?? null;
                            return (
                              <div key={key} className="text-xs text-gray-900">
                                <span className="font-medium">{key === 'first_mile' ? 'First Mile' : 'Last Mile'}</span>
                                {orderType !== 'SEA_FCL' && transportDetails[key]?.vehicle_type_id && (
                                  <span> — {getVehicleLabel(transportDetails[key].vehicle_type_id)}</span>
                                )}
                                {containerSummary && (
                                  <span className="ml-1.5 text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                                    {containerSummary}
                                  </span>
                                )}
                                <div className="text-xs text-gray-600 mt-0.5">
                                  {areaName ?? '—'}
                                </div>
                                {transportDetails[key]?.address && (
                                  <div className="text-xs text-gray-400 whitespace-pre-wrap">{transportDetails[key].address}</div>
                                )}
                              </div>
                            );
                          })}
                        </div>
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
                onClick={handleBack}
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
