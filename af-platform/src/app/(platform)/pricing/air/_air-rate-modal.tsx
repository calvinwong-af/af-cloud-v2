'use client';

import { useState, useEffect } from 'react';
import {
  createAirRateAction,
  updateAirRateAction,
  createAirListPriceCardAction,
  createAirListPriceRateAction,
  updateAirListPriceRateAction,
} from '@/app/actions/pricing';

interface AirRateModalProps {
  open: boolean;
  mode: 'add-list-price' | 'add-supplier' | 'edit' | 'update';
  rateId?: number;
  initial?: Record<string, unknown>;
  cardId: number;
  isListPrice?: boolean;
  listPriceCardId?: number | null;
  originPortCode?: string;
  destPortCode?: string;
  dgClassCode?: string;
  companiesList: { company_id: string; name: string }[];
  onSaved: () => void;
  onClose: () => void;
  onDelete?: (rateId: number) => Promise<void>;
  isLatestRate?: boolean;
}

const inputClass = "h-8 px-2 text-xs rounded border border-[var(--border)] bg-white text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--sky)] focus:border-[var(--sky)] w-full";

const TIER_FIELDS_LIST = [
  { key: 'l45_list_price', label: 'L45' },
  { key: 'p45_list_price', label: '+45' },
  { key: 'p100_list_price', label: '+100' },
  { key: 'p250_list_price', label: '+250' },
  { key: 'p300_list_price', label: '+300' },
  { key: 'p500_list_price', label: '+500' },
  { key: 'p1000_list_price', label: '+1000' },
  { key: 'min_list_price', label: 'MIN' },
] as const;

const TIER_FIELDS_COST = [
  { key: 'l45_cost', label: 'L45 Cost' },
  { key: 'p45_cost', label: '+45 Cost' },
  { key: 'p100_cost', label: '+100 Cost' },
  { key: 'p250_cost', label: '+250 Cost' },
  { key: 'p300_cost', label: '+300 Cost' },
  { key: 'p500_cost', label: '+500 Cost' },
  { key: 'p1000_cost', label: '+1000 Cost' },
  { key: 'min_cost', label: 'MIN Cost' },
] as const;

type TierValues = Record<string, string>;

