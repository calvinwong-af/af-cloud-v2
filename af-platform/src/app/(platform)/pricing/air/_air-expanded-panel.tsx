'use client';

import { useState } from 'react';
import type { AirRateCard, AirRate, SurchargeItem, RateDetail } from '@/app/actions/pricing';
import {
  updateAirRateAction,
  deleteAirRateAction,
} from '@/app/actions/pricing';
import { useMonthBuckets, formatDate } from '../_helpers';
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

type PanelMode =
  | { type: 'view' }
  | { type: 'terminate'; rateId: number };

interface AirExpandedPanelProps {
  detail: AirRateCard;
  companiesMap: Record<string, string>;
  cardId: number;
  companiesList: { company_id: string; name: string }[];
  onRatesChanged: () => void;
}

export function AirExpandedPanel({
  detail,
  companiesMap,
  cardId,
  companiesList,
  onRatesChanged,
}: AirExpandedPanelProps) {
  const [panelMode, setPanelMode] = useState<PanelMode>({ type: 'view' });
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [modalState, setModalState] = useState<ModalState>({ open: false });
  const [formTerminateDate, setFormTerminateDate] = useState('');

  const months = useMonthBuckets(6);
  const totalWidth = 220 + months.length * 80;

  const handleTerminate = async () => {
    if (panelMode.type !== 'terminate' || !formTerminateDate) return;
    setSaving(true);
    try {
      await updateAirRateAction(panelMode.rateId, { effective_to: formTerminateDate });
      setFormTerminateDate('');
      setPanelMode({ type: 'view' });
      onRatesChanged();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (rateId: number) => {
    setSaving(true);
    try {
      await deleteAirRateAction(rateId);
      setConfirmDeleteId(null);
      onRatesChanged();
    } finally {
      setSaving(false);
    }
  };

  const currentMonthKey = months.find(m => m.isCurrentMonth)?.month_key ?? '';

  const formatRatesRange = (rates: AirRate[]): string => {
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
  };

  const getEffectiveRate = (rates: AirRate[]): AirRate | undefined => {
    const today = new Date().toISOString().slice(0, 10);
    return rates.find(r =>
      r.rate_status === 'PUBLISHED' &&
      (r.effective_from ?? '') <= today &&
      (r.effective_to == null || r.effective_to >= today)
    );
  };

  const getDominantRate = (sorted: AirRate[], monthKey: string, monthStart: string): AirRate | null => {
    const upperBound = monthStart;
    const dominantRate = sorted.find(r => (r.effective_from ?? '') <= upperBound) ?? null;
    if (!dominantRate) return null;
    const effToMonth = dominantRate.effective_to
      ? dominantRate.effective_to.substring(0, 7)
      : null;
    if (effToMonth !== null && effToMonth < monthKey) return null;
    return dominantRate;
  };

  const buildMonthMap = (
    rates: AirRate[],
    valueKey: 'p100_list_price' | 'p100_cost',
  ): Map<string, { value: number | null; isDraft: boolean }> => {
    const sorted = [...rates].sort(
      (a, b) => (b.effective_from ?? '').localeCompare(a.effective_from ?? ''),
    );
    const result = new Map<string, { value: number | null; isDraft: boolean }>();
    for (const m of months) {
      const monthStart = `${m.month_key}-01`;
      const isFuture = m.month_key > currentMonthKey;

      if (isFuture) {
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

  const buildSurchargesMap = (rates: AirRate[]): Map<string, SurchargeItem[] | null> => {
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

  const buildEndDateMap = (rates: AirRate[]): Map<string, RateDetail> => {
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
  };

  const buildStartDateMap = (rates: AirRate[]): Map<string, RateDetail> => {
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
  };

  const priceRefRates = (detail.rates_by_supplier?.['null'] ?? []) as AirRate[];
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

  const priceRefMap = buildMonthMap(priceRefRates, 'p100_list_price');
  const priceRefSurchargesMap = buildSurchargesMap(priceRefRates);
  const priceRefEndDateMap = buildEndDateMap(priceRefRates);
  const latestPriceRef = priceRefRates[0] ?? null;

  const btnClass = "text-[10px] px-1.5 py-0.5 rounded border border-[var(--border)] hover:bg-[var(--surface)] transition-colors";
  const dangerBtnClass = "text-[10px] px-1.5 py-0.5 rounded border border-red-200 text-red-600 hover:bg-red-50 transition-colors";
  const inputClass = "h-7 px-2 text-xs rounded border border-[var(--border)] bg-white text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--sky)] focus:border-[var(--sky)]";

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
            {!latestPriceRef && panelMode.type === 'view' && (
              <button
                onClick={() => setModalState({ open: true, mode: 'add-list-price' })}
                className="text-[10px] px-2 py-0.5 rounded border border-dashed border-[var(--sky)]/50 text-[var(--sky)] hover:bg-[var(--sky-mist)]/30 transition-colors mt-0.5 self-start"
              >
                + Set List Price
              </button>
            )}
            {latestPriceRef && panelMode.type === 'view' && (
              <div className="flex gap-1 mt-0.5">
                {latestPriceRef.rate_status === 'PUBLISHED' && (
                  <>
                    <button onClick={() => {
                        const effective = getEffectiveRate(priceRefRates);
                        setModalState({ open: true, mode: 'update', initial: (effective ?? latestPriceRef) as unknown as Record<string, unknown> });
                      }}
                      className={btnClass}>Update</button>
                    <button onClick={() => setModalState({ open: true, mode: 'edit', rateId: latestPriceRef.id, initial: latestPriceRef as unknown as Record<string, unknown> })}
                      className={btnClass}>Edit</button>
                    <button onClick={() => { setFormTerminateDate(''); setPanelMode({ type: 'terminate', rateId: latestPriceRef.id }); }}
                      className={btnClass}>Set end date</button>
                  </>
                )}
                {latestPriceRef.rate_status === 'DRAFT' && (
                  <>
                    <button onClick={() => setModalState({ open: true, mode: 'edit', rateId: latestPriceRef.id, initial: latestPriceRef as unknown as Record<string, unknown> })}
                      className={btnClass}>Edit</button>
                    {confirmDeleteId === latestPriceRef.id ? (
                      <span className="text-[10px] text-red-600 flex items-center gap-1">
                        Sure? <button onClick={() => handleDelete(latestPriceRef.id)} className={dangerBtnClass} disabled={saving}>Yes</button>
                        <button onClick={() => setConfirmDeleteId(null)} className={btnClass}>No</button>
                      </span>
                    ) : (
                      <button onClick={() => setConfirmDeleteId(latestPriceRef.id)} className={dangerBtnClass}>Delete</button>
                    )}
                  </>
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
              onNodeClick={(rate) => setModalState({ open: true, mode: 'edit', rateId: rate.id, initial: rate as unknown as Record<string, unknown> })}
            />
          </div>
        </div>
        {panelMode.type === 'terminate' && panelMode.rateId === latestPriceRef?.id && (
          <div className="px-3 py-3 border-t border-[var(--border)] bg-amber-50/50" style={{ minWidth: `${totalWidth}px` }}>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-medium text-[var(--text)]">Set end date for rate #{panelMode.rateId}</span>
              <input type="date" value={formTerminateDate} onChange={e => setFormTerminateDate(e.target.value)} className={inputClass} />
              <button onClick={handleTerminate} disabled={saving || !formTerminateDate}
                className="h-7 px-3 text-xs rounded bg-[var(--sky)] text-white hover:bg-[var(--sky)]/90 disabled:opacity-50">Save</button>
              <button onClick={() => setPanelMode({ type: 'view' })}
                className="h-7 px-3 text-xs rounded border border-[var(--border)] hover:bg-[var(--surface)]">Cancel</button>
            </div>
          </div>
        )}

        {/* Supplier Costs divider */}
        <div className="px-3 py-1 bg-slate-100/80 border-y border-[var(--border)]/60 flex items-center justify-between" style={{ minWidth: `${totalWidth}px` }}>
          <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">Supplier Costs</span>
          {panelMode.type === 'view' && (
            <button
              onClick={() => setModalState({ open: true, mode: 'add-supplier' })}
              className="text-[10px] px-2 py-0.5 rounded border border-dashed border-[var(--sky)]/50 text-[var(--sky)] hover:bg-[var(--sky-mist)]/30 transition-colors"
            >
              + Supplier Rate
            </button>
          )}
        </div>

        {/* Supplier rows — sparkline per row */}
        {supplierRows.map(([supplierId, rawRates]) => {
          const rates = rawRates as AirRate[];
          const supplierName = companiesMap[supplierId] ?? '';
          const costMapData = buildMonthMap(rates, 'p100_cost');
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
                  {latestRate && panelMode.type === 'view' && (
                    <div className="flex gap-1 mt-0.5">
                      {latestRate.rate_status === 'PUBLISHED' && (
                        <>
                          <button onClick={() => {
                              const effective = getEffectiveRate(rates);
                              setModalState({ open: true, mode: 'update', initial: (effective ?? latestRate) as unknown as Record<string, unknown> });
                            }}
                            className={btnClass}>Update</button>
                          <button onClick={() => setModalState({ open: true, mode: 'edit', rateId: latestRate.id, initial: latestRate as unknown as Record<string, unknown> })}
                            className={btnClass}>Edit</button>
                          <button onClick={() => { setFormTerminateDate(''); setPanelMode({ type: 'terminate', rateId: latestRate.id }); }}
                            className={btnClass}>Set end date</button>
                        </>
                      )}
                      {latestRate.rate_status === 'DRAFT' && (
                        <>
                          <button onClick={() => setModalState({ open: true, mode: 'edit', rateId: latestRate.id, initial: latestRate as unknown as Record<string, unknown> })}
                            className={btnClass}>Edit</button>
                          {confirmDeleteId === latestRate.id ? (
                            <span className="text-[10px] text-red-600 flex items-center gap-1">
                              Sure? <button onClick={() => handleDelete(latestRate.id)} className={dangerBtnClass} disabled={saving}>Yes</button>
                              <button onClick={() => setConfirmDeleteId(null)} className={btnClass}>No</button>
                            </span>
                          ) : (
                            <button onClick={() => setConfirmDeleteId(latestRate.id)} className={dangerBtnClass}>Delete</button>
                          )}
                        </>
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
                    onNodeClick={(rate) => setModalState({ open: true, mode: 'edit', rateId: rate.id, initial: rate as unknown as Record<string, unknown> })}
                  />
                </div>
              </div>
              {panelMode.type === 'terminate' && panelMode.rateId === latestRate?.id && (
                <div className="px-3 py-3 border-t border-[var(--border)] bg-amber-50/50" style={{ minWidth: `${totalWidth}px` }}>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs font-medium text-[var(--text)]">Set end date for rate #{panelMode.rateId}</span>
                    <input type="date" value={formTerminateDate} onChange={e => setFormTerminateDate(e.target.value)} className={inputClass} />
                    <button onClick={handleTerminate} disabled={saving || !formTerminateDate}
                      className="h-7 px-3 text-xs rounded bg-[var(--sky)] text-white hover:bg-[var(--sky)]/90 disabled:opacity-50">Save</button>
                    <button onClick={() => setPanelMode({ type: 'view' })}
                      className="h-7 px-3 text-xs rounded border border-[var(--border)] hover:bg-[var(--surface)]">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {supplierRows.length === 0 && priceRefRates.length === 0 && (
          <div className="px-4 py-3 text-xs text-[var(--text-muted)]" style={{ minWidth: `${totalWidth}px` }}>No rate data available</div>
        )}
      </div>

      <AirRateModal
        open={modalState.open}
        mode={modalState.open ? modalState.mode : 'add-list-price'}
        rateId={modalState.open && modalState.mode === 'edit' ? modalState.rateId : undefined}
        initial={modalState.open && (modalState.mode === 'edit' || modalState.mode === 'update') ? modalState.initial : undefined}
        cardId={cardId}
        companiesList={companiesList}
        onSaved={onRatesChanged}
        onClose={() => setModalState({ open: false })}
      />
    </>
  );
}
