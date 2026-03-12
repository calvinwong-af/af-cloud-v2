'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { AirRateCard } from '@/app/actions/pricing';
import { fetchAirRateCardDetailAction } from '@/app/actions/pricing';
import { useMonthBuckets, formatCompact } from '../_helpers';
import type { AlertLevel } from '../_helpers';
import { AirODExpandedPanel, AirExpandedPanel } from './_air-expanded-panel';

/** Compute O/D-level alert from all cards in a group */
function getODAlertLevel(groupCards: AirRateCard[]): AlertLevel {
  if (groupCards.length === 0) return null;
  const today = new Date();
  const currentKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  const firstTs = groupCards[0].time_series ?? [];
  const firstBucket = firstTs.find(b => b.month_key === currentKey);
  const listPrice = firstBucket?.p100_list_price ?? null;
  const listSurcharge = firstBucket?.list_surcharge_total ?? 0;
  const listTotal = listPrice != null ? listPrice + listSurcharge : null;

  let bestCostTotal: number | null = null;
  for (const card of groupCards) {
    const ts = card.time_series ?? [];
    const bucket = ts.find(b => b.month_key === currentKey);
    if (bucket?.p100_cost != null) {
      const total = bucket.p100_cost + (bucket.cost_surcharge_total ?? 0);
      if (bestCostTotal === null || total < bestCostTotal) bestCostTotal = total;
    }
  }

  if (bestCostTotal != null && listTotal != null && bestCostTotal > listTotal) return 'cost_exceeds_price';
  if (listTotal != null && bestCostTotal == null) return 'no_active_cost';
  if (bestCostTotal != null && listTotal == null) return 'no_list_price';

  const latestListFrom = groupCards[0]?.latest_list_price_from ?? null;
  let latestCostFrom: string | null = null;
  for (const card of groupCards) {
    if (card.latest_cost_from && (latestCostFrom === null || card.latest_cost_from > latestCostFrom)) {
      latestCostFrom = card.latest_cost_from;
    }
  }
  if (latestCostFrom != null && latestListFrom != null && latestCostFrom > latestListFrom) {
    return 'price_review_needed';
  }

  return null;
}

type ODGroup = {
  key: string;
  origin: string;
  dest: string;
  cards: AirRateCard[];
  alert: AlertLevel;
  monthListPrices: Map<string, number | null>;
};

interface AirTimeSeriesRateListProps {
  cards: AirRateCard[];
  loading: boolean;
  portsMap: Record<string, { name: string; country_name: string }>;
  companiesMap: Record<string, string>;
  companiesList: { company_id: string; name: string }[];
  onCardsRefresh: () => void;
}

