'use client';

import { useState, useEffect } from 'react';
import type { MonthBucket } from '../_types';
import type { HaulageRateCard, HaulageRate, SurchargeItem, RateDetail, FafPortRate, HaulageFafRate } from '@/app/actions/pricing';
import {
  updateHaulageRateCardAction,
  deleteHaulageRateAction,
  fetchHaulageFafRatesAction,
} from '@/app/actions/pricing';
import { Settings2 } from 'lucide-react';
import { formatDate, formatCompact } from '../_helpers';
import { CostSparkline } from '../_sparkline';
import { HaulageRateModal } from './_haulage-rate-modal';
import { DgfManageDialog } from './_depot-gate-fee-modal';

const MIGRATION_FLOOR = '2024-01-01';

type ModalState =
  | { open: false }
  | { open: true; mode: 'add-list-price' }
  | { open: true; mode: 'add-supplier' }
  | { open: true; mode: 'edit'; rateId: number; initial: Record<string, unknown> }
  | { open: true; mode: 'update'; initial: Record<string, unknown> };

interface HaulageExpandedPanelProps {
  detail: HaulageRateCard;
  months: MonthBucket[];
  companiesMap: Record<string, string>;
  totalWidth: number;
  cardId: number;
  companiesList: { company_id: string; name: string }[];
  onRatesChanged: () => void;
}

type SparklineRate = {
  id: number;
  effective_from: string | null;
  effective_to: string | null;
  rate_status: string;
  list_price: number | null;
  cost: number | null;
  surcharges: SurchargeItem[] | null;
  side_loader_surcharge: number | null;
};

