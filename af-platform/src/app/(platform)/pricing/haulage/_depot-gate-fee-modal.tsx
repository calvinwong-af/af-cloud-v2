'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  createDepotGateFeeAction,
  updateDepotGateFeeAction,
  fetchDepotGateFeesAction,
  deleteDepotGateFeeAction,
  type DepotGateFee,
} from '@/app/actions/pricing';
import { formatDate, formatCompact } from '../_helpers';

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
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30" onClick={onClose}>
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

/* ---------- DGF Manage Dialog ---------- */

interface DgfManageDialogProps {
  open: boolean;
  portUnCode: string;
  terminalId: string | null;
  onClose: () => void;
}

export function DgfManageDialog({ open, portUnCode, terminalId, onClose }: DgfManageDialogProps) {
  const [fees, setFees] = useState<DepotGateFee[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [feeModalOpen, setFeeModalOpen] = useState(false);
  const [editFee, setEditFee] = useState<DepotGateFee | null>(null);

  const loadFees = useCallback(() => {
    setLoading(true);
    fetchDepotGateFeesAction(portUnCode, terminalId ?? undefined, true)
      .then(r => { if (r?.success) setFees(r.data); })
      .finally(() => setLoading(false));
  }, [portUnCode, terminalId]);

  useEffect(() => {
    if (open) loadFees();
  }, [open, loadFees]);

  const handleDelete = async (feeId: number) => {
    setSaving(true);
    try {
      await deleteDepotGateFeeAction(feeId);
      setConfirmDeleteId(null);
      setFees(prev => prev.filter(f => f.id !== feeId));
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const btnClass = "text-[10px] px-1.5 py-0.5 rounded border border-[var(--border)] hover:bg-[var(--surface)] transition-colors";
  const dangerBtnClass = "text-[10px] px-1.5 py-0.5 rounded border border-red-200 text-red-600 hover:bg-red-50 transition-colors";

  return (
    <>
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30" onClick={onClose}>
        <div
          className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text)]">Depot Gate Fees</h3>
              <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                {portUnCode}{terminalId ? ` \u2014 ${terminalId}` : ' (port-level)'}
              </p>
            </div>
            <button
              onClick={() => { setEditFee(null); setFeeModalOpen(true); }}
              className="h-7 px-3 text-xs rounded bg-[var(--sky)] text-white hover:bg-[var(--sky)]/90 transition-colors"
            >
              + Add Rate
            </button>
          </div>

          {/* Body — fee list */}
          <div className="px-5 py-3 min-h-[80px] max-h-[320px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center gap-2 py-4 text-xs text-[var(--text-muted)]">
                <div className="w-3 h-3 border border-[var(--text-muted)] border-t-transparent rounded-full animate-spin" />
                Loading...
              </div>
            ) : fees.length === 0 ? (
              <div className="py-4 text-xs text-[var(--text-muted)]">No depot gate fees set for this port.</div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide border-b border-[var(--border)]">
                    <th className="text-left py-1.5 font-medium">Effective From</th>
                    <th className="text-left py-1.5 font-medium">Effective To</th>
                    <th className="text-right py-1.5 font-medium">Fee</th>
                    <th className="text-left py-1.5 pl-2 font-medium">Status</th>
                    <th className="text-right py-1.5 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {fees.map(fee => {
                    const isDraft = fee.rate_status === 'DRAFT';
                    return (
                      <tr key={fee.id} className="border-b border-[var(--border)]/50 last:border-0">
                        <td className="py-2 text-[var(--text)]">{formatDate(fee.effective_from)}</td>
                        <td className="py-2 text-[var(--text)]">{fee.effective_to ? formatDate(fee.effective_to) : <span className="text-[var(--text-muted)]">Open</span>}</td>
                        <td className="py-2 text-right font-medium text-[var(--text)]">
                          {formatCompact(fee.fee_amount)}
                          <span className="text-[10px] font-normal text-[var(--text-muted)] ml-1">{fee.currency}</span>
                        </td>
                        <td className="py-2 pl-2">
                          {isDraft ? (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200 font-medium">Draft</span>
                          ) : (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full border bg-green-50 text-green-700 border-green-200 font-medium">Published</span>
                          )}
                        </td>
                        <td className="py-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => { setEditFee(fee); setFeeModalOpen(true); }} className={btnClass}>Edit</button>
                            {confirmDeleteId === fee.id ? (
                              <span className="text-[10px] text-red-600 flex items-center gap-1">
                                Sure?{' '}
                                <button onClick={() => handleDelete(fee.id)} className={dangerBtnClass} disabled={saving}>Yes</button>
                                <button onClick={() => setConfirmDeleteId(null)} className={btnClass}>No</button>
                              </span>
                            ) : (
                              <button onClick={() => setConfirmDeleteId(fee.id)} className={dangerBtnClass}>Delete</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-[var(--border)] flex justify-end">
            <button
              onClick={onClose}
              className="h-8 px-4 text-xs rounded border border-[var(--border)] hover:bg-[var(--surface)] transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Edit/Create modal — z-[70] to layer above this dialog */}
      {feeModalOpen && (
        <DepotGateFeeModal
          open={feeModalOpen}
          portUnCode={portUnCode}
          terminalId={terminalId}
          initial={editFee}
          onSaved={() => {
            setFeeModalOpen(false);
            setEditFee(null);
            loadFees();
          }}
          onClose={() => {
            setFeeModalOpen(false);
            setEditFee(null);
          }}
        />
      )}
    </>
  );
}
