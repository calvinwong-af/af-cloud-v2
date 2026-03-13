'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Loader2, ArrowLeft, Calculator, Pencil, Trash2, Plus, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import { getQuotationAction, listLineItemsAction, calculateQuotationAction, addManualLineItemAction, updateLineItemAction, deleteLineItemAction, fetchAreasAction } from '@/app/actions/quotations';
import type { Quotation, QuotationLineItem, LineItemTotals, ManualLineItemPayload, LineItemUpdatePayload, AreaInfo } from '@/app/actions/quotations';
import { EditScopeModal } from '@/components/quotations/EditScopeModal';

// TODO: add container summary (requires shipment data join)

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  SENT: 'bg-[rgba(59,158,255,0.1)] text-[var(--sky)]',
  ACCEPTED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-600',
  EXPIRED: 'bg-amber-100 text-amber-700',
};

const COMPONENT_LABELS: Record<string, string> = {
  ocean_freight: 'Ocean Freight',
  air_freight: 'Air Freight',
  export_local: 'Export — Local Charges',
  import_local: 'Import — Local Charges',
  export_customs: 'Export Customs',
  import_customs: 'Import Customs',
  export_haulage: 'Export Haulage',
  import_haulage: 'Import Haulage',
  export_transport: 'Export Transport',
  import_transport: 'Import Transport',
  other: 'Other',
};

const UOM_OPTIONS = [
  'SHIPMENT', 'CONTAINER', 'CBM', 'KG', 'W/M', 'CW_KG', 'SET', 'BL', 'QTL', 'RAIL_3KG',
] as const;

const UOM_DISPLAY: Record<string, string> = {
  SHIPMENT: 'SHIP',
  CONTAINER: 'CTR',
};

function fmtUom(uom: string): string {
  return UOM_DISPLAY[uom] ?? uom;
}

function getScopeLabel(key: string): string {
  switch (key) {
    case 'first_mile': return 'First Mile';
    case 'export_clearance': return 'Export Clearance';
    case 'import_clearance': return 'Import Clearance';
    case 'freight': return 'Freight';
    case 'last_mile': return 'Last Mile';
    default: return key;
  }
}

