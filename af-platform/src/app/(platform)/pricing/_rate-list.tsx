'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ChevronDown, ChevronUp, Ship } from 'lucide-react';
import type { RateCard, RateCardDetail } from '@/app/actions/pricing';
import {
  fetchFCLRateCardDetailAction,
  fetchLCLRateCardDetailAction,
} from '@/app/actions/pricing';
import { useMonthBuckets, formatCompact, getAlertLevel, getDGChipStyle } from './_helpers';
import { ExpandedRatePanel } from './_expanded-panel';

function SurchargeTooltip({
  mode,
  listPrice,
  cost,
  surchargeTotal,
  currency,
}: {
  mode: 'list' | 'cost';
  listPrice: number | null;
  cost: number | null;
  surchargeTotal: number;
  currency: string | null;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const baseValue = mode === 'list' ? listPrice : cost;
  const label = mode === 'list' ? 'Freight' : 'Cost';
  return (
    <span
      ref={ref}
      className="inline-flex items-start"
      onMouseEnter={() => {
        const rect = ref.current?.getBoundingClientRect();
        if (rect) setCoords({ top: rect.top, left: rect.left + rect.width / 2 });
        setVisible(true);
      }}
      onMouseLeave={() => { setVisible(false); setCoords(null); }}
    >
      <sup className="text-[8px] text-[var(--sky)] font-bold ml-0.5 cursor-help">*</sup>
      {visible && coords && (
        <div
          style={{
            position: 'fixed',
            top: coords.top - 8,
            left: coords.left,
            transform: 'translate(-50%, -100%)',
            zIndex: 9999,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
          className="bg-white border border-[var(--border)] rounded shadow-lg p-2 min-w-[140px] text-left"
        >
          <div className="text-[10px] text-[var(--text-muted)] font-semibold mb-1">Surcharge breakdown</div>
          {baseValue != null && (
            <div className="flex justify-between gap-3 text-[10px]">
              <span className="text-[var(--text-muted)]">{label}</span>
              <span className="font-medium">{baseValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
            </div>
          )}
          <div className="flex justify-between gap-3 text-[10px] border-t border-[var(--border)] mt-1 pt-1">
            <span className="text-[var(--text-muted)]">Surcharges</span>
            <span className="font-medium text-amber-600">+{surchargeTotal.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
          </div>
          <div className="flex justify-between gap-3 text-[10px] font-semibold mt-0.5">
            <span>Total</span>
            <span>{((baseValue ?? 0) + surchargeTotal).toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
          </div>
          {currency && <div className="text-[9px] text-[var(--text-muted)] mt-1">{currency}</div>}
        </div>
      )}
    </span>
  );
}

export function TimeSeriesRateList({
  cards,
  loading,
  showContainer,
  portsMap,
  mode,
  companiesMap,
  onCardsRefresh,
}: {
  cards: RateCard[];
  loading: boolean;
  showContainer: boolean;
  portsMap: Record<string, { name: string; country_name: string }>;
  mode: 'fcl' | 'lcl';
  companiesMap: Record<string, string>;
  onCardsRefresh: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [historicalCount, setHistoricalCount] = useState(6);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedDetail, setExpandedDetail] = useState<RateCardDetail | null>(null);
  const [expandLoading, setExpandLoading] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (width === 0) return;
      const available = width - 220;
      const historical = Math.min(9, Math.max(1, Math.floor((available - 240) / 80)));
      setHistoricalCount(historical);
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const months = useMonthBuckets(historicalCount);
  const totalWidth = 220 + months.length * 80;

  const companiesList = useMemo(() =>
    Object.entries(companiesMap).map(([id, name]) => ({ company_id: id, name })),
    [companiesMap]);

  const handleRefresh = useCallback(async (cardId: number) => {
    setExpandedDetail(null);
    setExpandLoading(true);
    const fetchAction = mode === 'fcl' ? fetchFCLRateCardDetailAction : fetchLCLRateCardDetailAction;
    const result = await fetchAction(cardId);
    if (result.success) setExpandedDetail(result.data);
    setExpandLoading(false);
    onCardsRefresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const handleExpand = async (cardId: number) => {
    if (expandedId === cardId) {
      setExpandedId(null);
      setExpandedDetail(null);
      return;
    }
    setExpandedId(cardId);
    setExpandedDetail(null);
    setExpandLoading(true);
    const action = mode === 'fcl' ? fetchFCLRateCardDetailAction : fetchLCLRateCardDetailAction;
    const result = await action(cardId);
    if (result.success) setExpandedDetail(result.data);
    setExpandLoading(false);
  };

  if (loading) {
    return (
      <div ref={containerRef} className="bg-white rounded-xl border border-[var(--border)] overflow-hidden">
        <div className="overflow-x-auto">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex border-b border-[var(--border)] last:border-b-0" style={{ minWidth: `${totalWidth}px` }}>
              <div className="w-[220px] shrink-0 p-3 space-y-2">
                <div className="h-4 w-16 bg-[var(--surface)] rounded animate-pulse" />
                <div className="h-3 w-28 bg-[var(--surface)] rounded animate-pulse" />
                <div className="h-3 w-20 bg-[var(--surface)] rounded animate-pulse" />
              </div>
              <div className="flex flex-1">
                {months.map(m => (
                  <div key={m.month_key} className="w-[80px] shrink-0 space-y-1.5 px-1 py-3">
                    <div className="h-4 bg-[var(--surface)] rounded animate-pulse" />
                    <div className="h-3 bg-[var(--surface)] rounded animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div ref={containerRef} className="bg-white rounded-xl border border-[var(--border)] py-12 flex flex-col items-center gap-3 text-[var(--text-muted)]">
        <Ship className="w-8 h-8 opacity-40" />
        <p className="text-sm">No rate cards found</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="bg-white rounded-xl border border-[var(--border)] overflow-hidden flex flex-col"
    >
      {/* Frozen header — never scrolls vertically */}
      <div className="overflow-x-auto shrink-0 border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="flex" style={{ minWidth: `${totalWidth}px` }}>
          <div className="w-[220px] shrink-0 px-3 py-2">
            <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Rate Card</span>
          </div>
          <div className="flex flex-1">
            {months.map(m => (
              <div
                key={m.month_key}
                className={`w-[80px] shrink-0 px-1 py-2 text-center text-[10px] font-semibold uppercase tracking-wide ${
                  m.isCurrentMonth ? 'text-[var(--sky)] bg-[var(--sky-mist)]/50' : 'text-[var(--text-muted)]'
                }`}
              >
                {m.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Scrollable body — rows scroll vertically and horizontally */}
      <div className="overflow-auto flex-1">
        <div style={{ minWidth: `${totalWidth}px` }}>
        {cards.map(card => {
          const dest = portsMap[card.destination_port_code];
          const ts = card.time_series ?? [];
          const drafts = card.pending_draft_count ?? 0;
          const tsMap = new Map(ts.map(t => [t.month_key, t]));
          const isExpanded = expandedId === card.id;
          const alertLevel = getAlertLevel(card.time_series, card.latest_cost_from, card.latest_list_price_from);
          const dgCode = (card.dg_class_code ?? '').toUpperCase();
          const isGenDG = dgCode === 'GEN' || dgCode === 'GENERAL' || dgCode === 'NDG' || !dgCode;

          return (
            <div key={card.id}>
              <div
                className={`flex border-b border-[var(--border)] cursor-pointer transition-colors border-l-2 ${
                  alertLevel === 'cost_exceeds_price'
                    ? 'bg-red-50 hover:bg-red-100/70'
                    : alertLevel === 'no_list_price'
                    ? 'bg-amber-50 hover:bg-amber-100/70'
                    : alertLevel === 'price_review_needed'
                    ? 'bg-yellow-50 hover:bg-yellow-100/70'
                    : isExpanded
                    ? 'bg-[var(--sky-mist)]/20'
                    : 'hover:bg-[var(--sky-mist)]/10'
                } ${
                  isExpanded
                    ? 'border-l-[var(--sky)]'
                    : alertLevel === 'cost_exceeds_price'
                    ? 'border-l-red-400'
                    : alertLevel === 'no_list_price'
                    ? 'border-l-amber-400'
                    : alertLevel === 'price_review_needed'
                    ? 'border-l-yellow-400'
                    : 'border-l-transparent'
                }`}
                style={{ minWidth: `${totalWidth}px` }}
                onClick={() => handleExpand(card.id)}
              >
                {/* Left identity panel */}
                <div className="w-[220px] shrink-0 px-3 py-2.5 flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5">
                    {isExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                    )}
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${card.is_active ? 'bg-emerald-500' : 'bg-red-400'}`} />
                    <span className="text-sm font-semibold text-[var(--text)] truncate">{card.destination_port_code}</span>
                  </div>
                  {dest && (
                    <span className="text-[11px] text-[var(--text-muted)] truncate pl-5">{dest.name}{dest.country_name ? `, ${dest.country_name}` : ''}</span>
                  )}
                  <div className="flex items-center gap-1.5 pl-5 mt-0.5 flex-wrap">
                    {showContainer && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                        {card.container_size ?? ''}{card.container_type ? ` ${card.container_type}` : ''}
                      </span>
                    )}
                    {showContainer ? (
                      !isGenDG && card.dg_class_code && (
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${getDGChipStyle(card.dg_class_code)}`}
                          title={card.dg_class_code}
                        >
                          {card.dg_class_code}
                        </span>
                      )
                    ) : (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${getDGChipStyle(card.dg_class_code ?? '')}`}
                        title={card.dg_class_code ?? ''}
                      >
                        {card.dg_class_code}
                      </span>
                    )}
                    {card.terminal_name && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 font-medium"
                        title={card.terminal_id ?? ''}
                      >
                        {card.terminal_name}
                      </span>
                    )}
                    {drafts > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 font-medium">
                        {drafts} draft
                      </span>
                    )}
                    {alertLevel === 'cost_exceeds_price' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-200 text-red-800 font-semibold">
                        Cost exceeds price
                      </span>
                    )}
                    {alertLevel === 'no_list_price' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-200 text-amber-800 font-semibold">
                        No list price
                      </span>
                    )}
                    {alertLevel === 'price_review_needed' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-200 text-yellow-800 font-semibold">
                        Price review needed
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: per-column cell grid */}
                <div className="flex flex-1">
                  {months.map(m => {
                    const bucket = tsMap.get(m.month_key);
                    const hasData = bucket && (bucket.list_price != null || bucket.cost != null);
                    const isDraft = bucket?.rate_status === 'DRAFT';
                    const cellAlert = m.isCurrentMonth ? alertLevel : null;

                    return (
                      <div
                        key={m.month_key}
                        className={`w-[80px] shrink-0 px-1 py-2.5 text-center ${
                          m.isCurrentMonth && !cellAlert ? 'bg-[var(--sky-mist)]/40' : ''
                        }`}
                      >
                        {hasData ? (
                          <>
                            <div className={`text-xs font-medium flex items-center justify-center gap-0 ${
                              isDraft ? 'text-amber-600' : cellAlert === 'cost_exceeds_price' ? 'text-red-700 font-semibold' : cellAlert === 'no_list_price' ? 'text-amber-700 font-semibold' : 'text-[var(--text)]'
                            }`}>
                              {formatCompact((bucket.list_price ?? 0) + (bucket.list_surcharge_total ?? bucket.surcharge_total ?? 0))}
                              {(bucket.list_surcharge_total ?? bucket.surcharge_total ?? 0) > 0 && (
                                <SurchargeTooltip
                                  mode="list"
                                  listPrice={bucket.list_price}
                                  cost={bucket.cost}
                                  surchargeTotal={bucket.list_surcharge_total ?? bucket.surcharge_total ?? 0}
                                  currency={bucket.currency}
                                />
                              )}
                            </div>
                            <div className="text-[10px] text-[var(--text-muted)] flex items-center justify-center gap-0">
                              {formatCompact((bucket.cost ?? 0) + (bucket.cost_surcharge_total ?? bucket.surcharge_total ?? 0))}
                              {(bucket.cost_surcharge_total ?? bucket.surcharge_total ?? 0) > 0 && (
                                <SurchargeTooltip
                                  mode="cost"
                                  listPrice={bucket.list_price}
                                  cost={bucket.cost}
                                  surchargeTotal={bucket.cost_surcharge_total ?? bucket.surcharge_total ?? 0}
                                  currency={bucket.currency}
                                />
                              )}
                            </div>
                            {bucket.currency && (
                              <div className="text-[9px] text-[var(--text-muted)]/60 text-center mt-0.5">
                                {bucket.currency}
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="text-xs text-[var(--text-muted)]/40">—</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Expanded panel */}
              {isExpanded && (
                <div className="border-b-2 border-[var(--border)] bg-slate-50/80">
                  {expandLoading || !expandedDetail ? (
                    <div className="px-4 py-3 flex items-center gap-2 text-xs text-[var(--text-muted)]" style={{ minWidth: `${totalWidth}px` }}>
                      <div className="w-3 h-3 border border-[var(--text-muted)] border-t-transparent rounded-full animate-spin" />
                      Loading supplier rates…
                    </div>
                  ) : (
                    <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                      <ExpandedRatePanel
                        detail={expandedDetail}
                        months={months}
                        companiesMap={companiesMap}
                        totalWidth={totalWidth}
                        cardMode={mode}
                        cardId={card.id}
                        companiesList={companiesList}
                        onRatesChanged={() => handleRefresh(card.id)}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}
