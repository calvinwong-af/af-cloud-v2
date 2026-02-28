'use client';

import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { updateShipmentFromBLAction } from '@/app/actions/shipments-write';

interface PartyValues {
  name: string | null;
  address: string | null;
}

interface Props {
  party: 'shipper' | 'consignee';
  blValues: PartyValues | null;
  orderValues: PartyValues | null;
  shipmentId: string;
  onClose: () => void;
  onUpdated: () => void;
}

export default function BLPartyDiffModal({
  party,
  blValues,
  orderValues,
  shipmentId,
  onClose,
  onUpdated,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const label = party === 'shipper' ? 'Shipper' : 'Consignee';
  const nameDiff = (blValues?.name ?? '') !== (orderValues?.name ?? '');
  const addressDiff = (blValues?.address ?? '') !== (orderValues?.address ?? '');

  async function handleUseBL() {
    setSaving(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('force_update', 'true');
      if (party === 'shipper') {
        if (blValues?.name) formData.append('shipper_name', blValues.name);
        if (blValues?.address) formData.append('shipper_address', blValues.address);
      } else {
        if (blValues?.name) formData.append('consignee_name', blValues.name);
        if (blValues?.address) formData.append('consignee_address', blValues.address);
      }

      const result = await updateShipmentFromBLAction(shipmentId, formData);
      if (!result?.success) {
        setError(result?.error ?? 'Failed to update');
        setSaving(false);
        return;
      }
      onUpdated();
    } catch {
      setError('Failed to update');
      setSaving(false);
    }
  }

  const diffBg = 'bg-amber-50';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <h3 className="text-sm font-semibold text-[var(--text)]">Party Diff — {label}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--surface)] text-[var(--text-muted)]">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Diff table */}
        <div className="p-4">
          <div className="grid grid-cols-2 gap-px bg-[var(--border)] rounded-lg overflow-hidden">
            {/* Column headers */}
            <div className="bg-[var(--surface)] px-3 py-2">
              <span className="text-xs font-semibold text-[var(--text-muted)] uppercase">BL Document</span>
            </div>
            <div className="bg-[var(--surface)] px-3 py-2">
              <span className="text-xs font-semibold text-[var(--text-muted)] uppercase">Shipment Order</span>
            </div>

            {/* Name row */}
            <div className={`px-3 py-2.5 ${nameDiff ? diffBg : 'bg-white'}`}>
              <div className="text-[10px] text-[var(--text-muted)] mb-0.5">Name</div>
              <div className="text-xs text-[var(--text)]">{blValues?.name || '—'}</div>
            </div>
            <div className={`px-3 py-2.5 ${nameDiff ? diffBg : 'bg-white'}`}>
              <div className="text-[10px] text-[var(--text-muted)] mb-0.5">Name</div>
              <div className="text-xs text-[var(--text)]">{orderValues?.name || '—'}</div>
            </div>

            {/* Address row */}
            <div className={`px-3 py-2.5 ${addressDiff ? diffBg : 'bg-white'}`}>
              <div className="text-[10px] text-[var(--text-muted)] mb-0.5">Address</div>
              <div className="text-xs text-[var(--text)] whitespace-pre-wrap">{blValues?.address || '—'}</div>
            </div>
            <div className={`px-3 py-2.5 ${addressDiff ? diffBg : 'bg-white'}`}>
              <div className="text-[10px] text-[var(--text-muted)] mb-0.5">Address</div>
              <div className="text-xs text-[var(--text)] whitespace-pre-wrap">{orderValues?.address || '—'}</div>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="px-4 pb-2">
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-[var(--border)]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
          >
            Keep Current
          </button>
          <button
            onClick={handleUseBL}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-[var(--sky)] rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Use BL Values
          </button>
        </div>
      </div>
    </div>
  );
}