function getComponentLabel(type: string): string {
  return COMPONENT_LABELS[type] ?? type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function getTransportLabel(leg: 'first_mile' | 'last_mile', orderType: string | null | undefined): string {
  const isFCL = orderType === 'SEA_FCL';
  const mileLabel = leg === 'first_mile' ? 'First Mile' : 'Last Mile';
  const modeLabel = isFCL ? 'Haulage' : 'Transport';
  return `${mileLabel} ${modeLabel}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '\u2014';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '\u2014';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function fmtNum(v: number | null | undefined, decimals = 2): string {
  if (v == null) return '\u2014';
  return v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function marginClass(m: number | null): string {
  if (m == null) return 'text-gray-400';
  if (m >= 20) return 'text-green-600';
  if (m >= 5) return 'text-amber-600';
  return 'text-red-600';
}

// ---------------------------------------------------------------------------
// Manual line item form defaults
// ---------------------------------------------------------------------------

function defaultManualPayload(currency: string): ManualLineItemPayload {
  return {
    component_type: 'other',
    charge_code: '',
    description: '',
    uom: 'SHIPMENT',
    quantity: 1,
    price_per_unit: 0,
    cost_per_unit: 0,
    price_currency: currency,
    cost_currency: currency,
    min_price: 0,
    min_cost: 0,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function QuotationDetail({ quotationRef, accountType }: { quotationRef: string; accountType: 'AFU' | 'AFC' }) {
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // AFU users default to AFU view; AFC users always use customer view
  const [customerView, setCustomerView] = useState(accountType !== 'AFU');

  // Pricing state
  const [lineItems, setLineItems] = useState<QuotationLineItem[]>([]);
  const [totals, setTotals] = useState<LineItemTotals | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [calcWarnings, setCalcWarnings] = useState<Array<{ component_type: string; message: string }>>([]);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [quotationCurrency, setQuotationCurrency] = useState<string>('MYR');
  const [warningsOpen, setWarningsOpen] = useState(false);
  const [scopeChanged, setScopeChanged] = useState(false);
  const [tlxRelease, setTlxRelease] = useState(false);
  const [editScopeOpen, setEditScopeOpen] = useState(false);

  // Area resolution
  const [areaMap, setAreaMap] = useState<Record<number, AreaInfo>>({});

  // Other Charges group state
  const [showOtherForm, setShowOtherForm] = useState(false);
  const [otherGroupOpen, setOtherGroupOpen] = useState(true);

  // Manual form state
  const [manualPayload, setManualPayload] = useState<ManualLineItemPayload>(defaultManualPayload('MYR'));

  // Edit form state
  const [editPayload, setEditPayload] = useState<LineItemUpdatePayload & { description?: string; charge_code?: string }>({});

  async function loadLineItems() {
    try {
      const result = await listLineItemsAction(quotationRef);
      if (!result) return;
      if (result.success) {
        setLineItems(result.data.line_items);
        setTotals(result.data.totals);
        setQuotationCurrency(result.data.totals.currency);
      }
    } catch {
      // silent
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const result = await getQuotationAction(quotationRef);
        if (!result) { setError('No response'); setLoading(false); return; }
        if (result.success) {
          setQuotation(result.data);
          setScopeChanged(result.data.scope_changed ?? false);
          setTlxRelease(result.data.tlx_release ?? false);
          if (result.data.currency) setQuotationCurrency(result.data.currency);
          setManualPayload(defaultManualPayload(result.data.currency ?? 'MYR'));

          // Resolve area names from transport details
          const areaIds = (result.data.transport_details ?? [])
            .map(td => td.area_id)
            .filter((id): id is number => id != null);
          if (areaIds.length > 0) {
            const areaResult = await fetchAreasAction(areaIds);
            if (areaResult && areaResult.success) {
              setAreaMap(Object.fromEntries(areaResult.data.map(a => [a.area_id, a])));
            }
          }
        } else {
          setError(result.error);
        }
      } catch {
        setError('Failed to load quotation');
      }
      setLoading(false);
    })();
    loadLineItems();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotationRef]);

  async function handleCalculate() {
    setCalculating(true);
    setCalcError(null);
    try {
      const result = await calculateQuotationAction(quotationRef);
      if (!result) { setCalcError('No response'); setCalculating(false); return; }
      if (result.success) {
        setLineItems(result.data.line_items);
        setCalcWarnings(result.data.warnings);
        setQuotationCurrency(result.data.currency);
        setScopeChanged(false);
        await loadLineItems();
      } else {
        setCalcError(result.error);
      }
    } catch {
      setCalcError('Calculation failed');
    }
    setCalculating(false);
  }

  async function handleAddManual() {
    try {
      const payload = { ...manualPayload, component_type: 'other' };
      const result = await addManualLineItemAction(quotationRef, payload);
      if (!result) return;
      if (result.success) {
        setShowOtherForm(false);
        setManualPayload(defaultManualPayload(quotationCurrency));
        await loadLineItems();
      }
    } catch {
      // silent
    }
  }

  async function handleSaveEdit() {
    if (editingItemId == null) return;
    try {
      const result = await updateLineItemAction(quotationRef, editingItemId, editPayload);
      if (!result) return;
      if (result.success) {
        setEditingItemId(null);
        setEditPayload({});
        await loadLineItems();
      }
    } catch {
      // silent
    }
  }

  async function handleDelete(itemId: number) {
    if (!window.confirm('Delete this line item?')) return;
    try {
      const result = await deleteLineItemAction(quotationRef, itemId);
      if (!result) return;
      if (result.success) {
        await loadLineItems();
      }
    } catch {
      // silent
    }
  }

  function startEdit(item: QuotationLineItem) {
    setEditingItemId(item.id);
    setEditPayload({
      price_per_unit: item.price_per_unit,
      cost_per_unit: item.cost_per_unit,
      quantity: item.quantity,
      min_price: item.min_price,
      min_cost: item.min_cost,
      description: item.description,
      charge_code: item.charge_code,
      uom: item.uom,
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--sky)]" />
      </div>
    );
  }

  if (error || !quotation) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <Link href="/quotations" className="flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--text)] mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Quotations
        </Link>
        <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error ?? 'Quotation not found'}
        </div>
      </div>
    );
  }

  // Only show ASSIGNED scope items
  const assignedScopeKeys = Object.keys(quotation.scope_snapshot).filter(
    key => quotation.scope_snapshot[key] === 'ASSIGNED'
  );
  const transportDetails = quotation.transport_details ?? [];

  // Group line items by component_type — separate 'other' items
  const otherItems = lineItems.filter(li => li.component_type === 'other');
  const grouped: Array<{ type: string; items: QuotationLineItem[] }> = [];
  const seenTypes = new Set<string>();
  for (const li of lineItems) {
    if (li.component_type === 'other') continue;
    if (!seenTypes.has(li.component_type)) {
      seenTypes.add(li.component_type);
      grouped.push({ type: li.component_type, items: [] });
    }
    grouped.find(g => g.type === li.component_type)!.items.push(li);
  }

  // Other charges subtotals
  const otherTotalPrice = otherItems.reduce((sum, li) => sum + li.effective_price, 0);
  const otherTotalCost = otherItems.reduce((sum, li) => sum + li.effective_cost, 0);
  const otherMargin = otherTotalPrice > 0
    ? Math.round((otherTotalPrice - otherTotalCost) / otherTotalPrice * 10000) / 100
    : null;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-5">
      {/* Back row — back link left, actions right */}
      <div className="flex items-center justify-between">
        <Link href="/quotations" className="flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--text)]">
          <ArrowLeft className="w-4 h-4" /> Back to Quotations
        </Link>
        <div className="flex items-center gap-2">
          {accountType === 'AFU' && (
            <button
              onClick={() => setCustomerView(v => !v)}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
                customerView
                  ? 'bg-[var(--sky)]/10 border-[var(--sky)]/30 text-[var(--sky)]'
                  : 'bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200'
              }`}
              title={customerView ? 'Switch to AFU view' : 'Switch to customer view'}
            >
              {customerView ? 'Customer View' : 'AFU View'}
            </button>
          )}
          <button
            onClick={handleCalculate}
            disabled={calculating}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[var(--sky)] rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {calculating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calculator className="w-3.5 h-3.5" />}
            Calculate Pricing
          </button>
        </div>
      </div>

      {/* Header card */}
      <div className="bg-white border border-[var(--border)] rounded-xl p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xl font-semibold text-[var(--text)]">{quotation.quotation_ref}</span>
            <span className={`text-[10px] font-medium px-2.5 py-0.5 rounded-full ${STATUS_BADGE[quotation.status] ?? 'bg-gray-100 text-gray-600'}`}>
              {quotation.status}
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
              Rev. {quotation.revision}
            </span>
          </div>
          <div className="text-right text-xs space-y-1">
            <div>
              <span className="text-[var(--text-muted)]">Shipment </span>
              <Link href={`/shipments/${quotation.shipment_id}`} className="font-mono text-[var(--sky)] hover:underline">
                {quotation.shipment_id}
              </Link>
            </div>
            {quotation.company_name && (
              <div className="text-[var(--text-muted)]">{quotation.company_name}</div>
            )}
            <div className="text-[var(--text-muted)]">{formatDate(quotation.created_at)}</div>
            <div className="text-[var(--text-muted)]">{quotation.created_by}</div>
          </div>
        </div>
        {calcError && (
          <div className="mt-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">{calcError}</div>
        )}
      </div>

      {/* Scope changed banner */}
      {scopeChanged && (
        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-amber-800">
            <AlertTriangle className="w-4 h-4" />
            Scope has changed since last calculation. Recalculate to update pricing.
          </div>
          <button
            onClick={handleCalculate}
            disabled={calculating}
            className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-amber-800 border border-amber-300 rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-50"
          >
            {calculating && <Loader2 className="w-3 h-3 animate-spin" />}
            Recalculate
          </button>
        </div>
      )}

      {/* Warnings panel */}
      {calcWarnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setWarningsOpen(v => !v)}
            className="flex items-center justify-between w-full px-4 py-2.5 text-left"
          >
            <span className="text-xs font-medium text-amber-800">{calcWarnings.length} pricing warning(s)</span>
            {warningsOpen ? <ChevronDown className="w-3.5 h-3.5 text-amber-600" /> : <ChevronRight className="w-3.5 h-3.5 text-amber-600" />}
          </button>
          {warningsOpen && (
            <div className="px-4 pb-3 space-y-1">
              {calcWarnings.map((w, i) => (
                <div key={i} className="text-xs text-amber-700">
                  <span className="font-mono text-amber-600">{w.component_type}</span> · {w.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Scope + Transport merged card */}
      {(assignedScopeKeys.length > 0 || transportDetails.length > 0 || accountType === 'AFU') && (
        <div className="bg-white border border-[var(--border)] rounded-xl p-5">
          <div className={`grid ${transportDetails.length > 0 ? 'grid-cols-2' : 'grid-cols-1'} gap-6`}>
            {/* Left — Scope */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Scope</h3>
                {accountType === 'AFU' && (
                  <button
                    onClick={() => setEditScopeOpen(true)}
                    className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-[var(--sky)] border border-[var(--sky)]/30 rounded-md hover:bg-[var(--sky)]/5 transition-colors"
                  >
                    Edit Scope
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {assignedScopeKeys.map(key => (
                  <div key={key} className="text-sm text-[var(--text)]">{getScopeLabel(key)}</div>
                ))}
                {/* TLX Release — shown as plain label only when active */}
                {tlxRelease && (
                  <div className="text-sm text-[var(--text)]">Telex Release</div>
                )}
              </div>
            </div>
            {/* Right — Transport */}
            {transportDetails.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">Transport</h3>
                <div className="space-y-4">
                  {transportDetails.map((td, i) => (
                    <div key={i} className="space-y-1">
                      <div className="text-sm font-medium text-[var(--text)]">
                        {getTransportLabel(td.leg, quotation.order_type)}
                      </div>
                      {td.vehicle_type_id && (
                        <div className="text-xs text-[var(--text-muted)]">
                          {td.vehicle_type_id.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                        </div>
                      )}
                      {td.area_id != null && (
                        <div className="text-xs text-[var(--text-muted)]">
                          {areaMap[td.area_id]
                            ? `${areaMap[td.area_id].area_name}, ${areaMap[td.area_id].state_name}`
                            : `Area ${td.area_id}`}
                        </div>
                      )}
                      {td.address && (
                        <div className="text-xs text-[var(--text-muted)] whitespace-pre-wrap">{td.address}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notes card */}
      {quotation.notes && (
        <div className="bg-white border border-[var(--border)] rounded-xl p-5">
          <h3 className="text-sm font-medium text-[var(--text)] mb-3">Notes</h3>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{quotation.notes}</p>
        </div>
      )}

      {/* Pricing card */}
      <div className="bg-white border border-[var(--border)] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-[var(--text)]">Pricing</h3>
        </div>

        {lineItems.length === 0 && !calculating ? (
          <>
            <div className="text-center py-8 text-sm text-[var(--text-muted)]">
              No pricing calculated yet. Click &quot;Calculate Pricing&quot; to run the pricing engine.
            </div>
            {accountType === 'AFU' && !showOtherForm && (
              <div className="mt-3">
                <button
                  onClick={() => { setShowOtherForm(true); setOtherGroupOpen(true); }}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[var(--sky)] border border-[var(--sky)]/30 rounded-lg hover:bg-[var(--sky)]/5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Manual Item
                </button>
              </div>
            )}
            {showOtherForm && (
              <div className="mt-3">
                <div className="grid grid-cols-4 gap-2 bg-gray-50/50 border border-[var(--border)] rounded-lg p-3">
                  <div>
                    <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">Charge Code</label>
                    <input type="text" value={manualPayload.charge_code}
                      onChange={e => setManualPayload(p => ({ ...p, charge_code: e.target.value }))}
                      className="w-full px-2 py-1.5 text-xs rounded border border-gray-200 bg-white" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">Description</label>
                    <input type="text" value={manualPayload.description}
                      onChange={e => setManualPayload(p => ({ ...p, description: e.target.value }))}
                      className="w-full px-2 py-1.5 text-xs rounded border border-gray-200 bg-white" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">UOM</label>
                    <select value={manualPayload.uom}
                      onChange={e => setManualPayload(p => ({ ...p, uom: e.target.value }))}
                      className="w-full px-2 py-1.5 text-xs rounded border border-gray-200 bg-white">
                      {UOM_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">Qty</label>
                    <input type="number" value={manualPayload.quantity}
                      onChange={e => setManualPayload(p => ({ ...p, quantity: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-2 py-1.5 text-xs rounded border border-gray-200 bg-white" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">Price/unit</label>
                    <input type="number" value={manualPayload.price_per_unit}
                      onChange={e => setManualPayload(p => ({ ...p, price_per_unit: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-2 py-1.5 text-xs rounded border border-gray-200 bg-white" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">Cost/unit</label>
                    <input type="number" value={manualPayload.cost_per_unit}
                      onChange={e => setManualPayload(p => ({ ...p, cost_per_unit: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-2 py-1.5 text-xs rounded border border-gray-200 bg-white" />
                  </div>
                  <div className="col-span-2 flex items-end gap-2">
                    <input type="text" value={manualPayload.price_currency}
                      onChange={e => setManualPayload(p => ({ ...p, price_currency: e.target.value, cost_currency: e.target.value }))}
                      placeholder="Currency"
                      className="w-20 px-2 py-1.5 text-xs rounded border border-gray-200 bg-white" />
                    <button onClick={handleAddManual}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-[var(--sky)] rounded-lg hover:opacity-90">
                      Add
                    </button>
                    <button onClick={() => setShowOtherForm(false)}
                      className="px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700">
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left px-3 py-2 text-[11px] uppercase tracking-wide text-[var(--text-muted)] font-medium">Description</th>
                  <th className="text-left px-3 py-2 text-[11px] uppercase tracking-wide text-[var(--text-muted)] font-medium">UOM</th>
                  <th className="text-right px-3 py-2 text-[11px] uppercase tracking-wide text-[var(--text-muted)] font-medium">Qty</th>
                  <th className="text-right px-3 py-2 text-[11px] uppercase tracking-wide text-[var(--text-muted)] font-medium">Price/unit</th>
                  {!customerView && <th className="text-right px-3 py-2 text-[11px] uppercase tracking-wide text-[var(--text-muted)] font-medium">Cost/unit</th>}
                  <th className="text-right px-3 py-2 text-[11px] uppercase tracking-wide text-[var(--text-muted)] font-medium">Eff. Price</th>
                  <th className="text-right px-3 py-2 text-[11px] uppercase tracking-wide text-[var(--text-muted)] font-medium">Tax</th>
                  {!customerView && <th className="text-right px-3 py-2 text-[11px] uppercase tracking-wide text-[var(--text-muted)] font-medium">Eff. Cost</th>}
                  {!customerView && <th className="text-right px-3 py-2 text-[11px] uppercase tracking-wide text-[var(--text-muted)] font-medium">Margin</th>}
                  {!customerView && <th className="text-right px-3 py-2 text-[11px] uppercase tracking-wide text-[var(--text-muted)] font-medium w-16"></th>}
                </tr>
              </thead>
              <tbody>
                {grouped.map(group => (
                  <GroupRows
                    key={group.type}
                    type={group.type}
                    items={group.items}
                    customerView={customerView}
                    editingItemId={editingItemId}
                    editPayload={editPayload}
                    setEditPayload={setEditPayload}
                    onStartEdit={startEdit}
                    onSaveEdit={handleSaveEdit}
                    onCancelEdit={() => { setEditingItemId(null); setEditPayload({}); }}
                    onDelete={handleDelete}
                  />
                ))}

                {/* Other Charges group — only when items exist or form is open */}
                {(otherItems.length > 0 || showOtherForm) && (
                  <>
                    <tr className="cursor-pointer select-none bg-gray-50/60" onClick={() => setOtherGroupOpen(v => !v)}>
                      {customerView ? (
                        <>
                          <td colSpan={4} className="px-3 py-1.5">
                            <div className="flex items-center gap-1.5">
                              {otherGroupOpen
                                ? <ChevronDown className="w-3 h-3 text-[var(--text-muted)]" />
                                : <ChevronRight className="w-3 h-3 text-[var(--text-muted)]" />}
                              <span className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] font-semibold">
                                Other Charges
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-1.5 text-right text-[10px] font-semibold text-[var(--text)]">
                            {fmtNum(otherTotalPrice)}
                          </td>
                          <td className="px-3 py-1.5 text-right text-xs text-[var(--text-muted)]">{'\u2014'}</td>
                        </>
                      ) : (
                        <>
                          <td colSpan={5} className="px-3 py-1.5">
                            <div className="flex items-center gap-1.5">
                              {otherGroupOpen
                                ? <ChevronDown className="w-3 h-3 text-[var(--text-muted)]" />
                                : <ChevronRight className="w-3 h-3 text-[var(--text-muted)]" />}
                              <span className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] font-semibold">
                                Other Charges
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-1.5 text-right text-[10px] font-semibold text-[var(--text)]">
                            {fmtNum(otherTotalPrice)}
                          </td>
                          <td className="px-3 py-1.5 text-right text-xs text-[var(--text-muted)]">{'\u2014'}</td>
                          <td className="px-3 py-1.5 text-right text-[10px] text-[var(--text-muted)]">
                            {fmtNum(otherTotalCost)}
                          </td>
                          <td className={`px-3 py-1.5 text-right text-[10px] font-semibold ${marginClass(otherMargin)}`}>
                            {otherMargin != null ? `${otherMargin}%` : '\u2014'}
                          </td>
                          <td className="px-3 py-1.5" />
                        </>
                      )}
                    </tr>
                    {otherGroupOpen && otherItems.map((li, idx) => {
                      if (editingItemId === li.id) {
                        return (
                          <tr key={li.id} className="border-b border-[var(--border)] bg-sky-50/30">
                            <td className="pl-8 pr-3 py-2">
                              <input type="text" value={editPayload.description ?? ''} onChange={e => setEditPayload(p => ({ ...p, description: e.target.value }))}
                                className="w-full px-1.5 py-1 text-xs rounded border border-gray-200 bg-white" />
                            </td>
                            <td className="px-3 py-2">
                              <select value={editPayload.uom ?? li.uom}
                                onChange={e => setEditPayload(p => ({ ...p, uom: e.target.value }))}
                                className="w-full px-1.5 py-1 text-xs rounded border border-gray-200 bg-white">
                                {UOM_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <input type="number" value={editPayload.quantity ?? 0} onChange={e => setEditPayload(p => ({ ...p, quantity: parseFloat(e.target.value) || 0 }))}
                                className="w-20 px-1.5 py-1 text-xs rounded border border-gray-200 bg-white text-right" />
                            </td>
                            <td className="px-3 py-2">
                              <input type="number" value={editPayload.price_per_unit ?? 0} onChange={e => setEditPayload(p => ({ ...p, price_per_unit: parseFloat(e.target.value) || 0 }))}
                                className="w-20 px-1.5 py-1 text-xs rounded border border-gray-200 bg-white text-right" />
                            </td>
                            {!customerView && (
                              <td className="px-3 py-2">
                                <input type="number" value={editPayload.cost_per_unit ?? 0} onChange={e => setEditPayload(p => ({ ...p, cost_per_unit: parseFloat(e.target.value) || 0 }))}
                                  className="w-20 px-1.5 py-1 text-xs rounded border border-gray-200 bg-white text-right" />
                              </td>
                            )}
                            <td colSpan={customerView ? 1 : 2} className="px-3 py-2">
                              <div className="flex gap-1">
                                <input type="number" value={editPayload.min_price ?? 0} onChange={e => setEditPayload(p => ({ ...p, min_price: parseFloat(e.target.value) || 0 }))}
                                  className="w-16 px-1 py-1 text-xs rounded border border-gray-200 bg-white text-right" placeholder="Min P" />
                                {!customerView && (
                                  <input type="number" value={editPayload.min_cost ?? 0} onChange={e => setEditPayload(p => ({ ...p, min_cost: parseFloat(e.target.value) || 0 }))}
                                    className="w-16 px-1 py-1 text-xs rounded border border-gray-200 bg-white text-right" placeholder="Min C" />
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-xs text-[var(--text-muted)] text-right">{'\u2014'}</td>
                            {!customerView && <td className="px-3 py-2"></td>}
                            {!customerView && (
                              <td className="px-3 py-2 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <button onClick={handleSaveEdit} className="px-2 py-0.5 text-xs font-medium text-white bg-[var(--sky)] rounded hover:opacity-90">Save</button>
                                  <button onClick={() => { setEditingItemId(null); setEditPayload({}); }} className="px-2 py-0.5 text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      }
                      return (
                        <tr key={li.id} className={`border-b border-[var(--border)] last:border-b-0 ${idx % 2 === 0 ? '' : 'bg-gray-50/40'}`}>
                          <td className="pl-8 pr-3 py-2 text-xs text-[var(--text)]">
                            {li.description}
                            {li.is_manual_override && (
                              <span className="text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium ml-1">Manual</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs text-[var(--text-muted)]">{fmtUom(li.uom)}</td>
                          <td className="px-3 py-2 text-xs text-[var(--text)] text-right">{fmtNum(li.quantity, 2)}</td>
                          <td className="px-3 py-2 text-xs text-[var(--text)] text-right">{fmtNum(li.price_per_unit)} <span className="text-[var(--text-muted)]">{li.price_currency}</span></td>
                          {!customerView && <td className="px-3 py-2 text-xs text-[var(--text)] text-right">{fmtNum(li.cost_per_unit)} <span className="text-[var(--text-muted)]">{li.cost_currency}</span></td>}
                          <td className="px-3 py-2 text-xs text-[var(--text)] text-right font-medium">{fmtNum(li.effective_price)}</td>
                          <td className="px-3 py-2 text-xs text-right">
                            {li.tax_rate > 0
                              ? <span className="text-[10px] text-[var(--text-muted)] bg-gray-100 px-1.5 py-0.5 rounded">{(li.tax_rate * 100).toFixed(0)}%</span>
                              : '\u2014'}
                          </td>
                          {!customerView && <td className="px-3 py-2 text-xs text-[var(--text)] text-right">{fmtNum(li.effective_cost)}</td>}
                          {!customerView && (
                            <td className={`px-3 py-2 text-xs text-right font-medium ${marginClass(li.margin_percent)}`}>
                              {li.margin_percent != null ? `${li.margin_percent}%` : '\u2014'}
                            </td>
                          )}
                          {!customerView && (
                            <td className="px-3 py-2 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button onClick={() => startEdit(li)} className="p-1 text-gray-400 hover:text-[var(--sky)] transition-colors" title="Edit">
                                  <Pencil className="w-3 h-3" />
                                </button>
                                <button onClick={() => handleDelete(li.id)} className="p-1 text-gray-400 hover:text-red-500 transition-colors" title="Delete">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                    {otherGroupOpen && showOtherForm && (
                      <tr>
                        <td colSpan={customerView ? 6 : 10} className="px-3 py-2">
                          <div className="grid grid-cols-4 gap-2 bg-gray-50/50 border border-[var(--border)] rounded-lg p-3">
                            <div>
                              <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">Charge Code</label>
                              <input type="text" value={manualPayload.charge_code}
                                onChange={e => setManualPayload(p => ({ ...p, charge_code: e.target.value }))}
                                className="w-full px-2 py-1.5 text-xs rounded border border-gray-200 bg-white" />
                            </div>
                            <div className="col-span-2">
                              <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">Description</label>
                              <input type="text" value={manualPayload.description}
                                onChange={e => setManualPayload(p => ({ ...p, description: e.target.value }))}
                                className="w-full px-2 py-1.5 text-xs rounded border border-gray-200 bg-white" />
                            </div>
                            <div>
                              <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">UOM</label>
                              <select value={manualPayload.uom}
                                onChange={e => setManualPayload(p => ({ ...p, uom: e.target.value }))}
                                className="w-full px-2 py-1.5 text-xs rounded border border-gray-200 bg-white">
                                {UOM_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">Qty</label>
                              <input type="number" value={manualPayload.quantity}
                                onChange={e => setManualPayload(p => ({ ...p, quantity: parseFloat(e.target.value) || 0 }))}
                                className="w-full px-2 py-1.5 text-xs rounded border border-gray-200 bg-white" />
                            </div>
                            <div>
                              <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">Price/unit</label>
                              <input type="number" value={manualPayload.price_per_unit}
                                onChange={e => setManualPayload(p => ({ ...p, price_per_unit: parseFloat(e.target.value) || 0 }))}
                                className="w-full px-2 py-1.5 text-xs rounded border border-gray-200 bg-white" />
                            </div>
                            <div>
                              <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">Cost/unit</label>
                              <input type="number" value={manualPayload.cost_per_unit}
                                onChange={e => setManualPayload(p => ({ ...p, cost_per_unit: parseFloat(e.target.value) || 0 }))}
                                className="w-full px-2 py-1.5 text-xs rounded border border-gray-200 bg-white" />
                            </div>
                            <div className="col-span-2 flex items-end gap-2">
                              <input type="text" value={manualPayload.price_currency}
                                onChange={e => setManualPayload(p => ({ ...p, price_currency: e.target.value, cost_currency: e.target.value }))}
                                placeholder="Currency"
                                className="w-20 px-2 py-1.5 text-xs rounded border border-gray-200 bg-white" />
                              <button onClick={handleAddManual}
                                className="px-3 py-1.5 text-xs font-medium text-white bg-[var(--sky)] rounded-lg hover:opacity-90">
                                Add
                              </button>
                              <button onClick={() => setShowOtherForm(false)}
                                className="px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700">
                                Cancel
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Totals bar — flex row with button on left, totals on right */}
        {totals && lineItems.length > 0 && (
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--border)]">
            <div>
              {accountType === 'AFU' && !showOtherForm && (
                <button
                  onClick={() => { setShowOtherForm(true); setOtherGroupOpen(true); }}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[var(--sky)] border border-[var(--sky)]/30 rounded-lg hover:bg-[var(--sky)]/5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Manual Item
                </button>
              )}
            </div>
            <div className="flex items-start gap-6">
              <div className="text-right">
                <div className="text-xs text-[var(--text-muted)] mb-0.5">Total Price</div>
                <div className="text-sm font-semibold text-[var(--text)]">{totals.currency} {fmtNum(totals.total_price)}</div>
                {totals.total_tax > 0 && (
                  <div className="text-sm text-[var(--text-muted)] mt-1">
                    Tax (SST) {totals.currency} {fmtNum(totals.total_tax)}
                  </div>
                )}
                {totals.total_tax > 0 && (
                  <div className="text-sm font-semibold text-[var(--text)] mt-1">
                    Incl. SST {totals.currency} {fmtNum(totals.total_price + totals.total_tax)}
                  </div>
                )}
              </div>
              {!customerView && (
                <div className="text-right">
                  <div className="text-xs text-[var(--text-muted)] mb-0.5">Total Cost</div>
                  <div className="text-sm text-[var(--text)]">{totals.currency} {fmtNum(totals.total_cost)}</div>
                </div>
              )}
              {!customerView && (
                <div className="text-right">
                  <div className="text-xs text-[var(--text-muted)] mb-0.5">Margin</div>
                  <div className={`text-sm font-medium ${marginClass(totals.margin_percent)}`}>
                    {totals.margin_percent != null ? `${totals.margin_percent}%` : '\u2014'}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Edit Scope Modal */}
      {editScopeOpen && quotation && (
        <EditScopeModal
          quotationRef={quotationRef}
          shipmentId={quotation.shipment_id}
          incoterm={quotation.incoterm ?? ''}
          transactionType={quotation.transaction_type ?? ''}
          orderType={quotation.order_type ?? ''}
          currentScope={quotation.scope_snapshot}
          currentTlxRelease={tlxRelease}
          onClose={() => setEditScopeOpen(false)}
          onSaved={(newScope, newTlxRelease) => {
            setQuotation(prev => prev ? { ...prev, scope_snapshot: newScope } : prev);
            setTlxRelease(newTlxRelease);
            setScopeChanged(true);
            setEditScopeOpen(false);
          }}
        />
      )}
    </div>
  );
}


// ---------------------------------------------------------------------------
// GroupRows sub-component
// ---------------------------------------------------------------------------

function GroupRows({ type, items, customerView, editingItemId, editPayload, setEditPayload, onStartEdit, onSaveEdit, onCancelEdit, onDelete }: {
  type: string;
  items: QuotationLineItem[];
  customerView: boolean;
  editingItemId: number | null;
  editPayload: LineItemUpdatePayload & { description?: string; charge_code?: string };
  setEditPayload: (fn: (p: LineItemUpdatePayload & { description?: string; charge_code?: string }) => LineItemUpdatePayload & { description?: string; charge_code?: string }) => void;
  onStartEdit: (item: QuotationLineItem) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: (id: number) => void;
}) {
  const [isOpen, setIsOpen] = useState(true);

  const groupTotalPrice = items.reduce((sum, li) => sum + li.effective_price, 0);
  const groupTotalCost = items.reduce((sum, li) => sum + li.effective_cost, 0);
  const groupMargin = groupTotalPrice > 0
    ? Math.round((groupTotalPrice - groupTotalCost) / groupTotalPrice * 10000) / 100
    : null;

  return (
    <>
      {/* Group header — clickable toggle with column-aligned subtotals */}
      <tr className="cursor-pointer select-none bg-gray-50/60" onClick={() => setIsOpen(v => !v)}>
        {customerView ? (
          <>
            <td colSpan={4} className="px-3 py-1.5">
              <div className="flex items-center gap-1.5">
                {isOpen
                  ? <ChevronDown className="w-3 h-3 text-[var(--text-muted)]" />
                  : <ChevronRight className="w-3 h-3 text-[var(--text-muted)]" />}
                <span className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] font-semibold">
                  {getComponentLabel(type)}
                </span>
              </div>
            </td>
            <td className="px-3 py-1.5 text-right text-[10px] font-semibold text-[var(--text)]">
              {fmtNum(groupTotalPrice)}
            </td>
            <td className="px-3 py-1.5 text-right text-xs text-[var(--text-muted)]">{'\u2014'}</td>
          </>
        ) : (
          <>
            <td colSpan={5} className="px-3 py-1.5">
              <div className="flex items-center gap-1.5">
                {isOpen
                  ? <ChevronDown className="w-3 h-3 text-[var(--text-muted)]" />
                  : <ChevronRight className="w-3 h-3 text-[var(--text-muted)]" />}
                <span className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] font-semibold">
                  {getComponentLabel(type)}
                </span>
              </div>
            </td>
            <td className="px-3 py-1.5 text-right text-[10px] font-semibold text-[var(--text)]">
              {fmtNum(groupTotalPrice)}
            </td>
            <td className="px-3 py-1.5 text-right text-xs text-[var(--text-muted)]">{'\u2014'}</td>
            <td className="px-3 py-1.5 text-right text-[10px] text-[var(--text-muted)]">
              {fmtNum(groupTotalCost)}
            </td>
            <td className={`px-3 py-1.5 text-right text-[10px] font-semibold ${marginClass(groupMargin)}`}>
              {groupMargin != null ? `${groupMargin}%` : '\u2014'}
            </td>
            <td className="px-3 py-1.5" />
          </>
        )}
      </tr>
      {/* Data rows — only when open */}
      {isOpen && items.map((li, idx) => {
        if (editingItemId === li.id) {
          return (
            <tr key={li.id} className="border-b border-[var(--border)] bg-sky-50/30">
              <td className="pl-8 pr-3 py-2">
                <input type="text" value={editPayload.description ?? ''} onChange={e => setEditPayload(p => ({ ...p, description: e.target.value }))}
                  className="w-full px-1.5 py-1 text-xs rounded border border-gray-200 bg-white" />
              </td>
              <td className="px-3 py-2 text-xs text-[var(--text-muted)]">{fmtUom(li.uom)}</td>
              <td className="px-3 py-2">
                <input type="number" value={editPayload.quantity ?? 0} onChange={e => setEditPayload(p => ({ ...p, quantity: parseFloat(e.target.value) || 0 }))}
                  className="w-20 px-1.5 py-1 text-xs rounded border border-gray-200 bg-white text-right" />
              </td>
              <td className="px-3 py-2">
                <input type="number" value={editPayload.price_per_unit ?? 0} onChange={e => setEditPayload(p => ({ ...p, price_per_unit: parseFloat(e.target.value) || 0 }))}
                  className="w-20 px-1.5 py-1 text-xs rounded border border-gray-200 bg-white text-right" />
              </td>
              {!customerView && (
                <td className="px-3 py-2">
                  <input type="number" value={editPayload.cost_per_unit ?? 0} onChange={e => setEditPayload(p => ({ ...p, cost_per_unit: parseFloat(e.target.value) || 0 }))}
                    className="w-20 px-1.5 py-1 text-xs rounded border border-gray-200 bg-white text-right" />
                </td>
              )}
              <td colSpan={customerView ? 1 : 2} className="px-3 py-2">
                <div className="flex gap-1">
                  <input type="number" value={editPayload.min_price ?? 0} onChange={e => setEditPayload(p => ({ ...p, min_price: parseFloat(e.target.value) || 0 }))}
                    className="w-16 px-1 py-1 text-xs rounded border border-gray-200 bg-white text-right" placeholder="Min P" />
                  {!customerView && (
                    <input type="number" value={editPayload.min_cost ?? 0} onChange={e => setEditPayload(p => ({ ...p, min_cost: parseFloat(e.target.value) || 0 }))}
                      className="w-16 px-1 py-1 text-xs rounded border border-gray-200 bg-white text-right" placeholder="Min C" />
                  )}
                </div>
              </td>
              <td className="px-3 py-2 text-xs text-[var(--text-muted)] text-right">{'\u2014'}</td>
              {!customerView && <td className="px-3 py-2"></td>}
              {!customerView && (
                <td className="px-3 py-2 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={onSaveEdit} className="px-2 py-0.5 text-xs font-medium text-white bg-[var(--sky)] rounded hover:opacity-90">Save</button>
                    <button onClick={onCancelEdit} className="px-2 py-0.5 text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                  </div>
                </td>
              )}
            </tr>
          );
        }

        return (
          <tr key={li.id} className={`border-b border-[var(--border)] last:border-b-0 ${idx % 2 === 0 ? '' : 'bg-gray-50/40'}`}>
            <td className="pl-8 pr-3 py-2 text-xs text-[var(--text)]">
              {li.description}
              {li.is_manual_override && (
                <span className="text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium ml-1">Manual</span>
              )}
            </td>
            <td className="px-3 py-2 text-xs text-[var(--text-muted)]">{fmtUom(li.uom)}</td>
            <td className="px-3 py-2 text-xs text-[var(--text)] text-right">{fmtNum(li.quantity, 2)}</td>
            <td className="px-3 py-2 text-xs text-[var(--text)] text-right">{fmtNum(li.price_per_unit)} <span className="text-[var(--text-muted)]">{li.price_currency}</span></td>
            {!customerView && <td className="px-3 py-2 text-xs text-[var(--text)] text-right">{fmtNum(li.cost_per_unit)} <span className="text-[var(--text-muted)]">{li.cost_currency}</span></td>}
            <td className="px-3 py-2 text-xs text-[var(--text)] text-right font-medium">{fmtNum(li.effective_price)}</td>
            <td className="px-3 py-2 text-xs text-right">
              {li.tax_rate > 0
                ? <span className="text-[10px] text-[var(--text-muted)] bg-gray-100 px-1.5 py-0.5 rounded">{(li.tax_rate * 100).toFixed(0)}%</span>
                : '\u2014'}
            </td>
            {!customerView && <td className="px-3 py-2 text-xs text-[var(--text)] text-right">{fmtNum(li.effective_cost)}</td>}
            {!customerView && (
              <td className={`px-3 py-2 text-xs text-right font-medium ${marginClass(li.margin_percent)}`}>
                {li.margin_percent != null ? `${li.margin_percent}%` : '\u2014'}
              </td>
            )}
            {!customerView && (
              <td className="px-3 py-2 text-right">
                <div className="flex items-center justify-end gap-1">
                  <button onClick={() => onStartEdit(li)} className="p-1 text-gray-400 hover:text-[var(--sky)] transition-colors" title="Edit">
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button onClick={() => onDelete(li.id)} className="p-1 text-gray-400 hover:text-red-500 transition-colors" title="Delete">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </td>
            )}
          </tr>
        );
      })}
    </>
  );
}
