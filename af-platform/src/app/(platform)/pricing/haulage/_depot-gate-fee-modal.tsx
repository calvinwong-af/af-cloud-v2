'use client';

import { useState, useEffect } from 'react';
import {
  createDepotGateFeeAction,
  updateDepotGateFeeAction,
  type DepotGateFee,
} from '@/app/actions/pricing';

interface DepotGateFeeModalProps {
  open: boolean;
  portUnCode: string;
  terminalId: string | null;
  initial: DepotGateFee | null;
  onSaved: () => void;
  onClose: () => void;
}

const inputClass = "h-8 px-2 text-xs rounded border border-[var(--border)] bg-white text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--sky)] focus:border-[var(--sky)] w-full";

export function DepotGateFeeModal({ open, portUnCode, terminalId, initial, onSaved, onClose }: DepotGateFeeModalProps) {
  const [saving, setSaving] = useState(false);
  const [effFrom, setEffFrom] = useState('');
  const [effTo, setEffTo] = useState('');
  const [currency, setCurrency] = useState('MYR');
  const [feeAmount, setFeeAmount] = useState('');
  const [status, setStatus] = useState('PUBLISHED');

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setEffFrom(initial.effective_from ?? '');
      setEffTo(initial.effective_to ?? '');
      setCurrency(initial.currency ?? 'MYR');
      setFeeAmount(initial.fee_amount != null ? String(initial.fee_amount) : '');
      setStatus(initial.rate_status ?? 'PUBLISHED');
    } else {
      setEffFrom('');
      setEffTo('');
      setCurrency('MYR');
      setFeeAmount('');
      setStatus('PUBLISHED');
    }
  }, [open, initial]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = {
        port_un_code: portUnCode,
        terminal_id: terminalId ?? null,
        effective_from: effFrom,
        effective_to: effTo || null,
        rate_status: status,
        currency,
        fee_amount: parseFloat(feeAmount),
      };
      if (initial) {
        await updateDepotGateFeeAction(initial.id, data);
      } else {
        await createDepotGateFeeAction(data);
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const isEdit = initial !== null;
  const canSave = effFrom && feeAmount && !isNaN(parseFloat(feeAmount));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <h3 className="text-sm font-semibold text-[var(--text)]">
            {isEdit ? 'Edit Depot Gate Fee' : 'Set Depot Gate Fee'}
          </h3>
          <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
            {portUnCode}{terminalId ? ` \u2014 ${terminalId}` : ' (port-level)'}
          </p>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          {/* Date row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-medium text-[var(--text-muted)] mb-1">Effective From</label>
              <input type="date" value={effFrom} onChange={e => setEffFrom(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-[var(--text-muted)] mb-1">Effective To</label>
              <input type="date" value={effTo} onChange={e => setEffTo(e.target.value)} className={inputClass} />
            </div>
          </div>

          {/* Currency + Status row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-medium text-[var(--text-muted)] mb-1">Currency</label>
              <select value={currency} onChange={e => setCurrency(e.target.value)} className={inputClass}>
                <option value="MYR">MYR</option>
                <option value="USD">USD</option>
                <option value="SGD">SGD</option>
                <option value="THB">THB</option>
                <option value="IDR">IDR</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-[var(--text-muted)] mb-1">Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)} className={inputClass}>
                <option value="PUBLISHED">Published</option>
                <option value="DRAFT">Draft</option>
              </select>
            </div>
          </div>

          {/* Fee Amount */}
          <div>
            <label className="block text-[10px] font-medium text-[var(--text-muted)] mb-1">Fee Amount (cost &amp; price)</label>
            <input
              type="number"
              step="0.01"
              value={feeAmount}
              onChange={e => setFeeAmount(e.target.value)}
              className={inputClass}
              placeholder="0.00"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[var(--border)] flex justify-end gap-2">
          <button
            onClick={onClose}
            className="h-8 px-4 text-xs rounded border border-[var(--border)] hover:bg-[var(--surface)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !canSave}
            className="h-8 px-4 text-xs rounded bg-[var(--sky)] text-white hover:bg-[var(--sky)]/90 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
