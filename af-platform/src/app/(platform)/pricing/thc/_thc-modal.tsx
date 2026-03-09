'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { THCRate } from '@/app/actions/pricing';

const TRADE_DIRECTIONS = ['IMPORT', 'EXPORT'] as const;
const SHIPMENT_TYPES = ['FCL', 'LCL', 'AIR', 'CB'] as const;
const UOMS = ['CONTAINER', 'CBM', 'KG', 'W/M', 'CW_KG', 'SET', 'BL'] as const;

interface THCModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: Omit<THCRate, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  editRate?: THCRate | null;
}

export function THCModal({ open, onClose, onSave, editRate }: THCModalProps) {
  const [portCode, setPortCode] = useState('');
  const [tradeDirection, setTradeDirection] = useState<string>('IMPORT');
  const [shipmentType, setShipmentType] = useState<string>('FCL');
  const [equipmentType, setEquipmentType] = useState('');
  const [chargeCode, setChargeCode] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('MYR');
  const [uom, setUom] = useState<string>('CONTAINER');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [effectiveTo, setEffectiveTo] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editRate) {
      setPortCode(editRate.port_code);
      setTradeDirection(editRate.trade_direction);
      setShipmentType(editRate.shipment_type);
      setEquipmentType(editRate.equipment_type ?? '');
      setChargeCode(editRate.charge_code);
      setDescription(editRate.description);
      setAmount(String(editRate.amount));
      setCurrency(editRate.currency);
      setUom(editRate.uom);
      setEffectiveFrom(editRate.effective_from);
      setEffectiveTo(editRate.effective_to ?? '');
      setIsActive(editRate.is_active);
    } else {
      setPortCode('');
      setTradeDirection('IMPORT');
      setShipmentType('FCL');
      setEquipmentType('');
      setChargeCode('');
      setDescription('');
      setAmount('');
      setCurrency('MYR');
      setUom('CONTAINER');
      setEffectiveFrom('');
      setEffectiveTo('');
      setIsActive(true);
    }
  }, [editRate, open]);

  if (!open) return null;

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await onSave({
        port_code: portCode,
        trade_direction: tradeDirection as THCRate['trade_direction'],
        shipment_type: shipmentType as THCRate['shipment_type'],
        equipment_type: shipmentType === 'FCL' && equipmentType ? equipmentType : null,
        charge_code: chargeCode,
        description,
        amount: parseFloat(amount),
        currency,
        uom,
        effective_from: effectiveFrom,
        effective_to: effectiveTo || null,
        is_active: isActive,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl border border-[var(--border)] shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <h2 className="text-base font-semibold text-[var(--text)]">
            {editRate ? 'Edit THC Rate' : 'Add THC Rate'}
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
                className="w-full h-9 px-3 text-sm rounded-lg border border-[var(--border)] bg-white" placeholder="MYPKG" />
            </label>
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
            {shipmentType === 'FCL' && (
              <label className="space-y-1">
                <span className="text-xs font-medium text-[var(--text-muted)]">Equipment Type</span>
                <input value={equipmentType} onChange={e => setEquipmentType(e.target.value.toUpperCase())}
                  className="w-full h-9 px-3 text-sm rounded-lg border border-[var(--border)] bg-white" placeholder="20GP" />
              </label>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-xs font-medium text-[var(--text-muted)]">Charge Code</span>
              <input value={chargeCode} onChange={e => setChargeCode(e.target.value.toUpperCase())}
                className="w-full h-9 px-3 text-sm rounded-lg border border-[var(--border)] bg-white" placeholder="THC" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-[var(--text-muted)]">UOM</span>
              <select value={uom} onChange={e => setUom(e.target.value)}
                className="w-full h-9 px-3 text-sm rounded-lg border border-[var(--border)] bg-white">
                {UOMS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </label>
          </div>
          <label className="space-y-1 block">
            <span className="text-xs font-medium text-[var(--text-muted)]">Description</span>
            <input value={description} onChange={e => setDescription(e.target.value)}
              className="w-full h-9 px-3 text-sm rounded-lg border border-[var(--border)] bg-white" placeholder="Terminal handling charge" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-xs font-medium text-[var(--text-muted)]">Amount</span>
              <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
                className="w-full h-9 px-3 text-sm rounded-lg border border-[var(--border)] bg-white" placeholder="0.00" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-[var(--text-muted)]">Currency</span>
              <input value={currency} onChange={e => setCurrency(e.target.value.toUpperCase())}
                className="w-full h-9 px-3 text-sm rounded-lg border border-[var(--border)] bg-white" placeholder="MYR" />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-xs font-medium text-[var(--text-muted)]">Effective From</span>
              <input type="date" value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)}
                className="w-full h-9 px-3 text-sm rounded-lg border border-[var(--border)] bg-white" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-[var(--text-muted)]">Effective To</span>
              <input type="date" value={effectiveTo} onChange={e => setEffectiveTo(e.target.value)}
                className="w-full h-9 px-3 text-sm rounded-lg border border-[var(--border)] bg-white" />
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
          <button onClick={handleSubmit} disabled={saving || !portCode || !chargeCode || !amount || !effectiveFrom}
            className="h-9 px-4 text-sm rounded-lg bg-[var(--sky)] text-white font-medium hover:bg-[var(--sky)]/90 disabled:opacity-50 transition-colors">
            {saving ? 'Saving...' : editRate ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
