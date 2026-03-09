'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { LocalCharge } from '@/app/actions/pricing';

const TRADE_DIRECTIONS = ['IMPORT', 'EXPORT'] as const;
const SHIPMENT_TYPES = ['FCL', 'LCL', 'AIR', 'CB', 'ALL'] as const;
const CONTAINER_SIZES = ['20', '40', 'ALL'] as const;
const CONTAINER_TYPES = ['GP', 'HC', 'RF', 'FF', 'OT', 'FR', 'PL', 'ALL'] as const;
const UOMS = ['CONTAINER', 'CBM', 'KG', 'W/M', 'CW_KG', 'SET', 'BL'] as const;

interface LocalChargesModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: Omit<LocalCharge, 'id' | 'created_at' | 'updated_at'> & { close_previous?: boolean }) => Promise<void>;
  editRate?: LocalCharge | null;
  mode?: 'edit' | 'new-rate';
}

export function LocalChargesModal({ open, onClose, onSave, editRate, mode = 'edit' }: LocalChargesModalProps) {
  const [portCode, setPortCode] = useState('');
  const [tradeDirection, setTradeDirection] = useState<string>('IMPORT');
  const [shipmentType, setShipmentType] = useState<string>('ALL');
  const [containerSize, setContainerSize] = useState<string>('ALL');
  const [containerType, setContainerType] = useState<string>('ALL');
  const [chargeCode, setChargeCode] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [cost, setCost] = useState('');
  const [currency, setCurrency] = useState('MYR');
  const [uom, setUom] = useState<string>('SET');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [effectiveTo, setEffectiveTo] = useState('');
  const [isDomestic, setIsDomestic] = useState(false);
  const [paidWithFreight, setPaidWithFreight] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editRate) {
      setPortCode(editRate.port_code);
      setTradeDirection(editRate.trade_direction);
      setShipmentType(editRate.shipment_type);
      setContainerSize(editRate.container_size);
      setContainerType(editRate.container_type);
      setChargeCode(editRate.charge_code);
      setDescription(editRate.description);
      setPrice(String(editRate.price));
      setCost(String(editRate.cost));
      setCurrency(editRate.currency);
      setUom(editRate.uom);
      if (mode === 'new-rate') {
        const now = new Date();
        const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        setEffectiveFrom(next.toISOString().slice(0, 10));
        setEffectiveTo('');
      } else {
        setEffectiveFrom(editRate.effective_from);
        setEffectiveTo(editRate.effective_to ?? '');
      }
      setIsDomestic(editRate.is_domestic);
      setPaidWithFreight(editRate.paid_with_freight);
      setIsActive(editRate.is_active);
    } else {
      setPortCode('');
      setTradeDirection('IMPORT');
      setShipmentType('ALL');
      setContainerSize('ALL');
      setContainerType('ALL');
      setChargeCode('');
      setDescription('');
      setPrice('');
      setCost('');
      setCurrency('MYR');
      setUom('SET');
      setEffectiveFrom('');
      setEffectiveTo('');
      setIsDomestic(false);
      setPaidWithFreight(false);
      setIsActive(true);
    }
  }, [editRate, open, mode]);

  if (!open) return null;

  const dateRangeError = effectiveTo && effectiveFrom && effectiveTo < effectiveFrom
    ? 'Effective To cannot be before Effective From'
    : null;

  const handleSubmit = async () => {
    if (dateRangeError) return;
    setSaving(true);
    try {
      await onSave({
        port_code: portCode,
        trade_direction: tradeDirection as LocalCharge['trade_direction'],
        shipment_type: shipmentType as LocalCharge['shipment_type'],
        container_size: containerSize as LocalCharge['container_size'],
        container_type: containerType as LocalCharge['container_type'],
        charge_code: chargeCode,
        description,
        price: parseFloat(price),
        cost: parseFloat(cost),
        currency,
        uom,
        is_domestic: isDomestic,
        paid_with_freight: paidWithFreight,
        effective_from: effectiveFrom,
        effective_to: effectiveTo || null,
        is_active: isActive,
        ...(mode === 'new-rate' ? { close_previous: true } : {}),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full h-9 px-3 text-sm rounded-lg border border-[var(--border)] bg-white";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl border border-[var(--border)] shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <h2 className="text-base font-semibold text-[var(--text)]">
            {mode === 'new-rate' ? `New Rate — effective ${effectiveFrom}` : editRate ? 'Edit Local Charge' : 'Add Local Charge'}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--surface)] transition-colors">
            <X size={16} className="text-[var(--text-muted)]" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-xs font-medium text-[var(--text-muted)]">Port Code</span>
              <input value={portCode} onChange={e => setPortCode(e.target.value.toUpperCase())}
                className={inputCls} placeholder="MYPKG" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-[var(--text-muted)]">Trade Direction</span>
              <select value={tradeDirection} onChange={e => setTradeDirection(e.target.value)} className={inputCls}>
                {TRADE_DIRECTIONS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-xs font-medium text-[var(--text-muted)]">Shipment Type</span>
              <select value={shipmentType} onChange={e => setShipmentType(e.target.value)} className={inputCls}>
                {SHIPMENT_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-[var(--text-muted)]">UOM</span>
              <select value={uom} onChange={e => setUom(e.target.value)} className={inputCls}>
                {UOMS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-xs font-medium text-[var(--text-muted)]">Container Size</span>
              <select value={containerSize} onChange={e => setContainerSize(e.target.value)} className={inputCls}>
                {CONTAINER_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-[var(--text-muted)]">Container Type</span>
              <select value={containerType} onChange={e => setContainerType(e.target.value)} className={inputCls}>
                {CONTAINER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-xs font-medium text-[var(--text-muted)]">Charge Code</span>
              <input value={chargeCode} onChange={e => setChargeCode(e.target.value.toUpperCase())}
                className={inputCls} placeholder="THC" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-[var(--text-muted)]">Currency</span>
              <input value={currency} onChange={e => setCurrency(e.target.value.toUpperCase())}
                className={inputCls} placeholder="MYR" />
            </label>
          </div>
          <label className="space-y-1 block">
            <span className="text-xs font-medium text-[var(--text-muted)]">Description</span>
            <input value={description} onChange={e => setDescription(e.target.value)}
              className={inputCls} placeholder="Terminal handling charge" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-xs font-medium text-[var(--text-muted)]">Price</span>
              <input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)}
                className={inputCls} placeholder="0.00" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-[var(--text-muted)]">Cost</span>
              <input type="number" step="0.01" value={cost} onChange={e => setCost(e.target.value)}
                className={inputCls} placeholder="0.00" />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-xs font-medium text-[var(--text-muted)]">Effective From</span>
              <input type="date" value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)}
                className={inputCls} />
            </label>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[var(--text-muted)]">Effective To</span>
                {editRate && mode === 'edit' && effectiveTo && (
                  <button
                    type="button"
                    onClick={() => setEffectiveTo('')}
                    className="text-xs text-[var(--text-muted)] hover:text-red-500 underline cursor-pointer"
                  >
                    × Remove end date
                  </button>
                )}
              </div>
              <input
                type="date"
                value={effectiveTo}
                onChange={e => setEffectiveTo(e.target.value)}
                placeholder="Ongoing"
                className={`${inputCls} ${dateRangeError ? 'border-red-400' : ''}`}
              />
              {dateRangeError && (
                <p className="text-xs text-red-500">{dateRangeError}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={isDomestic} onChange={e => setIsDomestic(e.target.checked)} />
              <span className="text-sm text-[var(--text)]">Is Domestic</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={paidWithFreight} onChange={e => setPaidWithFreight(e.target.checked)} />
              <span className="text-sm text-[var(--text)]">Paid With Freight</span>
            </label>
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
            <span className="text-sm text-[var(--text)]">Active</span>
          </label>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t border-[var(--border)]">
          <button onClick={onClose}
            className="h-9 px-4 text-sm rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving || !portCode || !chargeCode || !price || !cost || !effectiveFrom || !!dateRangeError}
            className="h-9 px-4 text-sm rounded-lg bg-[var(--sky)] text-white font-medium hover:bg-[var(--sky)]/90 disabled:opacity-50 transition-colors">
            {saving ? 'Saving...' : mode === 'new-rate' ? 'Create New Rate' : editRate ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