export function AirRateModal({ open, mode, rateId, initial, cardId, isListPrice, listPriceCardId, originPortCode, destPortCode, dgClassCode, companiesList, onSaved, onClose, onDelete, isLatestRate }: AirRateModalProps) {
  const [saving, setSaving] = useState(false);
  const [deletePhase, setDeletePhase] = useState<'idle' | 'confirm'>('idle');
  const [deleting, setDeleting] = useState(false);
  const [supplier, setSupplier] = useState('');
  const [effFrom, setEffFrom] = useState('');
  const [effTo, setEffTo] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [status, setStatus] = useState('PUBLISHED');
  const [tierValues, setTierValues] = useState<TierValues>({});
  const [surcharges, setSurcharges] = useState<{ code: string; description: string; amount: string }[]>([]);

  useEffect(() => {
    if (!open) return;
    setDeletePhase('idle');
    setDeleting(false);
    if ((mode === 'edit' || mode === 'update') && initial) {
      setSupplier((initial.supplier_id as string) ?? '');
      if (mode === 'update') {
        const now = new Date();
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const yyyy = nextMonth.getFullYear();
        const mm = String(nextMonth.getMonth() + 1).padStart(2, '0');
        setEffFrom(`${yyyy}-${mm}-01`);
        setEffTo('');
      } else {
        setEffFrom((initial.effective_from as string) ?? '');
        setEffTo((initial.effective_to as string) ?? '');
      }
      setCurrency((initial.currency as string) ?? 'USD');
      setStatus('PUBLISHED');

      // Populate tier values from initial
      const tv: TierValues = {};
      const allFields = [...TIER_FIELDS_LIST, ...TIER_FIELDS_COST];
      for (const f of allFields) {
        const val = initial[f.key];
        tv[f.key] = val != null ? String(val) : '';
      }
      setTierValues(tv);

      setSurcharges(
        ((initial.surcharges as Array<{ code: string; description: string; amount: number }>) ?? []).map(s => ({
          code: s.code,
          description: s.description ?? '',
          amount: String(s.amount),
        }))
      );
    } else {
      setSupplier('');
      setEffFrom('');
      setEffTo('');
      setCurrency('USD');
      setStatus('PUBLISHED');
      setTierValues({});
      setSurcharges([]);
    }
  }, [open, mode, initial]);

  if (!open) return null;

  const dateRangeError = effTo && effFrom && effTo < effFrom
    ? 'Effective To cannot be before Effective From'
    : null;

  const isListPriceMode = isListPrice || mode === 'add-list-price';

  const tierFields = isListPriceMode ? TIER_FIELDS_LIST : TIER_FIELDS_COST;

  const serializeSurcharges = () => {
    const valid = surcharges
      .filter(s => s.code.trim() && s.amount.trim())
      .map(s => ({ code: s.code.trim().toUpperCase(), description: s.description.trim(), amount: parseFloat(s.amount) }));
    return valid.length > 0 ? valid : null;
  };

  const handleDelete = async () => {
    if (!onDelete || rateId == null) return;
    setDeleting(true);
    try {
      await onDelete(rateId);
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (mode === 'add-list-price' || mode === 'add-supplier' || mode === 'update') {
        const data: Record<string, unknown> = {
          supplier_id: mode === 'add-list-price' ? null
            : mode === 'update' ? (initial?.supplier_id ?? null)
            : (supplier || null),
          effective_from: effFrom,
          effective_to: effTo || null,
          currency,
          rate_status: status,
          surcharges: serializeSurcharges(),
        };
        // Add tier values
        for (const f of [...TIER_FIELDS_LIST, ...TIER_FIELDS_COST]) {
          const val = tierValues[f.key];
          data[f.key] = val ? parseFloat(val) : null;
        }
        if (isListPrice) {
          let resolvedCardId = listPriceCardId;
          if (!resolvedCardId) {
            const cardResult = await createAirListPriceCardAction({
              origin_port_code: originPortCode!,
              destination_port_code: destPortCode!,
              dg_class_code: dgClassCode!,
            });
            if (!cardResult.success) {
              console.error('[AirRateModal] Failed to create list price card:', cardResult.error);
              return;
            }
            resolvedCardId = cardResult.data.id;
          }
          await createAirListPriceRateAction(resolvedCardId, data);
        } else {
          await createAirRateAction(cardId, data);
        }
      } else if (mode === 'edit' && rateId != null) {
        const data: Record<string, unknown> = {
          effective_from: effFrom || undefined,
          effective_to: effTo || null,
          currency,
          rate_status: status,
          surcharges: serializeSurcharges(),
        };
        for (const f of [...TIER_FIELDS_LIST, ...TIER_FIELDS_COST]) {
          const val = tierValues[f.key];
          data[f.key] = val ? parseFloat(val) : null;
        }
        if (isListPrice) {
          await updateAirListPriceRateAction(rateId, data);
        } else {
          await updateAirRateAction(rateId, data);
        }
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
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide font-semibold">Effective from</span>
              </div>
              <input type="date" value={effFrom} onChange={e => setEffFrom(e.target.value)} className={inputClass} required />
            </div>
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

          {/* Breakpoint fields — 4x2 grid */}
          <div className="border-t border-[var(--border)] pt-3">
            <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2 block">
              {isListPriceMode ? 'Breakpoint Prices (per kg)' : 'Breakpoint Costs (per kg)'}
            </span>
            <div className="grid grid-cols-4 gap-2">
              {tierFields.map(f => (
                <label key={f.key}>
                  <span className="text-[10px] text-[var(--text-muted)]">{f.label}</span>
                  <input
                    type="number"
                    step="0.01"
                    value={tierValues[f.key] ?? ''}
                    onChange={e => setTierValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                    className={inputClass}
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Surcharges section — only in supplier cost mode */}
          {!isListPriceMode && <div className="border-t border-[var(--border)] pt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">
                Surcharges <span className="normal-case font-normal">(optional)</span>
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
                <input type="text" placeholder="Code" value={s.code}
                  onChange={e => setSurcharges(prev => prev.map((x, j) => j === i ? { ...x, code: e.target.value } : x))}
                  className={`${inputClass} !w-20`} />
                <input type="text" placeholder="Description" value={s.description}
                  onChange={e => setSurcharges(prev => prev.map((x, j) => j === i ? { ...x, description: e.target.value } : x))}
                  className={`${inputClass} !w-[200px]`} />
                <input type="number" step="0.01" placeholder="Amount" value={s.amount}
                  onChange={e => setSurcharges(prev => prev.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))}
                  className={`${inputClass} !w-[90px]`} />
                <button type="button" onClick={() => setSurcharges(prev => prev.filter((_, j) => j !== i))}
                  className="text-[10px] px-1.5 py-0.5 rounded border border-red-200 text-red-500 hover:bg-red-50 transition-colors shrink-0">
                  Remove
                </button>
              </div>
            ))}
          </div>}
        </div>

        {/* Footer */}
        {deletePhase === 'confirm' ? (
          <div className="px-5 py-4 border-t border-[var(--border)]">
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-xs text-red-700 mb-3">
              <p className="font-semibold mb-1">Delete this rate?</p>
              <p>
                This will permanently delete rate #{rateId}
                {isLatestRate === false && ' (a historical rate node)'}.
                {' '}Deleting a published rate may create a gap in the rate timeline.
                This action cannot be undone.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeletePhase('idle')}
                className="h-8 px-4 text-xs rounded border border-[var(--border)] hover:bg-[var(--surface)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="h-8 px-4 text-xs rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
              >
                {deleting && <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />}
                Yes, delete
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--border)]">
            {mode === 'edit' && onDelete != null ? (
              <button
                onClick={() => {
                  if ((initial?.rate_status as string) === 'DRAFT') {
                    handleDelete();
                  } else {
                    setDeletePhase('confirm');
                  }
                }}
                disabled={deleting}
                className="h-8 px-3 text-xs rounded border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                Delete rate
              </button>
            ) : (
              <div />
            )}
            <div className="flex gap-2">
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
        )}
      </div>
    </div>
  );
}