export function AirTimeSeriesRateList({
  cards,
  loading,
  companiesMap,
  companiesList,
  onCardsRefresh,
}: AirTimeSeriesRateListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [historicalCount, setHistoricalCount] = useState(6);

  // O/D expand state — clicking an O/D row fetches detail and shows list price panel
  const [expandedODKey, setExpandedODKey] = useState<string | null>(null);
  const [expandedODCardId, setExpandedODCardId] = useState<number | null>(null);
  const [expandedODDetail, setExpandedODDetail] = useState<AirRateCard | null>(null);

  // Airline sub-row expand state — clicking an airline row fetches detail for supplier costs
  const [expandedAirlineId, setExpandedAirlineId] = useState<number | null>(null);
  const [expandedAirlineDetail, setExpandedAirlineDetail] = useState<AirRateCard | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (width === 0) return;
      const available = width - 280;
      const historical = Math.min(9, Math.max(1, Math.floor((available - 240) / 80)));
      setHistoricalCount(historical);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const months = useMonthBuckets(historicalCount);
  const totalWidth = 280 + months.length * 80;

  const groups = useMemo<ODGroup[]>(() => {
    const map = new Map<string, AirRateCard[]>();
    for (const card of cards) {
      const key = `${card.origin_port_code}\u2192${card.destination_port_code}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(card);
    }
    return Array.from(map.entries()).map(([key, groupCards]) => {
      const [origin, dest] = key.split('\u2192');
      const alert = getODAlertLevel(groupCards);
      const monthListPrices = new Map<string, number | null>();
      for (const m of months) {
        let lowestList: number | null = null;
        for (const card of groupCards) {
          const bucket = (card.time_series ?? []).find(b => b.month_key === m.month_key);
          if (bucket?.p100_list_price != null) {
            const total = bucket.p100_list_price + (bucket.list_surcharge_total ?? 0);
            if (lowestList === null || total < lowestList) lowestList = total;
          }
        }
        monthListPrices.set(m.month_key, lowestList);
      }
      return { key, origin, dest, cards: groupCards, alert, monthListPrices };
    });
  }, [cards, months]);

  // Fetch detail when an O/D row is expanded
  useEffect(() => {
    if (expandedODKey == null || expandedODCardId == null) {
      setExpandedODDetail(null);
      return;
    }
    let cancelled = false;
    setExpandedODDetail(null);
    fetchAirRateCardDetailAction(expandedODCardId).then(r => {
      if (!cancelled && r?.success) setExpandedODDetail(r.data);
    });
    return () => { cancelled = true; };
  }, [expandedODKey, expandedODCardId]);

  // Fetch detail when an airline sub-row is expanded
  useEffect(() => {
    if (expandedAirlineId == null) {
      setExpandedAirlineDetail(null);
      return;
    }
    let cancelled = false;
    setExpandedAirlineDetail(null);
    fetchAirRateCardDetailAction(expandedAirlineId).then(r => {
      if (!cancelled && r?.success) setExpandedAirlineDetail(r.data);
    });
    return () => { cancelled = true; };
  }, [expandedAirlineId]);

  if (loading) {
    return (
      <div ref={containerRef} className="bg-white rounded-xl border border-[var(--border)] overflow-hidden">
        <div className="overflow-x-auto">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex border-b border-[var(--border)] last:border-b-0" style={{ minWidth: `${totalWidth}px` }}>
              <div className="w-[280px] shrink-0 p-3 space-y-2">
                <div className="h-4 w-24 bg-[var(--surface)] rounded animate-pulse" />
                <div className="h-3 w-32 bg-[var(--surface)] rounded animate-pulse" />
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
      <div ref={containerRef} className="bg-white rounded-xl border border-[var(--border)] py-12 text-center text-sm text-[var(--text-muted)]">
        No air freight rate cards found
      </div>
    );
  }

  const alertBadge = (level: AlertLevel) => {
    if (!level) return null;
    const styles: Record<string, string> = {
      cost_exceeds_price: 'bg-red-50 text-red-700 border-red-200',
      no_list_price: 'bg-amber-50 text-amber-700 border-amber-200',
      no_active_cost: 'bg-red-50 text-red-600 border-red-200',
      price_review_needed: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    };
    const labels: Record<string, string> = {
      cost_exceeds_price: 'Cost > Price',
      no_list_price: 'No list price',
      no_active_cost: 'Cost expired',
      price_review_needed: 'Price review needed',
    };
    return (
      <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-medium ${styles[level]}`}>
        {labels[level]}
      </span>
    );
  };

  const handleODClick = (group: ODGroup) => {
    const isExpanded = expandedODKey === group.key;
    if (isExpanded) {
      setExpandedODKey(null);
      setExpandedODCardId(null);
    } else {
      const cardId = group.cards[0]?.id ?? null;
      setExpandedODKey(group.key);
      setExpandedODCardId(cardId);
    }
  };

  const handleAirlineClick = (cardId: number) => {
    if (expandedAirlineId === cardId) {
      setExpandedAirlineId(null);
    } else {
      setExpandedAirlineId(cardId);
    }
  };

  return (
    <div
      ref={containerRef}
      className="bg-white rounded-xl border border-[var(--border)] overflow-hidden flex flex-col"
    >
      {/* Frozen header */}
      <div className="overflow-x-auto shrink-0 border-b border-[var(--border)] bg-[var(--surface)]/50">
        <div className="flex" style={{ minWidth: `${totalWidth}px` }}>
          <div className="w-[280px] shrink-0 px-3 py-2 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            O/D Group
          </div>
          <div className="flex flex-1">
            {months.map(m => (
              <div
                key={m.month_key}
                className={`w-[80px] shrink-0 px-1 py-2 text-center text-[10px] font-semibold uppercase tracking-wider ${
                  m.isCurrentMonth ? 'text-[var(--sky)] bg-[var(--sky-mist)]/40' : 'text-[var(--text-muted)]'
                }`}
              >
                {m.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="overflow-auto flex-1">
        <div style={{ minWidth: `${totalWidth}px` }}>
          {groups.map(group => {
            const isODExpanded = expandedODKey === group.key;
            return (
              <div key={group.key}>
                {/* O/D group header row — click to expand list price panel */}
                <div
                  className={`flex border-b border-[var(--border)] cursor-pointer hover:bg-[var(--surface)]/40 transition-colors select-none ${
                    group.alert ? 'border-l-2 border-l-amber-400' : ''
                  }`}
                  style={{ minWidth: `${totalWidth}px` }}
                  onClick={() => handleODClick(group)}
                >
                  <div className="w-[280px] shrink-0 px-3 py-2.5 flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-[var(--text)] flex items-center gap-1.5">
                        {group.origin} &rarr; {group.dest}
                        {(() => {
                          const dgCodes = Array.from(new Set(group.cards.map(c => c.dg_class_code).filter(c => c !== 'NON-DG')));
                          return dgCodes.map(code => (
                            <span key={code} className="text-[9px] px-1 py-0.5 rounded bg-orange-50 text-orange-600 border border-orange-200 font-medium">
                              {code}
                            </span>
                          ));
                        })()}
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)] mt-0.5 flex items-center gap-2">
                        <span>{group.cards.length} airline{group.cards.length !== 1 ? 's' : ''}</span>
                        {alertBadge(group.alert)}
                      </div>
                    </div>
                    {isODExpanded
                      ? <ChevronUp size={14} className="text-[var(--sky)]" />
                      : <ChevronDown size={14} className="text-[var(--text-muted)]" />}
                  </div>
                  {/* Month cells with list price */}
                  <div className="flex flex-1">
                    {months.map(m => {
                      const listPrice = group.monthListPrices.get(m.month_key);
                      return (
                        <div
                          key={m.month_key}
                          className={`w-[80px] shrink-0 px-1 py-2.5 text-center ${
                            m.isCurrentMonth ? 'bg-[var(--sky-mist)]/40' : ''
                          }`}
                        >
                          {listPrice != null ? (
                            <div className="text-xs font-medium text-[var(--text)]">
                              {formatCompact(listPrice)}
                            </div>
                          ) : (
                            <div className="text-xs text-[var(--text-muted)]/40">&mdash;</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Expanded section: list price panel + airline sub-rows */}
                {isODExpanded && (
                  <div className="border-l-2 border-l-[var(--sky)]/30">
                    {/* O/D-level list price panel */}
                    <div className="border-b border-[var(--border)] bg-blue-50/30">
                      {!expandedODDetail ? (
                        <div className="px-4 py-3 flex items-center gap-2 text-xs text-[var(--text-muted)]">
                          <div className="w-3 h-3 border border-[var(--text-muted)] border-t-transparent rounded-full animate-spin" />
                          Loading list price…
                        </div>
                      ) : (
                        <AirODExpandedPanel
                          listPriceRates={expandedODDetail.list_price_rates ?? []}
                          listPriceCardId={expandedODDetail.list_price_card_id ?? null}
                          originPortCode={group.origin}
                          destPortCode={group.dest}
                          dgClassCode={group.cards[0]?.dg_class_code ?? 'NON-DG'}
                          months={months}
                          companiesList={companiesList}
                          onRatesChanged={() => {
                            onCardsRefresh();
                            if (expandedODCardId) {
                              fetchAirRateCardDetailAction(expandedODCardId).then(r => {
                                if (r?.success) setExpandedODDetail(r.data);
                              });
                            }
                          }}
                        />
                      )}
                    </div>

                    {/* Airline sub-rows */}
                    {group.cards.map(card => {
                      const isAirlineExpanded = expandedAirlineId === card.id;
                      return (
                        <div key={card.id}>
                          <div
                            className="flex border-b border-[var(--border)]/60 bg-[var(--surface)]/20 cursor-pointer hover:bg-[var(--surface)]/50 transition-colors select-none"
                            style={{ minWidth: `${totalWidth}px` }}
                            onClick={() => handleAirlineClick(card.id)}
                          >
                            <div className="w-[280px] shrink-0 px-3 py-2 pl-6 flex items-center gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="text-[11px] font-medium text-[var(--text)]">
                                  {card.airline_code}
                                  {card.dg_class_code !== 'NON-DG' && (
                                    <span className="ml-1.5 text-[9px] px-1 py-0.5 rounded bg-orange-50 text-orange-600 border border-orange-200 font-medium">
                                      {card.dg_class_code}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-[var(--text-muted)] truncate">{card.description}</div>
                              </div>
                              {isAirlineExpanded
                                ? <ChevronUp size={12} className="text-[var(--sky)]" />
                                : <ChevronDown size={12} className="text-[var(--text-muted)]" />}
                            </div>
                            {/* Month cells — cost per airline */}
                            <div className="flex flex-1">
                              {months.map(m => {
                                const bucket = (card.time_series ?? []).find(b => b.month_key === m.month_key);
                                const cost = bucket?.p100_cost ?? null;
                                const costSurcharge = bucket?.cost_surcharge_total ?? 0;
                                const costTotal = cost != null ? cost + costSurcharge : null;
                                return (
                                  <div
                                    key={m.month_key}
                                    className={`w-[80px] shrink-0 px-1 py-2 text-center ${
                                      m.isCurrentMonth ? 'bg-[var(--sky-mist)]/40' : ''
                                    }`}
                                  >
                                    {costTotal != null ? (
                                      <div className="text-[11px] text-[var(--text-muted)]">
                                        {formatCompact(costTotal)}
                                      </div>
                                    ) : (
                                      <div className="text-[11px] text-[var(--text-muted)]/30">&mdash;</div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Airline expanded panel — supplier costs */}
                          {isAirlineExpanded && (
                            <div className="border-b border-[var(--border)] bg-slate-50/50">
                              {!expandedAirlineDetail || expandedAirlineDetail.id !== card.id ? (
                                <div className="px-4 py-3 flex items-center gap-2 text-xs text-[var(--text-muted)]">
                                  <div className="w-3 h-3 border border-[var(--text-muted)] border-t-transparent rounded-full animate-spin" />
                                  Loading supplier costs…
                                </div>
                              ) : (
                                <AirExpandedPanel
                                  detail={expandedAirlineDetail}
                                  companiesMap={companiesMap}
                                  cardId={card.id}
                                  companiesList={companiesList}
                                  months={months}
                                  onRatesChanged={() => {
                                    onCardsRefresh();
                                    fetchAirRateCardDetailAction(card.id).then(r => {
                                      if (r?.success) setExpandedAirlineDetail(r.data);
                                    });
                                  }}
                                />
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
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
