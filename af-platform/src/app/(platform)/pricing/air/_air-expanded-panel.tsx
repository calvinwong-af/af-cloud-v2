'use client';

import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import type { AirRateCard, AirRate, AirListPriceRate, SurchargeItem, RateDetail } from '@/app/actions/pricing';
import {
  deleteAirRateAction,
  deleteAirListPriceRateAction,
} from '@/app/actions/pricing';
import { formatDate } from '../_helpers';
import type { MonthBucket } from '../_types';
import { CostSparkline } from '../_sparkline';
import { AirRateModal } from './_air-rate-modal';

// Migration floor — rates with no changes before this date display this as their start
const MIGRATION_FLOOR = '2024-01-01';

type ModalState =
  | { open: false }
  | { open: true; mode: 'add-list-price' }
  | { open: true; mode: 'add-supplier' }
  | { open: true; mode: 'edit'; rateId: number; initial: Record<string, unknown> }
  | { open: true; mode: 'update'; initial: Record<string, unknown> };

// -----------------------------------------------------------------------
// Shared helpers
// -----------------------------------------------------------------------

function formatRatesRange(rates: AirRate[]): string {
  if (rates.length === 0) return '\u2014';
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
}

function getEffectiveRate(rates: AirRate[]): AirRate | undefined {
  const today = new Date().toISOString().slice(0, 10);
  return rates.find(r =>
    r.rate_status === 'PUBLISHED' &&
    (r.effective_from ?? '') <= today &&
    (r.effective_to == null || r.effective_to >= today)
  );
}

function getDominantRate(sorted: AirRate[], monthKey: string, monthStart: string): AirRate | null {
  const upperBound = monthStart;
  const dominantRate = sorted.find(r => (r.effective_from ?? '') <= upperBound) ?? null;
  if (!dominantRate) return null;
  const effToMonth = dominantRate.effective_to
    ? dominantRate.effective_to.substring(0, 7)
    : null;
  if (effToMonth !== null && effToMonth < monthKey) return null;
  return dominantRate;
}