export function HaulageExpandedPanel({
  detail,
  months,
  companiesMap,
  totalWidth,
  cardId,
  companiesList,
  onRatesChanged,
}: HaulageExpandedPanelProps) {
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [modalState, setModalState] = useState<ModalState>({ open: false });

  // FAF state — maps supplier_id → faf_percent
  const [fafMap, setFafMap] = useState<Record<string, number | null>>({});

  // Fetch FAF percent for each supplier
  useEffect(() => {
    const supplierIds = Object.keys(detail.rates_by_supplier ?? {}).filter(k => k !== 'null');
    if (supplierIds.length === 0) return;
    const today = new Date().toISOString().slice(0, 10);
    for (const sid of supplierIds) {
      fetchHaulageFafRatesAction(sid).then(r => {
        if (!r?.success) return;
        const latest = r.data.find((row: HaulageFafRate) =>
          row.rate_status === 'PUBLISHED' &&
          row.effective_from <= today &&
          (row.effective_to === null || row.effective_to >= today)
        );
        if (!latest) return;
        const portRates: FafPortRate[] = latest.port_rates ?? [];
        const match = portRates.find(pr =>
          pr.port_un_code === detail.port_un_code &&
          (pr.container_size === detail.container_size || pr.container_size === 'wildcard')
        );
        if (match) {
          setFafMap(prev => ({ ...prev, [sid]: match.faf_percent }));
        }
      });
    }
  }, [detail.port_un_code, detail.container_size, detail.rates_by_supplier]);

  const handleRateDelete = async (rateId: number) => {
    setSaving(true);
    try {
      await deleteHaulageRateAction(rateId);
      setConfirmDeleteId(null);
      onRatesChanged();
    } finally {
      setSaving(false);
    }
  };

  const currentMonthKey = months.find(m => m.isCurrentMonth)?.month_key ?? '';

  const getLatestEffective = (rates: HaulageRate[]): string | null => {
    return rates.map(r => r.effective_from).filter(Boolean).sort().at(-1) ?? null;
  };

  const formatRatesRange = (rates: HaulageRate[]): string => {
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

  const getEffectiveRate = (rates: HaulageRate[]): HaulageRate | undefined => {
    const today = new Date().toISOString().slice(0, 10);
    return rates.find(r =>
      r.rate_status === 'PUBLISHED' &&
      (r.effective_from ?? '') <= today &&
      (r.effective_to == null || r.effective_to >= today)
    );
  };

  const getDominantRate = (sorted: SparklineRate[], monthStart: string): SparklineRate | null => {
    const dominantRate = sorted.find(r => (r.effective_from ?? '') <= monthStart) ?? null;
    if (!dominantRate) return null;
    const effTo = dominantRate.effective_to ?? null;
    if (effTo !== null && effTo < monthStart) return null;
    return dominantRate;
  };

  const buildMonthMap = (
    rates: HaulageRate[],
    valueKey: 'list_price' | 'cost',
  ): Map<string, { value: number | null; isDraft: boolean }> => {
    const sorted = [...rates].sort(
      (a, b) => (b.effective_from ?? '').localeCompare(a.effective_from ?? ''),
    ) as SparklineRate[];
    const result = new Map<string, { value: number | null; isDraft: boolean }>();
    for (const m of months) {
      const monthStart = `${m.month_key}-01`;
      const isFuture = m.month_key > currentMonthKey;

      if (isFuture) {
        const exactRate = sorted.find(r => (r.effective_from ?? '').substring(0, 7) === m.month_key) ?? null;
        if (exactRate && (exactRate.effective_to === null || exactRate.effective_to >= monthStart)) {
          result.set(m.month_key, { value: exactRate[valueKey] ?? null, isDraft: exactRate.rate_status === 'DRAFT' });
        } else {
          const dominant = getDominantRate(sorted, monthStart);
          result.set(m.month_key, dominant
            ? { value: dominant[valueKey] ?? null, isDraft: dominant.rate_status === 'DRAFT' }
            : { value: null, isDraft: false }
          );
        }
        continue;
      }

      const dominant = getDominantRate(sorted, monthStart);
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

  const buildSurchargesMap = (rates: HaulageRate[]): Map<string, SurchargeItem[] | null> => {
    const sorted = [...rates].sort(
      (a, b) => (b.effective_from ?? '').localeCompare(a.effective_from ?? ''),
    ) as SparklineRate[];
    const result = new Map<string, SurchargeItem[] | null>();
    for (const m of months) {
      const monthStart = `${m.month_key}-01`;
      const isFuture = m.month_key > currentMonthKey;

      if (isFuture) {
        const exactRate = sorted.find(r => (r.effective_from ?? '').substring(0, 7) === m.month_key) ?? null;
        if (exactRate && (exactRate.effective_to === null || exactRate.effective_to >= monthStart)) {
          result.set(m.month_key, exactRate.surcharges ?? null);
        } else {
          const dominant = getDominantRate(sorted, monthStart);
          result.set(m.month_key, dominant?.surcharges ?? null);
        }
        continue;
      }

      const dominant = getDominantRate(sorted, monthStart);
      result.set(m.month_key, dominant?.surcharges ?? null);
    }
    return result;
  };

  const buildEndDateMap = (rates: HaulageRate[]): Map<string, RateDetail> => {
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

  const buildStartDateMap = (rates: HaulageRate[]): Map<string, RateDetail> => {
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

  const buildDominantRateMap = (rates: HaulageRate[]): Map<string, RateDetail> => {
    const sorted = [...rates].sort(
      (a, b) => (b.effective_from ?? '').localeCompare(a.effective_from ?? ''),
    ) as SparklineRate[];
    const map = new Map<string, RateDetail>();
    for (const m of months) {
      const monthStart = `${m.month_key}-01`;
      const dominant = getDominantRate(sorted, monthStart);
      if (dominant) map.set(m.month_key, dominant as unknown as RateDetail);
    }
    return map;
  };

  const priceRefRates = (detail.rates_by_supplier?.['null'] ?? []) as HaulageRate[];
  const supplierEntries = Object.entries(detail.rates_by_supplier ?? {});
  const supplierRows = supplierEntries
    .filter(([key]) => key !== 'null')
    .sort(([idA, ratesA], [idB, ratesB]) => {
      const latestA = getLatestEffective(ratesA as HaulageRate[]) ?? '';
      const latestB = getLatestEffective(ratesB as HaulageRate[]) ?? '';
      if (latestB > latestA) return 1;
      if (latestB < latestA) return -1;
      const nameA = companiesMap[idA] ?? idA;
      const nameB = companiesMap[idB] ?? idB;
      return nameA.localeCompare(nameB);
    });

  const isLatestRateId = (rateId: number): boolean => {
    if (priceRefRates[0]?.id === rateId) return true;
    return supplierRows.some(([, rawRates]) => (rawRates as HaulageRate[])[0]?.id === rateId);
  };

  const priceRefMap = buildMonthMap(priceRefRates, 'list_price');
  const priceRefSurchargesMap = buildSurchargesMap(priceRefRates);
  const priceRefEndDateMap = buildEndDateMap(priceRefRates);
  const latestPriceRef = priceRefRates[0] ?? null;

  // Build list price surcharges from best supplier's cost surcharges
  const bestSupplierEntry = supplierRows[0];
  const listPriceSurchargesForSparkline: Map<string, SurchargeItem[] | null> = (() => {
    if (!bestSupplierEntry) return priceRefSurchargesMap;
    const [bestSupplierId, bestSupplierRates] = bestSupplierEntry;
    const bestRates = bestSupplierRates as HaulageRate[];
    const bestCostMapData = buildMonthMap(bestRates, 'cost');
    const bestFafPercent = fafMap[bestSupplierId] ?? null;
    const baseSurchargesMap = buildSurchargesMap(bestRates);
    if (bestFafPercent == null) return baseSurchargesMap;
    const result = new Map<string, SurchargeItem[] | null>();
    for (const m of months) {
      const baseSurcharges = baseSurchargesMap.get(m.month_key) ?? [];
      const dominant = bestCostMapData.get(m.month_key);
      if (dominant?.value != null) {
        const fafItem: SurchargeItem = {
          code: 'FAF',
          description: `FAF (${(bestFafPercent * 100).toFixed(1)}%)`,
          amount: Math.round(dominant.value * bestFafPercent),
        };
        result.set(m.month_key, [...baseSurcharges, fafItem]);
      } else {
        result.set(m.month_key, baseSurcharges.length > 0 ? baseSurcharges : null);
      }
    }
    return result;
  })();

  const btnClass = "text-[10px] px-1.5 py-0.5 rounded border border-[var(--border)] hover:bg-[var(--surface)] transition-colors";
  const dangerBtnClass = "text-[10px] px-1.5 py-0.5 rounded border border-red-200 text-red-600 hover:bg-red-50 transition-colors";

  return (
    <>
      <div>
        {/* Price reference row — sparkline */}
        <div className="flex" style={{ minWidth: `${totalWidth}px` }}>
          <div className="w-[280px] shrink-0 px-3 py-2 flex flex-col gap-0.5">
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
              <div className="flex gap-1 mt-0.5">
                {latestPriceRef.rate_status === 'PUBLISHED' && (
                  <>
                    <button onClick={() => {
                        const effective = getEffectiveRate(priceRefRates);
                        setModalState({ open: true, mode: 'update', initial: (effective ?? latestPriceRef) as unknown as Record<string, unknown> });
                      }}
                      className={btnClass}>Add rate</button>
                    <button onClick={() => setModalState({ open: true, mode: 'edit', rateId: latestPriceRef.id, initial: latestPriceRef as unknown as Record<string, unknown> })}
                      className={btnClass}>Edit</button>
                  </>
                )}
                {latestPriceRef.rate_status === 'DRAFT' && (
                  <button onClick={() => setModalState({ open: true, mode: 'edit', rateId: latestPriceRef.id, initial: latestPriceRef as unknown as Record<string, unknown> })}
                    className={btnClass}>Edit</button>
                )}
                {confirmDeleteId === latestPriceRef.id ? (
                  <span className="text-[10px] text-red-600 flex items-center gap-1">
                    Sure?{' '}
                    <button onClick={() => handleRateDelete(latestPriceRef.id)} className={dangerBtnClass} disabled={saving}>Yes</button>
                    <button onClick={() => setConfirmDeleteId(null)} className={btnClass}>No</button>
                  </span>
                ) : (
                  <button onClick={() => setConfirmDeleteId(latestPriceRef.id)} className={dangerBtnClass}>Delete</button>
                )}
              </div>
            )}
          </div>
          <div style={{ width: `${months.length * 80}px`, flexShrink: 0 }} className="flex items-center">
            <CostSparkline
              monthMap={priceRefMap}
              months={months}
              color="#0ea5e9"
              surchargesMap={listPriceSurchargesForSparkline}
              endDateMap={priceRefEndDateMap}
              startDateMap={buildStartDateMap(priceRefRates)}
              dominantRateMap={buildDominantRateMap(priceRefRates)}
              onNodeClick={(rate) => setModalState({ open: true, mode: 'edit', rateId: rate.id, initial: rate as unknown as Record<string, unknown> })}
            />
          </div>
        </div>
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

        {/* Supplier rows */}
        {supplierRows.map(([supplierId, rawRates]) => {
          const rates = rawRates as HaulageRate[];
          const supplierName = companiesMap[supplierId] ?? '';
          const costMapData = buildMonthMap(rates, 'cost');
          const fafPercent = fafMap[supplierId] ?? null;
          const baseSurchargesMap = buildSurchargesMap(rates);
          const costSurchargesMap = (() => {
            if (fafPercent == null) return baseSurchargesMap;
            const result = new Map<string, SurchargeItem[] | null>();
            for (const m of months) {
              const baseSurcharges = baseSurchargesMap.get(m.month_key) ?? [];
              const dominant = costMapData.get(m.month_key);
              if (dominant?.value != null) {
                const fafItem: SurchargeItem = {
                  code: 'FAF',
                  description: `FAF (${(fafPercent * 100).toFixed(1)}%)`,
                  amount: Math.round(dominant.value * fafPercent),
                };
                result.set(m.month_key, [...baseSurcharges, fafItem]);
              } else {
                result.set(m.month_key, baseSurcharges.length > 0 ? baseSurcharges : null);
              }
            }
            return result;
          })();
          const supplierEndDateMap = buildEndDateMap(rates);
          const latestRate = rates[0];
          const effectiveCost = getEffectiveRate(rates)?.cost ?? (rates[0]?.cost ?? null);
          const fafAmount = (fafPercent != null && effectiveCost != null)
            ? effectiveCost * fafPercent
            : null;
          const hasSL = latestRate && latestRate.side_loader_surcharge != null && latestRate.side_loader_surcharge > 0;
          const hasFAF = fafPercent != null && fafAmount != null;
          return (
            <div key={supplierId}>
              <div className="flex border-t border-[var(--border)]/50" style={{ minWidth: `${totalWidth}px` }}>
                <div className="w-[280px] shrink-0 px-3 py-2 flex flex-col gap-0.5">
                  <span className="text-[11px] font-medium text-[var(--text)] truncate" title={`${supplierName} (${supplierId})`}>
                    {supplierName || supplierId}
                  </span>
                  <div className="text-[9px] text-[var(--text-muted)]">
                    <span className="font-mono">{supplierId}</span>
                    {rates.length > 0 && <> · {formatRatesRange(rates)}</>}
                  </div>
                  {(hasSL || hasFAF) && (
                    <div className="flex items-center gap-1.5">
                      {hasSL && (
                        <span className="text-[9px] text-blue-600">SL +{formatCompact(latestRate.side_loader_surcharge!)}</span>
                      )}
                      {hasSL && hasFAF && <span className="text-[9px] text-[var(--text-muted)]">·</span>}
                      {hasFAF && (
                        <span className="text-[9px] text-violet-600">FAF +{formatCompact(fafAmount)} ({(fafPercent! * 100).toFixed(1)}%)</span>
                      )}
                    </div>
                  )}
                  {latestRate && (
                    <div className="flex gap-1 mt-0.5">
                      {latestRate.rate_status === 'PUBLISHED' && (
                        <>
                          <button onClick={() => {
                              const effective = getEffectiveRate(rates);
                              setModalState({ open: true, mode: 'update', initial: (effective ?? latestRate) as unknown as Record<string, unknown> });
                            }}
                            className={btnClass}>Add rate</button>
                          <button onClick={() => setModalState({ open: true, mode: 'edit', rateId: latestRate.id, initial: latestRate as unknown as Record<string, unknown> })}
                            className={btnClass}>Edit</button>
                        </>
                      )}
                      {latestRate.rate_status === 'DRAFT' && (
                        <button onClick={() => setModalState({ open: true, mode: 'edit', rateId: latestRate.id, initial: latestRate as unknown as Record<string, unknown> })}
                          className={btnClass}>Edit</button>
                      )}
                      {confirmDeleteId === latestRate.id ? (
                        <span className="text-[10px] text-red-600 flex items-center gap-1">
                          Sure?{' '}
                          <button onClick={() => handleRateDelete(latestRate.id)} className={dangerBtnClass} disabled={saving}>Yes</button>
                          <button onClick={() => setConfirmDeleteId(null)} className={btnClass}>No</button>
                        </span>
                      ) : (
                        <button onClick={() => setConfirmDeleteId(latestRate.id)} className={dangerBtnClass}>Delete</button>
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
                    onNodeClick={(rate) => setModalState({ open: true, mode: 'edit', rateId: rate.id, initial: rate as unknown as Record<string, unknown> })}
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

      <HaulageRateModal
        open={modalState.open}
        mode={modalState.open ? modalState.mode : 'add-list-price'}
        rateId={modalState.open && modalState.mode === 'edit' ? modalState.rateId : undefined}
        initial={modalState.open && (modalState.mode === 'edit' || modalState.mode === 'update') ? modalState.initial : undefined}
        cardId={cardId}
        companiesList={companiesList}
        onSaved={onRatesChanged}
        onClose={() => setModalState({ open: false })}
        onDelete={modalState.open && modalState.mode === 'edit' ? async (rateId) => {
          await deleteHaulageRateAction(rateId);
          onRatesChanged();
        } : undefined}
        isLatestRate={modalState.open && modalState.mode === 'edit'
          ? isLatestRateId(modalState.rateId)
          : undefined}
      />

    </>
  );
}

/* ---------- Haulage Rate Card Edit Modal ---------- */

const containerSizeLabel = (size: string): string => {
  const map: Record<string, string> = { '20': '20ft', '40': '40ft', '40HC': '40HC', 'wildcard': 'All Sizes' };
  return map[size] ?? size;
};

interface HaulageRateCardEditModalProps {
  open: boolean;
  cardId: number;
  initial: {
    port_un_code: string;
    area_name?: string;
    area_code?: string;
    state_name?: string | null;
    container_size: string;
    terminal_id?: string | null;
    terminal_name?: string | null;
    currency: string;
    uom: string;
    include_depot_gate_fee: boolean;
    side_loader_available: boolean;
    is_active: boolean;
    is_tariff_rate: boolean;
  };
  onSaved: () => void;
  onClose: () => void;
}

export function HaulageRateCardEditModal({ open, cardId, initial, onSaved, onClose }: HaulageRateCardEditModalProps) {
  const [currency, setCurrency] = useState(initial.currency);
  const [uom, setUom] = useState(initial.uom);
  const [includeDepotGateFee, setIncludeDepotGateFee] = useState(initial.include_depot_gate_fee);
  const [sideLoaderAvailable, setSideLoaderAvailable] = useState(initial.side_loader_available);
  const [isActive, setIsActive] = useState(initial.is_active);
  const [isTariffRate, setIsTariffRate] = useState(initial.is_tariff_rate ?? false);
  const [saving, setSaving] = useState(false);
  const [dgfManageOpen, setDgfManageOpen] = useState(false);

  useEffect(() => {
    setCurrency(initial.currency);
    setUom(initial.uom);
    setIncludeDepotGateFee(initial.include_depot_gate_fee);
    setSideLoaderAvailable(initial.side_loader_available);
    setIsActive(initial.is_active);
    setIsTariffRate(initial.is_tariff_rate ?? false);
  }, [initial.currency, initial.uom, initial.include_depot_gate_fee, initial.side_loader_available, initial.is_active, initial.is_tariff_rate]);

  if (!open) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await updateHaulageRateCardAction(cardId, {
        currency,
        uom,
        include_depot_gate_fee: includeDepotGateFee,
        side_loader_available: sideLoaderAvailable,
        is_active: isActive,
        is_tariff_rate: isTariffRate,
      });
      if (!result) return;
      if (result.success) onSaved();
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "h-8 px-2 text-xs rounded border border-[var(--border)] bg-white text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--sky)] focus:border-[var(--sky)] w-full";
  const checkboxClass = "w-3.5 h-3.5 rounded border-[var(--border)] text-[var(--sky)] focus:ring-[var(--sky)]";

  const areaLabel = initial.state_name
    ? `${initial.area_name ?? ''}, ${initial.state_name}`
    : (initial.area_name ?? `Area ${initial.area_code ?? '—'}`);

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-[380px] p-5" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-[var(--text)] mb-4">Edit Rate Card</h3>

        {/* Read-only identity */}
        <div className="space-y-1.5 mb-4 text-xs text-[var(--text-muted)]">
          <div className="flex justify-between"><span className="font-medium">Port</span><span className="text-[var(--text)]">{initial.port_un_code}</span></div>
          <div className="flex justify-between"><span className="font-medium">Area</span><span className="text-[var(--text)]">{areaLabel}</span></div>
          <div className="flex justify-between"><span className="font-medium">Container</span><span className="text-[var(--text)]">{containerSizeLabel(initial.container_size)}</span></div>
          <div className="flex justify-between"><span className="font-medium">Terminal</span><span className="text-[var(--text)]">{initial.terminal_name ?? initial.terminal_id ?? '—'}</span></div>
        </div>

        <div className="border-t border-[var(--border)] pt-3 mb-3" />

        {/* Editable fields */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <label>
            <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide font-semibold">Currency</span>
            <input type="text" value={currency} onChange={e => setCurrency(e.target.value.toUpperCase())} maxLength={3} className={inputClass} />
          </label>
          <label>
            <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide font-semibold">UOM</span>
            <select value={uom} onChange={e => setUom(e.target.value)} className={inputClass}>
              <option value="CONTAINER">CONTAINER</option>
              <option value="SET">SET</option>
              <option value="RT">RT</option>
              <option value="KG">KG</option>
              <option value="CBM">CBM</option>
              <option value="W/M">W/M</option>
            </select>
          </label>
        </div>

        <div className="flex items-center justify-between mb-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={includeDepotGateFee} onChange={e => setIncludeDepotGateFee(e.target.checked)} className={checkboxClass} />
            <span className="text-xs text-[var(--text)]">Include Depot Gate Fee</span>
          </label>
          {includeDepotGateFee && (
            <button
              type="button"
              onClick={() => setDgfManageOpen(true)}
              className="flex items-center gap-1 text-[10px] text-[var(--sky)] hover:underline"
              title="Manage Depot Gate Fee for this port"
            >
              <Settings2 className="w-3 h-3" />
              Manage DGF
            </button>
          )}
        </div>

        <label className="flex items-center gap-2 mb-3 cursor-pointer">
          <input type="checkbox" checked={sideLoaderAvailable} onChange={e => setSideLoaderAvailable(e.target.checked)} className={checkboxClass} />
          <span className="text-xs text-[var(--text)]">Side Loader Available</span>
        </label>

        <label className="flex items-center gap-2 mb-3 cursor-pointer">
          <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className={checkboxClass} />
          <span className="text-xs text-[var(--text)]">Active</span>
        </label>

        <label className="flex items-center gap-2 mb-4 cursor-pointer">
          <input type="checkbox" checked={isTariffRate} onChange={e => setIsTariffRate(e.target.checked)} className={checkboxClass} />
          <span className="text-xs text-[var(--text)]">Tariff Rate</span>
        </label>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="h-7 px-3 text-xs rounded border border-[var(--border)] hover:bg-[var(--surface)] transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="h-7 px-3 text-xs rounded bg-[var(--sky)] text-white hover:bg-[var(--sky)]/90 disabled:opacity-50 transition-colors">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
    {dgfManageOpen && (
      <DgfManageDialog
        open={dgfManageOpen}
        portUnCode={initial.port_un_code}
        terminalId={initial.terminal_id ?? null}
        onClose={() => setDgfManageOpen(false)}
      />
    )}
    </>
  );
}
