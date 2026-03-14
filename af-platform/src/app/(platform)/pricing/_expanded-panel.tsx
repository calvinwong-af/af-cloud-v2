'use client';

import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import type { MonthBucket } from './_types';
import type { RateCardDetail, RateDetail, SurchargeItem } from '@/app/actions/pricing';
import {
  deleteFCLRateAction,
  deleteLCLRateAction,
} from '@/app/actions/pricing';
import { formatDate } from './_helpers';
import { CostSparkline } from './_sparkline';
import { RateModal } from './_rate-modal';

// Migration floor — rates with no changes before this date display this as their start
const MIGRATION_FLOOR = '2024-01-01';

type ModalState =
  | { open: false }
  | { open: true; mode: 'add-list-price' }
  | { open: true; mode: 'add-supplier' }
  | { open: true; mode: 'edit'; rateId: number; initial: RateDetail }
  | { open: true; mode: 'update'; initial: RateDetail };

interface ExpandedRatePanelProps {
  detail: RateCardDetail;
  months: MonthBucket[];
  companiesMap: Record<string, string>;
  totalWidth: number;
  cardMode: 'fcl' | 'lcl';
  cardId: number;
  companiesList: { company_id: string; name: string }[];
  onRatesChanged: () => void;
}

export function ExpandedRatePanel({ detail, months, companiesMap, totalWidth, cardMode, cardId, companiesList, onRatesChanged }: ExpandedRatePanelProps) {
  const [modalState, setModalState] = useState<ModalState>({ open: false });
  const [confirmDeleteRateId, setConfirmDeleteRateId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleRateDelete = async (rateId: number) => {
    setDeleting(true);
    try {
      const action = cardMode === 'fcl' ? deleteFCLRateAction : deleteLCLRateAction;
      await action(rateId);
      setConfirmDeleteRateId(null);
      onRatesChanged();
    } finally {
      setDeleting(false);
    }
  };

  const currentMonthKey = months.find(m => m.isCurrentMonth)?.month_key ?? '';

  const getLatestEffective = (rates: RateDetail[]): string | null => {
    return rates.map(r => r.effective_from).filter(Boolean).sort().at(-1) ?? null;
  };

  const formatRatesRange = (rates: RateDetail[]): string => {
    if (rates.length === 0) return '\u2014';

    // Filter out rates with inverted dates (effective_from > effective_to)
    const validRates = rates.filter(r =>
      r.effective_to === null || (r.effective_from ?? '') <= r.effective_to
    );
    if (validRates.length === 0) return '\u2014';

    const latestRate = validRates.slice().sort(
      (a, b) => (b.effective_from ?? '').localeCompare(a.effective_from ?? '')
    )[0];

    const rawFrom = latestRate.effective_from ?? MIGRATION_FLOOR;
    const displayFrom = rawFrom <= MIGRATION_FLOOR
      ? formatDate(MIGRATION_FLOOR)
      : formatDate(rawFrom);

    const displayTo = latestRate.effective_to === null
      ? 'Open'
      : formatDate(latestRate.effective_to);

    return `Since ${displayFrom} \u2192 ${displayTo}`;
  };

  const getEffectiveRate = (rates: RateDetail[]): RateDetail | undefined => {
    const today = new Date().toISOString().slice(0, 10);
    return rates.find(r =>
      r.rate_status === 'PUBLISHED' &&
      (r.effective_from ?? '') <= today &&
      (r.effective_to == null || r.effective_to >= today)
    );
  };

  const priceRefRates = detail.rates_by_supplier['null'] ?? [];
  const supplierEntries = Object.entries(detail.rates_by_supplier);
  const supplierRows = supplierEntries
    .filter(([key]) => key !== 'null')
    .sort(([idA, ratesA], [idB, ratesB]) => {
      const latestA = getLatestEffective(ratesA) ?? '';
      const latestB = getLatestEffective(ratesB) ?? '';
      if (latestB > latestA) return 1;
      if (latestB < latestA) return -1;
      const nameA = companiesMap[idA] ?? idA;
      const nameB = companiesMap[idB] ?? idB;
      return nameA.localeCompare(nameB);
    });

  // Find dominant rate for a month (shared logic for buildMonthMap and buildSurchargesMap)
  const getDominantRate = (sorted: RateDetail[], monthKey: string, monthStart: string): RateDetail | null => {
    const upperBound = monthStart;
    const dominantRate = sorted.find(r => (r.effective_from ?? '') <= upperBound) ?? null;
    if (!dominantRate) return null;
    const effTo = dominantRate.effective_to ?? null;
    if (effTo !== null && effTo < monthStart) return null;
    return dominantRate;
  };

  const buildMonthMap = (
    rates: RateDetail[],
    valueKey: 'list_price' | 'cost',
  ): Map<string, { value: number | null; isDraft: boolean }> => {
    const sorted = [...rates].sort(
      (a, b) => (b.effective_from ?? '').localeCompare(a.effective_from ?? ''),
    );
    const result = new Map<string, { value: number | null; isDraft: boolean }>();
    for (const m of months) {
      const monthStart = `${m.month_key}-01`;
      const isFuture = m.month_key > currentMonthKey;

      if (isFuture) {
        // Check for a rate starting exactly in this future month
        const exactRate = sorted.find(r => (r.effective_from ?? '').substring(0, 7) === m.month_key) ?? null;
        if (exactRate && (exactRate.effective_to === null || exactRate.effective_to >= monthStart)) {
          result.set(m.month_key, { value: exactRate[valueKey] ?? null, isDraft: exactRate.rate_status === 'DRAFT' });
        } else {
          result.set(m.month_key, { value: null, isDraft: false });
        }
        continue;
      }

      const dominant = getDominantRate(sorted, m.month_key, monthStart);
      if (dominant) {
        result.set(m.month_key, {
          value: dominant[valueKey] ?? null,
          isDraft: dominant.rate_status === 'DRAFT',
        });
      } else {
        result.set(m.month_key, { value: null, isDraft: false });
      }
    }
    return result;
  };

  const buildSurchargesMap = (rates: RateDetail[]): Map<string, SurchargeItem[] | null> => {
    const sorted = [...rates].sort(
      (a, b) => (b.effective_from ?? '').localeCompare(a.effective_from ?? ''),
    );
    const result = new Map<string, SurchargeItem[] | null>();
    for (const m of months) {
      const monthStart = `${m.month_key}-01`;
      const isFuture = m.month_key > currentMonthKey;

      if (isFuture) {
        // Check for a rate starting exactly in this future month
        const exactRate = sorted.find(r => (r.effective_from ?? '').substring(0, 7) === m.month_key) ?? null;
        if (exactRate && (exactRate.effective_to === null || exactRate.effective_to >= monthStart)) {
          result.set(m.month_key, exactRate.surcharges ?? null);
        } else {
          result.set(m.month_key, null);
        }
        continue;
      }

      const dominant = getDominantRate(sorted, m.month_key, monthStart);
      result.set(m.month_key, dominant?.surcharges ?? null);
    }
    return result;
  };

  const buildEndDateMap = (rates: RateDetail[]): Map<string, RateDetail> => {
    const map = new Map<string, RateDetail>();
    for (const rate of rates) {
      if (rate.effective_to) {
        const mk = rate.effective_to.substring(0, 7);
        const existing = map.get(mk);
        if (!existing || (rate.effective_from ?? '') > (existing.effective_from ?? '')) {
          map.set(mk, rate);
        }
      }
    }
    return map;
  };

  const buildStartDateMap = (rates: RateDetail[]): Map<string, RateDetail> => {
    const MIGRATION_FLOOR_MK = '2024-01';
    const map = new Map<string, RateDetail>();
    for (const rate of rates) {
      if (rate.effective_from && rate.effective_from.substring(0, 7) > MIGRATION_FLOOR_MK) {
        const mk = rate.effective_from.substring(0, 7);
        const existing = map.get(mk);
        if (!existing || (rate.effective_from ?? '') > (existing.effective_from ?? '')) {
          map.set(mk, rate);
        }
      }
    }
    return map;
  };

  const buildDominantRateMap = (rates: RateDetail[]): Map<string, RateDetail> => {
    const sorted = [...rates].sort(
      (a, b) => (b.effective_from ?? '').localeCompare(a.effective_from ?? ''),
    );
    const map = new Map<string, RateDetail>();
    for (const m of months) {
      const monthStart = `${m.month_key}-01`;
      const dominant = getDominantRate(sorted, m.month_key, monthStart);
      if (dominant) map.set(m.month_key, dominant);
    }
    return map;
  };

  const isLatestRateId = (rateId: number): boolean => {
    if (priceRefRates[0]?.id === rateId) return true;
    return supplierRows.some(([, rates]) => rates[0]?.id === rateId);
  };

  const priceRefMap = buildMonthMap(priceRefRates, 'list_price');
  const priceRefSurchargesMap = buildSurchargesMap(priceRefRates);
  const priceRefEndDateMap = buildEndDateMap(priceRefRates);
  const latestPriceRef = priceRefRates[0] ?? null;

  return (
    <>
      <div>
        {/* Price reference row — sparkline */}
        <div className="flex" style={{ minWidth: `${totalWidth}px` }}>
          <div className="w-[220px] shrink-0 px-3 py-2 flex flex-col gap-0.5">
            <span className="text-[11px] font-semibold text-[var(--sky)] uppercase tracking-wide">List Price</span>
            <span className="text-[10px] text-[var(--text-muted)]">Reference rate</span>
            {priceRefRates.length > 0 && (
              <div className="text-[10px] text-[var(--text-muted)]">{formatRatesRange(priceRefRates)}</div>
            )}
            {!latestPriceRef && (
              <button
                onClick={() => setModalState({ open: true, mode: 'add-list-price' })}
                className="text-[10px] px-2 py-0.5 rounded border border-dashed border-[var(--sky)]/50 text-[var(--sky)] hover:bg-[var(--sky-mist)]/30 transition-colors mt-0.5 self-start"
              >
                + Set List Price
              </button>
            )}
            {latestPriceRef && (
              <div className="flex items-center gap-1 mt-0.5">
                {latestPriceRef.rate_status === 'PUBLISHED' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); const effective = getEffectiveRate(priceRefRates); setModalState({ open: true, mode: 'update', initial: effective ?? latestPriceRef }); }}
                    className="p-1 text-[var(--text-muted)] hover:text-[var(--sky)] transition-colors"
                    title="Add rate"
                  >
                    <Pencil size={12} />
                  </button>
                )}
                {latestPriceRef.rate_status === 'DRAFT' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setModalState({ open: true, mode: 'edit', rateId: latestPriceRef.id, initial: latestPriceRef }); }}
                    className="p-1 text-[var(--text-muted)] hover:text-[var(--sky)] transition-colors"
                    title="Edit"
                  >
                    <Pencil size={12} />
                  </button>
                )}
                {confirmDeleteRateId === latestPriceRef.id ? (
                  <span className="flex items-center gap-1 text-[10px]">
                    <span className="text-[var(--text-muted)]">Sure?</span>
                    <button onClick={() => handleRateDelete(latestPriceRef.id)} disabled={deleting}
                      className="text-red-600 hover:text-red-800 font-medium disabled:opacity-50">Yes</button>
                    <button onClick={() => setConfirmDeleteRateId(null)}
                      className="text-[var(--text-muted)] hover:text-[var(--text)]">No</button>
                  </span>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteRateId(latestPriceRef.id); }}
                    className="p-1 text-[var(--text-muted)] hover:text-red-500 transition-colors"
                    title="Delete rate"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            )}
          </div>
          <div style={{ width: `${months.length * 80}px`, flexShrink: 0 }} className="flex items-center">
            <CostSparkline
              monthMap={priceRefMap}
              months={months}
              color="#0ea5e9"
              surchargesMap={priceRefSurchargesMap}
              endDateMap={priceRefEndDateMap}
              startDateMap={buildStartDateMap(priceRefRates)}
              dominantRateMap={buildDominantRateMap(priceRefRates)}
              onNodeClick={(rate) => setModalState({ open: true, mode: 'edit', rateId: rate.id, initial: rate })}
            />
          </div>
        </div>

        {/* Supplier Costs divider — always shown, with + Supplier Rate button */}
        <div className="px-3 py-1 bg-slate-100/80 border-y border-[var(--border)]/60 flex items-center justify-between" style={{ minWidth: `${totalWidth}px` }}>
          <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">Supplier Costs</span>
          <button
            onClick={() => setModalState({ open: true, mode: 'add-supplier' })}
            className="text-[10px] px-2 py-0.5 rounded border border-dashed border-[var(--sky)]/50 text-[var(--sky)] hover:bg-[var(--sky-mist)]/30 transition-colors"
          >
            + Supplier Rate
          </button>
        </div>

        {/* Supplier rows — sparkline per row */}
        {supplierRows.map(([supplierId, rates]) => {
          const supplierName = companiesMap[supplierId] ?? '';
          const costMapData = buildMonthMap(rates, 'cost');
          const costSurchargesMap = buildSurchargesMap(rates);
          const supplierEndDateMap = buildEndDateMap(rates);
          const latestRate = rates[0];
          return (
            <div key={supplierId}>
              <div className="flex border-t border-[var(--border)]/50" style={{ minWidth: `${totalWidth}px` }}>
                <div className="w-[220px] shrink-0 px-3 py-2 flex flex-col gap-0.5">
                  <span className="text-[11px] font-medium text-[var(--text)] truncate" title={`${supplierName} (${supplierId})`}>
                    {supplierName || supplierId}
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)] font-mono">{supplierId}</span>
                  {rates.length > 0 && (
                    <div className="text-[10px] text-[var(--text-muted)]">{formatRatesRange(rates)}</div>
                  )}
                  {cardMode === 'lcl' && latestRate.min_quantity != null && (
                    <span className="text-[10px] text-[var(--text-muted)]">
                      Min: {latestRate.min_quantity} W/M
                    </span>
                  )}
                  {latestRate && (
                    <div className="flex items-center gap-1 mt-0.5">
                      {latestRate.rate_status === 'PUBLISHED' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); const effective = getEffectiveRate(rates); setModalState({ open: true, mode: 'update', initial: effective ?? latestRate }); }}
                          className="p-1 text-[var(--text-muted)] hover:text-[var(--sky)] transition-colors"
                          title="Add rate"
                        >
                          <Pencil size={12} />
                        </button>
                      )}
                      {latestRate.rate_status === 'DRAFT' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setModalState({ open: true, mode: 'edit', rateId: latestRate.id, initial: latestRate }); }}
                          className="p-1 text-[var(--text-muted)] hover:text-[var(--sky)] transition-colors"
                          title="Edit"
                        >
                          <Pencil size={12} />
                        </button>
                      )}
                      {confirmDeleteRateId === latestRate.id ? (
                        <span className="flex items-center gap-1 text-[10px]">
                          <span className="text-[var(--text-muted)]">Sure?</span>
                          <button onClick={() => handleRateDelete(latestRate.id)} disabled={deleting}
                            className="text-red-600 hover:text-red-800 font-medium disabled:opacity-50">Yes</button>
                          <button onClick={() => setConfirmDeleteRateId(null)}
                            className="text-[var(--text-muted)] hover:text-[var(--text)]">No</button>
                        </span>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmDeleteRateId(latestRate.id); }}
                          className="p-1 text-[var(--text-muted)] hover:text-red-500 transition-colors"
                          title="Delete rate"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ width: `${months.length * 80}px`, flexShrink: 0 }} className="flex items-center">
                  <CostSparkline
                    monthMap={costMapData}
                    months={months}
                    surchargesMap={costSurchargesMap}
                    endDateMap={supplierEndDateMap}
                    startDateMap={buildStartDateMap(rates)}
                    dominantRateMap={buildDominantRateMap(rates)}
                    onNodeClick={(rate) => setModalState({ open: true, mode: 'edit', rateId: rate.id, initial: rate })}
                  />
                </div>
              </div>
            </div>
          );
        })}

        {supplierRows.length === 0 && priceRefRates.length === 0 && (
          <div className="px-4 py-3 text-xs text-[var(--text-muted)]" style={{ minWidth: `${totalWidth}px` }}>No rate data available</div>
        )}

      </div>

      <RateModal
        open={modalState.open}
        mode={modalState.open ? modalState.mode : 'add-list-price'}
        rateId={modalState.open && modalState.mode === 'edit' ? modalState.rateId : undefined}
        initial={modalState.open && (modalState.mode === 'edit' || modalState.mode === 'update') ? modalState.initial : undefined}
        cardMode={cardMode}
        cardId={cardId}
        companiesList={companiesList}
        onSaved={onRatesChanged}
        onClose={() => setModalState({ open: false })}
        onDelete={modalState.open && modalState.mode === 'edit' ? async (rateId) => {
          const action = cardMode === 'fcl' ? deleteFCLRateAction : deleteLCLRateAction;
          await action(rateId);
          onRatesChanged();
        } : undefined}
        isLatestRate={modalState.open && modalState.mode === 'edit'
          ? isLatestRateId(modalState.rateId)
          : undefined}
      />
    </>
  );
}