function buildMonthMap(
  rates: AirRate[],
  months: MonthBucket[],
  currentMonthKey: string,
  valueKey: 'p100_list_price' | 'p100_cost',
): Map<string, { value: number | null; isDraft: boolean }> {
  const sorted = [...rates].sort(
    (a, b) => (b.effective_from ?? '').localeCompare(a.effective_from ?? ''),
  );
  const result = new Map<string, { value: number | null; isDraft: boolean }>();
  for (const m of months) {
    const monthStart = `${m.month_key}-01`;
    const isFuture = m.month_key > currentMonthKey;

    if (isFuture) {
      // First check for an exact rate set for this future month
      const exactRate = sorted.find(r => (r.effective_from ?? '').substring(0, 7) === m.month_key) ?? null;
      if (exactRate && (exactRate.effective_to === null || exactRate.effective_to >= monthStart)) {
        result.set(m.month_key, { value: exactRate[valueKey] ?? null, isDraft: exactRate.rate_status === 'DRAFT' });
        continue;
      }
      // Fall back to carry-forward: find the dominant rate that covers this future month
      const dominant = getDominantRate(sorted, m.month_key, monthStart);
      if (dominant) {
        result.set(m.month_key, {
          value: dominant[valueKey] ?? null,
          isDraft: dominant.rate_status === 'DRAFT',
        });
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
}

function buildSurchargesMap(rates: AirRate[], months: MonthBucket[], currentMonthKey: string): Map<string, SurchargeItem[] | null> {
  const sorted = [...rates].sort(
    (a, b) => (b.effective_from ?? '').localeCompare(a.effective_from ?? ''),
  );
  const result = new Map<string, SurchargeItem[] | null>();
  for (const m of months) {
    const monthStart = `${m.month_key}-01`;
    const isFuture = m.month_key > currentMonthKey;

    if (isFuture) {
      const exactRate = sorted.find(r => (r.effective_from ?? '').substring(0, 7) === m.month_key) ?? null;
      if (exactRate && (exactRate.effective_to === null || exactRate.effective_to >= monthStart)) {
        result.set(m.month_key, exactRate.surcharges ?? null);
        continue;
      }
      // Fall back to carry-forward
      const dominant = getDominantRate(sorted, m.month_key, monthStart);
      result.set(m.month_key, dominant?.surcharges ?? null);
      continue;
    }

    const dominant = getDominantRate(sorted, m.month_key, monthStart);
    result.set(m.month_key, dominant?.surcharges ?? null);
  }
  return result;
}

function buildEndDateMap(rates: AirRate[]): Map<string, RateDetail> {
  const map = new Map<string, RateDetail>();
  for (const rate of rates) {
    if (rate.effective_to) {
      const mk = rate.effective_to.substring(0, 7);
      const existing = map.get(mk);
      if (!existing || (rate.effective_from ?? '') > (existing.effective_from ?? '')) {
        map.set(mk, rate as unknown as RateDetail);
      }
    }
  }
  return map;
}

function buildStartDateMap(rates: AirRate[]): Map<string, RateDetail> {
  const MIGRATION_FLOOR_MK = '2024-01';
  const map = new Map<string, RateDetail>();
  for (const rate of rates) {
    if (rate.effective_from && rate.effective_from.substring(0, 7) > MIGRATION_FLOOR_MK) {
      const mk = rate.effective_from.substring(0, 7);
      const existing = map.get(mk);
      if (!existing || (rate.effective_from ?? '') > (existing.effective_from ?? '')) {
        map.set(mk, rate as unknown as RateDetail);
      }
    }
  }
  return map;
}

function buildDominantRateMap(rates: AirRate[], months: MonthBucket[]): Map<string, RateDetail> {
  const sorted = [...rates].sort(
    (a, b) => (b.effective_from ?? '').localeCompare(a.effective_from ?? ''),
  );
  const map = new Map<string, RateDetail>();
  for (const m of months) {
    const monthStart = `${m.month_key}-01`;
    const dominant = getDominantRate(sorted, m.month_key, monthStart);
    if (dominant) map.set(m.month_key, dominant as unknown as RateDetail);
  }
  return map;
}

// =======================================================================
// AirODExpandedPanel — O/D-level list price panel
// =======================================================================

interface AirODExpandedPanelProps {
  listPriceRates: AirListPriceRate[];
  listPriceCardId: number | null;
  originPortCode: string;
  destPortCode: string;
  dgClassCode: string;
  months: MonthBucket[];
  companiesList: { company_id: string; name: string }[];
  onRatesChanged: () => void;
}

export function AirODExpandedPanel({
  listPriceRates,
  listPriceCardId,
  originPortCode,
  destPortCode,
  dgClassCode,
  months,
  companiesList,
  onRatesChanged,
}: AirODExpandedPanelProps) {
  const [modalState, setModalState] = useState<ModalState>({ open: false });
  const [confirmDeleteRateId, setConfirmDeleteRateId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const totalWidth = 280 + months.length * 80;
  const currentMonthKey = months.find(m => m.isCurrentMonth)?.month_key ?? '';

  const rates = listPriceRates as unknown as AirRate[];
  const priceRefMap = buildMonthMap(rates, months, currentMonthKey, 'p100_list_price');
  const priceRefSurchargesMap = buildSurchargesMap(rates, months, currentMonthKey);
  const priceRefEndDateMap = buildEndDateMap(rates);
  const latestPriceRef = rates[0] ?? null;

  const handleListPriceDelete = async (rateId: number) => {
    setDeleting(true);
    try {
      await deleteAirListPriceRateAction(rateId);
      setConfirmDeleteRateId(null);
      onRatesChanged();
    } finally {
      setDeleting(false);
    }
  };

  const isLatestRateId = (rateId: number): boolean => rates[0]?.id === rateId;

  return (
    <>
      <div>
        {/* List Price sparkline row */}
        <div className="flex" style={{ minWidth: `${totalWidth}px` }}>
          <div className="w-[280px] shrink-0 px-3 py-2 flex flex-col gap-0.5">
            <span className="text-[11px] font-semibold text-[var(--sky)] uppercase tracking-wide">List Price</span>
            {rates.length > 0 && (
              <div className="text-[10px] text-[var(--text-muted)]">{formatRatesRange(rates)}</div>
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
                    onClick={(e) => { e.stopPropagation(); const effective = getEffectiveRate(rates); setModalState({ open: true, mode: 'update', initial: (effective ?? latestPriceRef) as unknown as Record<string, unknown> }); }}
                    className="p-1 text-[var(--text-muted)] hover:text-[var(--sky)] transition-colors"
                    title="Add rate"
                  >
                    <Pencil size={12} />
                  </button>
                )}
                {latestPriceRef.rate_status === 'DRAFT' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setModalState({ open: true, mode: 'edit', rateId: latestPriceRef.id, initial: latestPriceRef as unknown as Record<string, unknown> }); }}
                    className="p-1 text-[var(--text-muted)] hover:text-[var(--sky)] transition-colors"
                    title="Edit"
                  >
                    <Pencil size={12} />
                  </button>
                )}
                {confirmDeleteRateId === latestPriceRef.id ? (
                  <span className="flex items-center gap-1 text-[10px]">
                    <span className="text-[var(--text-muted)]">Sure?</span>
                    <button onClick={() => handleListPriceDelete(latestPriceRef.id)} disabled={deleting}
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
              startDateMap={buildStartDateMap(rates)}
              dominantRateMap={buildDominantRateMap(rates, months)}
              onNodeClick={(rate) => setModalState({ open: true, mode: 'edit', rateId: rate.id, initial: rate as unknown as Record<string, unknown> })}
            />
          </div>
        </div>

        {rates.length === 0 && (
          <div className="px-4 py-3 text-xs text-[var(--text-muted)]" style={{ minWidth: `${totalWidth}px` }}>No list price data available</div>
        )}
      </div>

      <AirRateModal
        open={modalState.open}
        mode={modalState.open ? modalState.mode : 'add-list-price'}
        rateId={modalState.open && modalState.mode === 'edit' ? modalState.rateId : undefined}
        initial={modalState.open && (modalState.mode === 'edit' || modalState.mode === 'update') ? modalState.initial : undefined}
        cardId={0}
        listPriceCardId={listPriceCardId}
        isListPrice={true}
        originPortCode={originPortCode}
        destPortCode={destPortCode}
        dgClassCode={dgClassCode}
        companiesList={companiesList}
        onSaved={onRatesChanged}
        onClose={() => setModalState({ open: false })}
        onDelete={modalState.open && modalState.mode === 'edit' ? async (rateId) => {
          await deleteAirListPriceRateAction(rateId);
          onRatesChanged();
        } : undefined}
        isLatestRate={modalState.open && modalState.mode === 'edit'
          ? isLatestRateId(modalState.rateId)
          : undefined}
      />
    </>
  );
}

// =======================================================================
// AirExpandedPanel — Per-airline supplier costs only
// =======================================================================

interface AirExpandedPanelProps {
  detail: AirRateCard;
  companiesMap: Record<string, string>;
  cardId: number;
  companiesList: { company_id: string; name: string }[];
  months: MonthBucket[];
  onRatesChanged: () => void;
}

export function AirExpandedPanel({
  detail,
  companiesMap,
  cardId,
  companiesList,
  months,
  onRatesChanged,
}: AirExpandedPanelProps) {
  const [modalState, setModalState] = useState<ModalState>({ open: false });
  const [confirmDeleteRateId, setConfirmDeleteRateId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const totalWidth = 280 + months.length * 80;
  const currentMonthKey = months.find(m => m.isCurrentMonth)?.month_key ?? '';

  const handleSupplierDelete = async (rateId: number) => {
    setDeleting(true);
    try {
      await deleteAirRateAction(rateId);
      setConfirmDeleteRateId(null);
      onRatesChanged();
    } finally {
      setDeleting(false);
    }
  };

  const supplierEntries = Object.entries(detail.rates_by_supplier ?? {});
  const supplierRows = supplierEntries
    .filter(([key]) => key !== 'null')
    .sort(([idA, ratesA], [idB, ratesB]) => {
      const latestA = (ratesA as AirRate[]).map(r => r.effective_from).filter(Boolean).sort().at(-1) ?? '';
      const latestB = (ratesB as AirRate[]).map(r => r.effective_from).filter(Boolean).sort().at(-1) ?? '';
      if (latestB > latestA) return 1;
      if (latestB < latestA) return -1;
      return (companiesMap[idA] ?? idA).localeCompare(companiesMap[idB] ?? idB);
    });

  const isLatestRateId = (rateId: number): boolean => {
    return supplierRows.some(([, rawRates]) => (rawRates as AirRate[])[0]?.id === rateId);
  };

  return (
    <>
      <div>
        {/* Supplier Costs divider */}
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
        {supplierRows.map(([supplierId, rawRates]) => {
          const rates = rawRates as AirRate[];
          const supplierName = companiesMap[supplierId] ?? '';
          const costMapData = buildMonthMap(rates, months, currentMonthKey, 'p100_cost');
          const costSurchargesMap = buildSurchargesMap(rates, months, currentMonthKey);
          const supplierEndDateMap = buildEndDateMap(rates);
          const latestRate = rates[0];
          return (
            <div key={supplierId}>
              <div className="flex border-t border-[var(--border)]/50" style={{ minWidth: `${totalWidth}px` }}>
                <div className="w-[280px] shrink-0 px-3 py-2 flex flex-col gap-0.5">
                  <span className="text-[11px] font-medium text-[var(--text)] truncate" title={`${supplierName} (${supplierId})`}>
                    {supplierName || supplierId}
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)] font-mono">{supplierId}</span>
                  {rates.length > 0 && (
                    <div className="text-[10px] text-[var(--text-muted)]">{formatRatesRange(rates)}</div>
                  )}
                  {latestRate && (
                    <div className="flex items-center gap-1 mt-0.5">
                      {latestRate.rate_status === 'PUBLISHED' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); const effective = getEffectiveRate(rates); setModalState({ open: true, mode: 'update', initial: (effective ?? latestRate) as unknown as Record<string, unknown> }); }}
                          className="p-1 text-[var(--text-muted)] hover:text-[var(--sky)] transition-colors"
                          title="Add rate"
                        >
                          <Pencil size={12} />
                        </button>
                      )}
                      {latestRate.rate_status === 'DRAFT' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setModalState({ open: true, mode: 'edit', rateId: latestRate.id, initial: latestRate as unknown as Record<string, unknown> }); }}
                          className="p-1 text-[var(--text-muted)] hover:text-[var(--sky)] transition-colors"
                          title="Edit"
                        >
                          <Pencil size={12} />
                        </button>
                      )}
                      {confirmDeleteRateId === latestRate.id ? (
                        <span className="flex items-center gap-1 text-[10px]">
                          <span className="text-[var(--text-muted)]">Sure?</span>
                          <button onClick={() => handleSupplierDelete(latestRate.id)} disabled={deleting}
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
                    dominantRateMap={buildDominantRateMap(rates, months)}
                    onNodeClick={(rate) => setModalState({ open: true, mode: 'edit', rateId: rate.id, initial: rate as unknown as Record<string, unknown> })}
                  />
                </div>
              </div>
            </div>
          );
        })}

        {supplierRows.length === 0 && (
          <div className="px-4 py-3 text-xs text-[var(--text-muted)]" style={{ minWidth: `${totalWidth}px` }}>No supplier cost data available</div>
        )}
      </div>

      <AirRateModal
        open={modalState.open}
        mode={modalState.open ? modalState.mode : 'add-supplier'}
        rateId={modalState.open && modalState.mode === 'edit' ? modalState.rateId : undefined}
        initial={modalState.open && (modalState.mode === 'edit' || modalState.mode === 'update') ? modalState.initial : undefined}
        cardId={cardId}
        isListPrice={false}
        companiesList={companiesList}
        onSaved={onRatesChanged}
        onClose={() => setModalState({ open: false })}
        onDelete={modalState.open && modalState.mode === 'edit' ? async (rateId) => {
          await deleteAirRateAction(rateId);
          onRatesChanged();
        } : undefined}
        isLatestRate={modalState.open && modalState.mode === 'edit'
          ? isLatestRateId(modalState.rateId)
          : undefined}
      />
    </>
  );
}
