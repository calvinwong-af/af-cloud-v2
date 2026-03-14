'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { DollarSign, Plus, Pencil, X, RefreshCw, Search } from 'lucide-react';
import { useWeekBuckets } from '../_helpers';
import {
  fetchCurrencyPairsWithSeriesAction,
  upsertCurrencyRateAction,
  createCurrencyPairAction,
  updateCurrencyPairAction,
  fetchRhbRatesAction,
} from '@/app/actions/pricing';
import type { CurrencyPairWithSeries, RhbFetchResult } from '@/app/actions/pricing';
import { ToggleSwitch } from '../_components';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRate(n: number | null): string {
  if (n == null) return '\u2014';
  return n.toFixed(4);
}

function getMondayOfWeek(d: Date): string {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff);
  return m.toISOString().split('T')[0];
}

function todayMonday(): string {
  return getMondayOfWeek(new Date());
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CurrencyPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [historicalCount, setHistoricalCount] = useState(8);
  const [pairs, setPairs] = useState<CurrencyPairWithSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [textFilter, setTextFilter] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [rateModal, setRateModal] = useState<{
    base: string; target: string; weekMonday?: string; rate?: number; notes?: string;
  } | null>(null);
  const [pairModal, setPairModal] = useState<CurrencyPairWithSeries | null>(null);
  const [showNewPair, setShowNewPair] = useState(false);

  // RHB fetch state
  const [rhbFetching, setRhbFetching] = useState(false);
  const [rhbResult, setRhbResult] = useState<RhbFetchResult | null>(null);
  const [rhbError, setRhbError] = useState<string | null>(null);

  const weekBuckets = useWeekBuckets(historicalCount);

  // ResizeObserver — denser 60px columns
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        const available = width - 220;
        const historical = Math.min(26, Math.max(1, Math.floor((available - 120) / 60)));
        setHistoricalCount(historical);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Data fetch
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchCurrencyPairsWithSeriesAction(historicalCount);
      if (!res) { setError('No response'); return; }
      if (res.success) setPairs(res.data);
      else setError(res.error);
    } catch { setError('Failed to load data'); }
    finally { setLoading(false); }
  }, [historicalCount]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleFetchRhb() {
    setRhbFetching(true);
    setRhbResult(null);
    setRhbError(null);
    try {
      const r = await fetchRhbRatesAction();
      if (!r) { setRhbError('No response'); setRhbFetching(false); return; }
      if (r.success) {
        setRhbResult(r.data);
        const fresh = await fetchCurrencyPairsWithSeriesAction(historicalCount);
        if (fresh?.success) setPairs(fresh.data);
      } else {
        setRhbError(r.error ?? 'Fetch failed');
      }
    } catch { setRhbError('Fetch failed'); }
    setRhbFetching(false);
  }

  const displayedPairs = useMemo(() => {
    let result = showInactive ? pairs : pairs.filter(p => p.is_active);
    if (textFilter.trim()) {
      const q = textFilter.trim().toUpperCase();
      result = result.filter(p =>
        p.base_currency.includes(q) || p.target_currency.includes(q) ||
        `${p.base_currency}${p.target_currency}`.includes(q) ||
        `${p.base_currency} ${p.target_currency}`.includes(q)
      );
    }
    return result;
  }, [pairs, showInactive, textFilter]);

  return (
    <div className="space-y-4" ref={containerRef}>
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-lg bg-[var(--sky-mist)] flex items-center justify-center">
            <DollarSign size={18} className="text-[var(--sky)]" />
          </div>
          <h1 className="text-xl font-bold text-[var(--text)]">Exchange Rates</h1>
        </div>
        <p className="text-sm text-[var(--text-muted)] ml-12">Manage weekly currency conversion rates</p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm px-4 py-2 rounded-lg border border-red-200">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">dismiss</button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            value={textFilter}
            onChange={e => setTextFilter(e.target.value)}
            placeholder="Filter pairs…"
            className="h-9 pl-7 pr-3 text-sm rounded-lg border border-[var(--border)] bg-white text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--sky)] focus:border-[var(--sky)] w-40 transition-colors"
          />
          {textFilter && (
            <button
              onClick={() => setTextFilter('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)]"
            >&times;</button>
          )}
        </div>
        <ToggleSwitch checked={showInactive} onChange={setShowInactive} label="Show inactive" />
        <div className="flex-1" />
        <button
          onClick={handleFetchRhb}
          disabled={rhbFetching}
          className="h-9 px-3 text-sm rounded-lg border border-[var(--border)] bg-white text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--sky)] font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50"
        >
          <RefreshCw size={14} className={rhbFetching ? 'animate-spin' : ''} />
          {rhbFetching ? 'Fetching...' : 'Fetch from RHB'}
        </button>
        <button
          onClick={() => setShowNewPair(true)}
          className="flex items-center gap-1.5 h-9 px-3 text-xs font-medium text-white bg-[var(--sky)] rounded-lg hover:opacity-90 transition-opacity"
        >
          <Plus size={14} /> New Pair
        </button>
      </div>

      {/* RHB result/error banner */}
      {(rhbResult || rhbError) && (
        <div className={`flex items-start justify-between gap-3 px-4 py-3 rounded-lg text-sm ${
          rhbResult
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          <span>
            {rhbResult
              ? `Updated ${rhbResult.updated} pair${rhbResult.updated !== 1 ? 's' : ''} from RHB (${rhbResult.rhb_timestamp}). Effective ${rhbResult.effective_from}.${rhbResult.skipped > 0 ? ` ${rhbResult.skipped} pair(s) not found in RHB data.` : ''}`
              : rhbError}
          </span>
          <button
            onClick={() => { setRhbResult(null); setRhbError(null); }}
            className="shrink-0 text-current opacity-60 hover:opacity-100"
          >&times;</button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-[var(--border)] overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th
                className="text-left text-xs font-semibold text-[var(--text-muted)] py-2 px-4 sticky left-0 bg-white z-10 uppercase tracking-wide"
                style={{ minWidth: 220, width: 220 }}
              >
                Currency Pair
              </th>
              {weekBuckets.map(b => (
                <th
                  key={b.week_key}
                  className={`text-center text-[10px] font-semibold py-2 px-1 uppercase tracking-wide ${
                    b.isCurrentWeek
                      ? 'bg-[var(--sky)] text-white'
                      : 'text-[var(--text-muted)]'
                  }`}
                  style={{ minWidth: 60, width: 60 }}
                >
                  {b.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={1 + weekBuckets.length} className="py-12 text-center text-sm text-[var(--text-muted)]">
                  Loading...
                </td>
              </tr>
            ) : displayedPairs.length === 0 ? (
              <tr>
                <td colSpan={1 + weekBuckets.length} className="py-8 text-center text-sm text-[var(--text-muted)]">
                  {textFilter ? `No pairs matching "${textFilter}"` : 'No currency pairs found.'}
                </td>
              </tr>
            ) : displayedPairs.map(pair => {
              const seriesMap = new Map(pair.time_series.map(ts => [ts.week_key, ts]));

              return (
                <tr key={`${pair.base_currency}-${pair.target_currency}`} className="border-b border-[var(--border)] last:border-0 group hover:bg-[var(--surface)]/30">
                  {/* Identity column — lean: pair name + adjustment % only */}
                  <td className="py-2.5 px-4 sticky left-0 bg-white group-hover:bg-[var(--surface)]/30 z-10" style={{ minWidth: 220, width: 220 }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${pair.is_active ? 'bg-emerald-500' : 'bg-red-400'}`} />
                        <span className="text-sm font-semibold text-[var(--text)]">
                          {pair.base_currency} → {pair.target_currency}
                        </span>
                        {pair.adjustment_pct !== 0 && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">
                            {pair.adjustment_pct > 0 ? '+' : ''}{pair.adjustment_pct}%
                          </span>
                        )}
                      </div>
                      {/* Hover actions */}
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setPairModal(pair)}
                          className="p-1 text-[var(--text-muted)] hover:text-[var(--sky)] transition-colors"
                          title="Edit pair"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => setRateModal({ base: pair.base_currency, target: pair.target_currency, weekMonday: todayMonday() })}
                          className="p-1 text-[var(--text-muted)] hover:text-[var(--sky)] transition-colors"
                          title="Add rate"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                  </td>

                  {/* Time-series cells */}
                  {weekBuckets.map(b => {
                    const ts = seriesMap.get(b.week_key);
                    const hasRate = ts && ts.effective_rate != null;
                    return (
                      <td
                        key={b.week_key}
                        className={`text-center py-2.5 px-1 cursor-pointer transition-colors ${
                          b.isCurrentWeek
                            ? 'bg-[var(--sky-mist)]/60 hover:bg-[var(--sky-mist)]'
                            : 'hover:bg-[var(--sky-mist)]/40'
                        }`}
                        style={{ minWidth: 60, width: 60 }}
                        onClick={() => {
                          setRateModal({
                            base: pair.base_currency,
                            target: pair.target_currency,
                            weekMonday: b.week_monday,
                            rate: ts?.raw_rate ?? undefined,
                            notes: undefined,
                          });
                        }}
                      >
                        {hasRate ? (
                          <span className={`text-xs font-mono ${b.isCurrentWeek ? 'font-semibold text-[var(--sky)]' : 'text-[var(--text)]'}`}>
                            {formatRate(ts.effective_rate)}
                          </span>
                        ) : (
                          <>
                            <span className="text-xs text-[var(--text-muted)]/40 group-hover:hidden">{'\u2014'}</span>
                            <span className="text-xs text-[var(--sky)]/60 hidden group-hover:inline">+</span>
                          </>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Rate Modal */}
      {rateModal && (
        <RateModal
          base={rateModal.base}
          target={rateModal.target}
          defaultWeekMonday={rateModal.weekMonday}
          defaultRate={rateModal.rate}
          defaultNotes={rateModal.notes}
          onClose={() => setRateModal(null)}
          onSaved={() => { setRateModal(null); loadData(); }}
          onError={setError}
        />
      )}

      {/* Edit Pair Modal */}
      {pairModal && (
        <EditPairModal
          pair={pairModal}
          onClose={() => setPairModal(null)}
          onSaved={() => { setPairModal(null); loadData(); }}
          onError={setError}
        />
      )}

      {/* New Pair Modal */}
      {showNewPair && (
        <NewPairModal
          onClose={() => setShowNewPair(false)}
          onSaved={() => { setShowNewPair(false); loadData(); }}
          onError={setError}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rate Modal (Add / Edit)
// ---------------------------------------------------------------------------

function RateModal({
  base,
  target,
  defaultWeekMonday,
  defaultRate,
  defaultNotes,
  onClose,
  onSaved,
  onError,
}: {
  base: string;
  target: string;
  defaultWeekMonday?: string;
  defaultRate?: number;
  defaultNotes?: string;
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const [rate, setRate] = useState(defaultRate?.toString() ?? '');
  const [weekOf, setWeekOf] = useState(defaultWeekMonday ?? todayMonday());
  const [notes, setNotes] = useState(defaultNotes ?? '');
  const [saving, setSaving] = useState(false);

  const handleDateChange = (val: string) => {
    if (!val) { setWeekOf(''); return; }
    setWeekOf(getMondayOfWeek(new Date(val + 'T00:00:00')));
  };

  const formatWeekLabel = (dateStr: string): string => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const handleSave = async () => {
    const rateNum = parseFloat(rate);
    if (!rateNum || rateNum <= 0) { onError('Rate must be positive'); return; }
    if (!weekOf) { onError('Week is required'); return; }

    setSaving(true);
    try {
      const res = await upsertCurrencyRateAction(base, target, {
        rate: rateNum,
        week_of: weekOf,
        notes: notes || undefined,
      });
      if (!res) { onError('No response'); return; }
      if (res.success) onSaved();
      else onError(res.error);
    } catch { onError('Failed to save rate'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-xl border border-[var(--border)] shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-[var(--text)]">
            {defaultRate != null ? 'Edit' : 'Add'} Rate — {base} → {target}
          </h3>
          <button onClick={onClose} className="p-1 text-[var(--text-muted)] hover:text-[var(--text)]"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Rate</label>
            <input
              type="number"
              step="0.0001"
              min="0.0001"
              value={rate}
              onChange={e => setRate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--sky)]/30"
              placeholder="e.g. 4.4500"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Week of</label>
            <input
              type="date"
              value={weekOf}
              onChange={e => handleDateChange(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--sky)]/30"
            />
            {weekOf && (
              <p className="text-xs text-[var(--text-muted)] mt-1">Week of {formatWeekLabel(weekOf)}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--sky)]/30"
              placeholder="e.g. Weekly update from BNM"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)]">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-xs font-medium text-white bg-[var(--sky)] rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edit Pair Modal
// ---------------------------------------------------------------------------

function EditPairModal({
  pair,
  onClose,
  onSaved,
  onError,
}: {
  pair: CurrencyPairWithSeries;
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const [adjustmentPct, setAdjustmentPct] = useState(pair.adjustment_pct.toString());
  const [isActive, setIsActive] = useState(pair.is_active);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!pair.pair_id) { onError('Pair ID missing'); return; }
    const adj = parseFloat(adjustmentPct);
    if (isNaN(adj)) { onError('Invalid adjustment percentage'); return; }

    setSaving(true);
    try {
      const res = await updateCurrencyPairAction(pair.pair_id, {
        adjustment_pct: adj,
        is_active: isActive,
        notes: notes || undefined,
      });
      if (!res) { onError('No response'); return; }
      if (res.success) onSaved();
      else onError(res.error);
    } catch { onError('Failed to update pair'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-xl border border-[var(--border)] shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-[var(--text)]">
            Edit Pair — {pair.base_currency} → {pair.target_currency}
          </h3>
          <button onClick={onClose} className="p-1 text-[var(--text-muted)] hover:text-[var(--text)]"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Adjustment %</label>
            <input
              type="number"
              step="0.01"
              value={adjustmentPct}
              onChange={e => setAdjustmentPct(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--sky)]/30"
              autoFocus
            />
            <p className="text-[11px] text-[var(--text-muted)] mt-1">
              Applied as a markup/markdown on the raw rate at quotation calculation time. 0 = no adjustment.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--sky)]/30"
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-muted)]">Active</span>
            <ToggleSwitch checked={isActive} onChange={setIsActive} label="" />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)]">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-xs font-medium text-white bg-[var(--sky)] rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// New Pair Modal
// ---------------------------------------------------------------------------

function NewPairModal({
  onClose,
  onSaved,
  onError,
}: {
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const [baseCurrency, setBaseCurrency] = useState('');
  const [targetCurrency, setTargetCurrency] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const b = baseCurrency.trim().toUpperCase();
    const t = targetCurrency.trim().toUpperCase();
    if (b.length !== 3 || t.length !== 3) { onError('Currency codes must be 3 characters'); return; }
    if (b === t) { onError('Base and target must be different'); return; }

    setSaving(true);
    try {
      const res = await createCurrencyPairAction({ base_currency: b, target_currency: t });
      if (!res) { onError('No response'); return; }
      if (res.success) onSaved();
      else onError(res.error);
    } catch { onError('Failed to create pair'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-xl border border-[var(--border)] shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-[var(--text)]">New Currency Pair</h3>
          <button onClick={onClose} className="p-1 text-[var(--text-muted)] hover:text-[var(--text)]"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Base Currency</label>
            <input
              type="text"
              maxLength={3}
              value={baseCurrency}
              onChange={e => setBaseCurrency(e.target.value.toUpperCase())}
              className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--sky)]/30 uppercase"
              placeholder="USD"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Target Currency</label>
            <input
              type="text"
              maxLength={3}
              value={targetCurrency}
              onChange={e => setTargetCurrency(e.target.value.toUpperCase())}
              className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--sky)]/30 uppercase"
              placeholder="MYR"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)]">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-xs font-medium text-white bg-[var(--sky)] rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
