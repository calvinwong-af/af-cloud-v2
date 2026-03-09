'use client';

import { useState, useEffect } from 'react';
import type { RateDetail } from '@/app/actions/pricing';
import {
  createFCLRateAction, createLCLRateAction,
  updateFCLRateAction, updateLCLRateAction,
} from '@/app/actions/pricing';

interface RateModalProps {
  open: boolean;
  mode: 'add-list-price' | 'add-supplier' | 'edit' | 'update';
  rateId?: number;
  initial?: RateDetail;
  cardMode: 'fcl' | 'lcl';
  cardId: number;
  companiesList: { company_id: string; name: string }[];
  onSaved: () => void;
  onClose: () => void;
}

const inputClass = "h-8 px-2 text-xs rounded border border-[var(--border)] bg-white text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--sky)] focus:border-[var(--sky)] w-full";

export function RateModal({ open, mode, rateId, initial, cardMode, cardId, companiesList, onSaved, onClose }: RateModalProps) {
  const [saving, setSaving] = useState(false);
  const [supplier, setSupplier] = useState('');
  const [effFrom, setEffFrom] = useState('');
  const [effTo, setEffTo] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [listPrice, setListPrice] = useState('');
  const [cost, setCost] = useState('');
  const [minQuantity, setMinQuantity] = useState('');
  const [status, setStatus] = useState('PUBLISHED');
  const [surcharges, setSurcharges] = useState<{ code: string; description: string; amount: string }[]>([]);

  useEffect(() => {
    if (!open) return;
    if ((mode === 'edit' || mode === 'update') && initial) {
      setSupplier(initial.supplier_id ?? '');
      if (mode === 'update') {
        const now = new Date();
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const yyyy = nextMonth.getFullYear();
        const mm = String(nextMonth.getMonth() + 1).padStart(2, '0');
        setEffFrom(`${yyyy}-${mm}-01`);
        setEffTo('');
      } else {
        setEffFrom(initial.effective_from ?? '');
        setEffTo(initial.effective_to ?? '');
      }
      setCurrency(initial.currency);
      setListPrice(initial.list_price != null ? String(initial.list_price) : '');
      setCost(initial.cost != null ? String(initial.cost) : '');
      setMinQuantity(initial.min_quantity != null ? String(initial.min_quantity) : '');
      setStatus('PUBLISHED');
      setSurcharges(
        (initial.surcharges ?? []).map(s => ({
          code: s.code,
          description: s.description,
          amount: String(s.amount),
        }))
      );
    } else {
      setSupplier('');
      setEffFrom('');
      setEffTo('');
      setCurrency('USD');
      setListPrice('');
      setCost('');
      setMinQuantity('');
      setStatus('PUBLISHED');
      setSurcharges([]);
    }
  }, [open, mode, initial]);

  if (!open) return null;

  const dateRangeError = effTo && effFrom && effTo < effFrom
    ? 'Effective To cannot be before Effective From'
    : null;

  const isListPriceMode = mode === 'add-list-price'
    || (mode === 'edit' && initial?.supplier_id === null)
    || (mode === 'update' && initial?.supplier_id === null);

  const serializeSurcharges = () => {
    const valid = surcharges
      .filter(s => s.code.trim() && s.amount.trim())
      .map(s => ({ code: s.code.trim().toUpperCase(), description: s.description.trim(), amount: parseFloat(s.amount) }));
    return valid.length > 0 ? valid : null;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (mode === 'add-list-price' || mode === 'add-supplier' || mode === 'update') {
        const isSupplierRow = mode === 'add-supplier'
          || ((mode === 'update') && initial?.supplier_id != null);
        const data = {
          supplier_id: mode === 'add-list-price' ? null
            : mode === 'update' ? (initial?.supplier_id ?? null)
            : (supplier || null),
          effective_from: effFrom,
          effective_to: effTo || null,
          currency,
          uom: cardMode === 'fcl' ? 'CONTAINER' : 'W/M',
          list_price: listPrice ? parseFloat(listPrice) : null,
          cost: cost ? parseFloat(cost) : null,
          min_quantity: (cardMode === 'lcl' && isSupplierRow && minQuantity) ? parseFloat(minQuantity) : null,
          surcharges: serializeSurcharges(),
          rate_status: status,
        };
        const action = cardMode === 'fcl' ? createFCLRateAction : createLCLRateAction;
        await action(cardId, data);
      } else if (mode === 'edit' && rateId != null) {
        const isSupplierEdit = initial?.supplier_id != null;
        const data: Record<string, unknown> = {
          effective_from: effFrom || undefined,
          effective_to: effTo || null,
          currency,
          list_price: listPrice ? parseFloat(listPrice) : null,
          cost: cost ? parseFloat(cost) : null,
          min_quantity: (cardMode === 'lcl' && isSupplierEdit && minQuantity) ? parseFloat(minQuantity) : null,
          surcharges: serializeSurcharges(),
          rate_status: status,
        };
        const action = cardMode === 'fcl' ? updateFCLRateAction : updateLCLRateAction;
        await action(rateId, data);
      }
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const title = mode === 'add-list-price'
    ? 'New List Price Rate'
    : mode === 'add-supplier'
      ? 'New Supplier Rate'
      : mode === 'update'
        ? 'Update Rate'
        : `Edit Rate #${rateId}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h3 className="text-sm font-semibold text-[var(--text)]">{title}</h3>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text)] text-lg leading-none">&times;</button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 overflow-y-auto flex-1 space-y-3">
          {/* Supplier selector */}
          {mode === 'add-supplier' && (
            <label className="block">
              <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide font-semibold">Supplier</span>
              <select value={supplier} onChange={e => setSupplier(e.target.value)} className={inputClass}>
                <option value="">— Select —</option>
                {companiesList.map(c => (
                  <option key={c.company_id} value={c.company_id}>{c.name}</option>
                ))}
              </select>
            </label>
          )}

          {/* Date row */}
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide font-semibold">Effective from</span>
              <input type="date" value={effFrom} onChange={e => setEffFrom(e.target.value)} className={inputClass} required />
            </label>
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide font-semibold">Effective to</span>
                {mode === 'edit' && effTo && (
                  <button
                    type="button"
                    onClick={() => setEffTo('')}
                    className="text-xs text-[var(--text-muted)] hover:text-red-500 underline cursor-pointer"
                  >
                    × Remove end date
                  </button>
                )}
              </div>
              <input type="date" value={effTo} onChange={e => setEffTo(e.target.value)}
                className={`${inputClass} ${dateRangeError ? '!border-red-400' : ''}`}
                placeholder="Ongoing" />
              {dateRangeError && (
                <p className="text-xs text-red-500 mt-0.5">{dateRangeError}</p>
              )}
            </div>
          </div>

          {/* Currency + Status row */}
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide font-semibold">Currency</span>
              <input type="text" value={currency} onChange={e => setCurrency(e.target.value.toUpperCase())} maxLength={3} className={inputClass} />
            </label>
            <label>
              <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide font-semibold">Status</span>
              <select value={status} onChange={e => setStatus(e.target.value)} className={inputClass}>
                <option value="PUBLISHED">Published</option>
                <option value="DRAFT">Draft</option>
              </select>
            </label>
          </div>

          {/* Price/Cost row */}
          {isListPriceMode ? (
            <label>
              <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide font-semibold">List price</span>
              <input type="number" step="0.01" value={listPrice} onChange={e => setListPrice(e.target.value)} className={inputClass} />
            </label>
          ) : cardMode === 'lcl' ? (
            <div className="grid grid-cols-2 gap-3">
              <label>
                <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide font-semibold">Cost</span>
                <input type="number" step="0.01" value={cost} onChange={e => setCost(e.target.value)} className={inputClass} />
              </label>
              <label>
                <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide font-semibold">Min qty (W/M)</span>
                <input type="number" step="0.01" placeholder="e.g. 2" value={minQuantity} onChange={e => setMinQuantity(e.target.value)} className={inputClass} />
              </label>
            </div>
          ) : (
            <label>
              <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide font-semibold">Cost</span>
              <input type="number" step="0.01" value={cost} onChange={e => setCost(e.target.value)} className={inputClass} />
            </label>
          )}

          {/* Surcharges section — supplier rates only */}
          {!isListPriceMode && <div className="border-t border-[var(--border)] pt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">
                Surcharges <span className="normal-case font-normal">(optional — leave empty if freight is all-in)</span>
              </span>
              <button
                type="button"
                onClick={() => setSurcharges(prev => [...prev, { code: '', description: '', amount: '' }])}
                className="text-[10px] px-2 py-0.5 rounded border border-dashed border-[var(--sky)]/50 text-[var(--sky)] hover:bg-[var(--sky-mist)]/30 transition-colors"
              >
                + Add surcharge
              </button>
            </div>
            {surcharges.map((s, i) => (
              <div key={i} className="flex gap-2 items-center mb-1.5">
                <input
                  type="text"
                  placeholder="Code"
                  value={s.code}
                  onChange={e => setSurcharges(prev => prev.map((x, j) => j === i ? { ...x, code: e.target.value } : x))}
                  className={`${inputClass} !w-20`}
                />
                <input
                  type="text"
                  placeholder="Description"
                  value={s.description}
                  onChange={e => setSurcharges(prev => prev.map((x, j) => j === i ? { ...x, description: e.target.value } : x))}
                  className={`${inputClass} !w-[200px]`}
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Amount"
                  value={s.amount}
                  onChange={e => setSurcharges(prev => prev.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))}
                  className={`${inputClass} !w-[90px]`}
                />
                <button
                  type="button"
                  onClick={() => setSurcharges(prev => prev.filter((_, j) => j !== i))}
                  className="text-[10px] px-1.5 py-0.5 rounded border border-red-200 text-red-500 hover:bg-red-50 transition-colors shrink-0"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-[var(--border)]">
          <button onClick={onClose}
            className="h-8 px-4 text-xs rounded border border-[var(--border)] hover:bg-[var(--surface)] transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || !effFrom}
            className="h-8 px-4 text-xs rounded bg-[var(--sky)] text-white hover:bg-[var(--sky)]/90 disabled:opacity-50 transition-colors flex items-center gap-1.5">
            {saving && <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
