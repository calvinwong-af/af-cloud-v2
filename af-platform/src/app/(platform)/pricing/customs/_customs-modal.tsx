'use client';

import { useState, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';
import { PortCombobox } from '@/components/shared/PortCombobox';

const TRADE_DIRECTIONS = ['IMPORT', 'EXPORT'] as const;
const SHIPMENT_TYPES = ['FCL', 'LCL', 'AIR', 'CB', 'ALL'] as const;
const UOMS = ['CONTAINER', 'CBM', 'KG', 'W/M', 'CW_KG', 'SET', 'BL'] as const;

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

export interface CustomsModalSeed {
  card_id: number;
  card_key: string;
  port_code: string;
  trade_direction: string;
  shipment_type: string;
  charge_code: string;
  description: string;
  currency: string;
  uom: string;
  is_domestic: boolean;
  is_international: boolean;
  is_active: boolean;
  rate_id: number | null;
  price: number | null;
  cost: number | null;
  effective_from: string | null;
  effective_to: string | null;
}

interface CustomsRateCreatePayload {
  port_code: string; trade_direction: string; shipment_type: string;
  charge_code: string; description: string; currency: string; uom: string;
  is_domestic: boolean; is_international: boolean;
  price: number; cost: number; effective_from: string; effective_to: string | null;
  close_previous: boolean;
}
interface CustomsRateUpdatePayload {
  price?: number; cost?: number; effective_from?: string; effective_to?: string | null;
}
interface CustomsCardUpdatePayload {
  description?: string; currency?: string; uom?: string;
  is_domestic?: boolean; is_international?: boolean; is_active?: boolean;
}

export type CustomsModalPayload =
  | { mode: 'new'; data: CustomsRateCreatePayload }
  | { mode: 'edit-rate'; rateId: number; data: CustomsRateUpdatePayload }
  | { mode: 'edit-card'; cardId: number; data: CustomsCardUpdatePayload };

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CustomsModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (payload: CustomsModalPayload) => Promise<void>;
  onDelete?: () => Promise<void>;
  mode: 'new' | 'edit-rate' | 'edit-card';
  seed?: CustomsModalSeed;
  portOptions?: { value: string; label: string; sublabel?: string }[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CustomsModal({ open, onClose, onSave, onDelete, mode, seed, portOptions = [] }: CustomsModalProps) {
  // Card fields
  const [portCode, setPortCode] = useState('');
  const [tradeDirection, setTradeDirection] = useState<string>('IMPORT');
  const [shipmentType, setShipmentType] = useState<string>('FCL');
  const [chargeCode, setChargeCode] = useState('');
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState('MYR');
  const [uom, setUom] = useState<string>('SET');
  const [isDomestic, setIsDomestic] = useState(false);
  const [isInternational, setIsInternational] = useState(true);
  const [isActive, setIsActive] = useState(true);

  // Rate fields
  const [price, setPrice] = useState('');
  const [cost, setCost] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [effectiveTo, setEffectiveTo] = useState('');

  // UI state
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) { setSaveError(null); setConfirmDelete(false); return; }
    if (seed) {
      setPortCode(seed.port_code);
      setTradeDirection(seed.trade_direction);
      setShipmentType(seed.shipment_type);
      setChargeCode(seed.charge_code);
      setDescription(seed.description);
      setCurrency(seed.currency);
      setUom(seed.uom);
      setIsDomestic(seed.is_domestic);
      setIsInternational(seed.is_international);
      setIsActive(seed.is_active);
      if (mode === 'new') {
        setPrice('');
        setCost('');
        setEffectiveFrom(seed.effective_from ?? '');
        setEffectiveTo('');
      } else if (mode === 'edit-rate') {
        setPrice(seed.price != null ? String(seed.price) : '');
        setCost(seed.cost != null ? String(seed.cost) : '');
        setEffectiveFrom(seed.effective_from ?? '');
        setEffectiveTo(seed.effective_to ?? '');
      }
    } else {
      setPortCode('');
      setTradeDirection('IMPORT');
      setShipmentType('FCL');
      setChargeCode('');
      setDescription('');
      setCurrency('MYR');
      setUom('SET');
      setIsDomestic(false);
      setIsInternational(true);
      setIsActive(true);
      setPrice('');
      setCost('');
      setEffectiveFrom('');
      setEffectiveTo('');
    }
  }, [open, seed, mode]);

  if (!open) return null;

  const dateRangeError = effectiveTo && effectiveFrom && effectiveTo < effectiveFrom
    ? 'Effective To cannot be before Effective From'
    : null;

  const title = mode === 'new'
    ? 'Add Customs Rate'
    : mode === 'edit-rate'
    ? `Edit Rate \u2014 ${effectiveFrom || '...'}`
    : 'Edit Charge Details';

  const canSave = mode === 'new'
    ? !!(portCode && chargeCode && price && cost && effectiveFrom && !dateRangeError)
    : mode === 'edit-rate'
    ? !dateRangeError
    : true;

  const handleSubmit = async () => {
    if (!canSave) return;
    setSaving(true);
    setSaveError(null);
    try {
      if (mode === 'new') {
        await onSave({
          mode: 'new',
          data: {
            port_code: portCode,
            trade_direction: tradeDirection,
            shipment_type: shipmentType,
            charge_code: chargeCode,
            description,
            currency,
            uom,
            is_domestic: isDomestic,
            is_international: isInternational,
            price: parseFloat(price),
            cost: parseFloat(cost),
            effective_from: effectiveFrom,
            effective_to: effectiveTo || null,
            close_previous: true,
          },
        });
      } else if (mode === 'edit-rate' && seed?.rate_id != null) {
        await onSave({
          mode: 'edit-rate',
          rateId: seed.rate_id,
          data: {
            price: parseFloat(price),
            cost: parseFloat(cost),
            effective_from: effectiveFrom,
            effective_to: effectiveTo || null,
          },
        });
      } else if (mode === 'edit-card' && seed) {
        await onSave({
          mode: 'edit-card',
          cardId: seed.card_id,
          data: {
            description,
            currency,
            uom,
            is_domestic: isDomestic,
            is_international: isInternational,
            is_active: isActive,
          },
        });
      }
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setDeleting(true);
    setSaveError(null);
    try {
      await onDelete();
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Delete failed');
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl border border-[var(--border)] shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <h2 className="text-base font-semibold text-[var(--text)]">{title}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--surface)] transition-colors">
            <X size={16} className="text-[var(--text-muted)]" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          {/* ---- edit-rate: read-only card identity header ---- */}
          {mode === 'edit-rate' && seed && (
            <div className="p-3 rounded-lg bg-[var(--surface)] border border-[var(--border)] space-y-1 mb-1">
              <div className="text-sm">
                <span className="font-semibold text-[var(--text)]">{seed.charge_code}</span>
                <span className="text-[var(--text-muted)]"> &mdash; {seed.description}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${seed.trade_direction === 'IMPORT' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'}`}>
                  {seed.trade_direction === 'IMPORT' ? 'IMP' : 'EXP'}
                </span>
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{seed.shipment_type}</span>
                <span className="text-xs text-[var(--text-muted)]">{seed.port_code}</span>
              </div>
            </div>
          )}

          {/* ---- new mode: all fields ---- */}
          {mode === 'new' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <span className="text-xs font-medium text-[var(--text-muted)]">Port Code</span>
                  <PortCombobox value={portCode} onChange={setPortCode} options={portOptions}
                    placeholder="Search port\u2026" className="w-full h-9 px-3 text-sm rounded-lg border border-[var(--border)] bg-white" />
                </div>
                <label className="space-y-1">
                  <span className="text-xs font-medium text-[var(--text-muted)]">Trade Direction</span>
                  <select value={tradeDirection} onChange={e => setTradeDirection(e.target.value)}
                    className="w-full h-9 px-3 text-sm rounded-lg border border-[var(--border)] bg-white">
                    {TRADE_DIRECTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="text-xs font-medium text-[var(--text-muted)]">Shipment Type</span>
                  <select value={shipmentType} onChange={e => setShipmentType(e.target.value)}
                    className="w-full h-9 px-3 text-sm rounded-lg border border-[var(--border)] bg-white">
                    {SHIPMENT_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-medium text-[var(--text-muted)]">UOM</span>
                  <select value={uom} onChange={e => setUom(e.target.value)}
                    className="w-full h-9 px-3 text-sm rounded-lg border border-[var(--border)] bg-white">
                    {UOMS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="text-xs font-medium text-[var(--text-muted)]">Charge Code</span>
                  <input value={chargeCode} onChange={e => setChargeCode(e.target.value.toUpperCase())}
                    className="w-full h-9 px-3 text-sm rounded-lg border border-[var(--border)] bg-white" placeholder="CC_BASIC" />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-medium text-[var(--text-muted)]">Currency</span>
                  <input value={currency} onChange={e => setCurrency(e.target.value.toUpperCase())}
                    className="w-full h-9 px-3 text-sm rounded-lg border border-[var(--border)] bg-white" placeholder="MYR" />
                </label>
              </div>
              <label className="space-y-1 block">
                <span className="text-xs font-medium text-[var(--text-muted)]">Description</span>
                <input value={description} onChange={e => setDescription(e.target.value)}
                  className="w-full h-9 px-3 text-sm rounded-lg border border-[var(--border)] bg-white" placeholder="Basic customs clearance" />
              </label>
            </>
          )}

          {/* ---- new + edit-rate: rate fields ---- */}
          {(mode === 'new' || mode === 'edit-rate') && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="text-xs font-medium text-[var(--text-muted)]">Price</span>
                  <input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)}
                    className="w-full h-9 px-3 text-sm rounded-lg border border-[var(--border)] bg-white" placeholder="0.00" />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-medium text-[var(--text-muted)]">Cost</span>
                  <input type="number" step="0.01" value={cost} onChange={e => setCost(e.target.value)}
                    className="w-full h-9 px-3 text-sm rounded-lg border border-[var(--border)] bg-white" placeholder="0.00" />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="text-xs font-medium text-[var(--text-muted)]">Effective From</span>
                  <input type="date" value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)}
                    className="w-full h-9 px-3 text-sm rounded-lg border border-[var(--border)] bg-white" />
                </label>
                <label className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[var(--text-muted)]">Effective To</span>
                    {mode === 'edit-rate' && effectiveTo && (
                      <button type="button" onClick={() => setEffectiveTo('')}
                        className="text-xs text-[var(--text-muted)] hover:text-red-500 underline cursor-pointer">
                        &times; Remove end date
                      </button>
                    )}
                  </div>
                  <input type="date" value={effectiveTo} onChange={e => setEffectiveTo(e.target.value)}
                    className={`w-full h-9 px-3 text-sm rounded-lg border bg-white ${dateRangeError ? 'border-red-400' : 'border-[var(--border)]'}`} />
                  {dateRangeError && <p className="text-xs text-red-500">{dateRangeError}</p>}
                </label>
              </div>
            </>
          )}

          {/* ---- new mode: domestic/international checkboxes ---- */}
          {mode === 'new' && (
            <>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={isDomestic} onChange={e => setIsDomestic(e.target.checked)} />
                <span className="text-sm text-[var(--text)]">Is Domestic</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={isInternational} onChange={e => setIsInternational(e.target.checked)} />
                <span className="text-sm text-[var(--text)]">Is International</span>
              </label>
            </>
          )}

          {/* ---- edit-card mode: card fields only ---- */}
          {mode === 'edit-card' && (
            <>
              <label className="space-y-1 block">
                <span className="text-xs font-medium text-[var(--text-muted)]">Description</span>
                <input value={description} onChange={e => setDescription(e.target.value)}
                  className="w-full h-9 px-3 text-sm rounded-lg border border-[var(--border)] bg-white" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="text-xs font-medium text-[var(--text-muted)]">Currency</span>
                  <input value={currency} onChange={e => setCurrency(e.target.value.toUpperCase())}
                    className="w-full h-9 px-3 text-sm rounded-lg border border-[var(--border)] bg-white" />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-medium text-[var(--text-muted)]">UOM</span>
                  <select value={uom} onChange={e => setUom(e.target.value)}
                    className="w-full h-9 px-3 text-sm rounded-lg border border-[var(--border)] bg-white">
                    {UOMS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </label>
              </div>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={isDomestic} onChange={e => setIsDomestic(e.target.checked)} />
                <span className="text-sm text-[var(--text)]">Is Domestic</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={isInternational} onChange={e => setIsInternational(e.target.checked)} />
                <span className="text-sm text-[var(--text)]">Is International</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
                <span className="text-sm text-[var(--text)]">Active</span>
              </label>
            </>
          )}
        </div>

        {/* Error display */}
        {saveError && (
          <div className="mx-4 mb-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
            {saveError}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 p-4 border-t border-[var(--border)]">
          <div>
            {onDelete && mode === 'edit-rate' && (
              confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-600 font-medium">Delete this rate?</span>
                  <button onClick={handleDelete} disabled={deleting}
                    className="h-7 px-2.5 text-xs rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50 transition-colors">
                    {deleting ? 'Deleting...' : 'Confirm'}
                  </button>
                  <button onClick={() => setConfirmDelete(false)} disabled={deleting}
                    className="h-7 px-2.5 text-xs rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
                    Cancel
                  </button>
                </div>
              ) : (
                <button onClick={() => setConfirmDelete(true)} disabled={saving}
                  className="h-9 px-3 text-sm rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors flex items-center gap-1.5">
                  <Trash2 size={13} /> Delete
                </button>
              )
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="h-9 px-4 text-sm rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
              Cancel
            </button>
            <button onClick={handleSubmit} disabled={saving || deleting || !canSave}
              className="h-9 px-4 text-sm rounded-lg bg-[var(--sky)] text-white font-medium hover:bg-[var(--sky)]/90 disabled:opacity-50 transition-colors">
              {saving ? 'Saving...' : mode === 'new' ? 'Create' : 'Update'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
