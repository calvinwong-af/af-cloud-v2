'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { AirRateCard } from '@/app/actions/pricing';
import { fetchAirRateCardDetailAction } from '@/app/actions/pricing';
import { useMonthBuckets, formatCompact } from '../_helpers';
import type { AlertLevel } from '../_helpers';
import { AirExpandedPanel } from './_air-expanded-panel';

function getAirAlertLevel(
  timeSeries: AirRateCard['time_series'],
  latestCostFrom?: string | null,
  latestListPriceFrom?: string | null,
): AlertLevel {
  if (!timeSeries) return null;
  const today = new Date();
  const currentKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const bucket = timeSeries.find(b => b.month_key === currentKey);
  if (!bucket) return null;

  const cost = bucket.p100_cost ?? null;
  const list = bucket.p100_list_price ?? null;
  const costTotal = cost != null ? cost + (bucket.cost_surcharge_total ?? 0) : null;
  const listTotal = list != null ? list + (bucket.list_surcharge_total ?? 0) : null;

  if (costTotal != null && listTotal != null && costTotal > listTotal) return 'cost_exceeds_price';
  if (listTotal != null && costTotal == null) return 'no_active_cost';
  if (costTotal != null && listTotal == null) return 'no_list_price';

  if (
    latestCostFrom != null &&
    latestListPriceFrom != null &&
    latestCostFrom > latestListPriceFrom
  ) return 'price_review_needed';

  return null;
}

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
  portsMap,
  companiesMap,
  companiesList,
  onCardsRefresh,
}: AirTimeSeriesRateListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [historicalCount, setHistoricalCount] = useState(6);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedDetail, setExpandedDetail] = useState<AirRateCard | null>(null);

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

  useEffect(() => {
    if (expandedId == null) { setExpandedDetail(null); return; }
    fetchAirRateCardDetailAction(expandedId).then(r => {
      if (r?.success) setExpandedDetail(r.data);
    });
  }, [expandedId]);

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

  return (
    <div
      ref={containerRef}
      className="bg-white rounded-xl border border-[var(--border)] overflow-hidden flex flex-col"
    >
      {/* Frozen header */}
      <div className="overflow-x-auto shrink-0 border-b border-[var(--border)] bg-[var(--surface)]/50">
        <div className="flex" style={{ minWidth: `${totalWidth}px` }}>
          <div className="w-[280px] shrink-0 px-3 py-2 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Route / Airline
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
          {cards.map(card => {
            const isExpanded = expandedId === card.id;
            const ts = card.time_series ?? [];
            const alert = getAirAlertLevel(
              ts,
              card.latest_cost_from,
              card.latest_list_price_from,
            );

            const originName = portsMap[card.origin_port_code]?.name;
            const destName = portsMap[card.destination_port_code]?.name;
            const originLabel = originName ? `${originName} (${card.origin_port_code})` : card.origin_port_code;
            const destLabel = destName ? `${destName} (${card.destination_port_code})` : card.destination_port_code;

            return (
              <div key={card.id}>
                <div
                  className={`flex border-b border-[var(--border)] hover:bg-[var(--surface)]/30 cursor-pointer transition-colors ${
                    alert ? 'border-l-2 border-l-red-400' : ''
                  }`}
                  style={{ minWidth: `${totalWidth}px` }}
                  onClick={() => setExpandedId(isExpanded ? null : card.id)}
                >
                  {/* Identity */}
                  <div className="w-[280px] shrink-0 px-3 py-2.5 flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-[var(--text)] truncate" title={`${originLabel} → ${destLabel}`}>
                        {card.origin_port_code} → {card.destination_port_code}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">
                          {card.airline_code}
                        </span>
                        {card.dg_class_code !== 'NON-DG' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-50 text-orange-600 font-medium">
                            {card.dg_class_code}
                          </span>
                        )}
                        {card.dg_class_code === 'NON-DG' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                            NON-DG
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {alertBadge(alert)}
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp size={14} className="text-[var(--text-muted)]" /> : <ChevronDown size={14} className="text-[var(--text-muted)]" />}
                  </div>

                  {/* Time series cells */}
                  <div className="flex flex-1">
                    {months.map(m => {
                      const bucket = ts.find(b => b.month_key === m.month_key);
                      const hasData = bucket && (bucket.p100_list_price != null || bucket.p100_cost != null);
                      const isDraft = bucket?.rate_status === 'DRAFT';

                      return (
                        <div
                          key={m.month_key}
                          className={`w-[80px] shrink-0 px-1 py-2.5 text-center ${
                            m.isCurrentMonth && !alert ? 'bg-[var(--sky-mist)]/40' : ''
                          }`}
                        >
                          {hasData ? (
                            <>
                              <div className={`text-xs font-medium ${
                                isDraft ? 'text-amber-600' : alert === 'cost_exceeds_price' ? 'text-red-700 font-semibold' : alert === 'no_list_price' ? 'text-amber-700 font-semibold' : alert === 'no_active_cost' ? 'text-red-600 font-semibold' : 'text-[var(--text)]'
                              }`}>
                                {bucket.p100_list_price != null
                                  ? <span className="relative">
                                      {formatCompact(bucket.p100_list_price + (bucket.list_surcharge_total ?? 0))}
                                      {bucket.has_surcharges && <span className="absolute -top-0.5 -right-1.5 w-1 h-1 rounded-full bg-amber-400" title="Includes surcharges" />}
                                    </span>
                                  : <span className="text-[var(--text-muted)]/50">N/A</span>
                                }
                              </div>
                              <div className="text-[10px] text-[var(--text-muted)]">
                                {bucket.p100_cost != null
                                  ? <span className="relative">
                                      {formatCompact(bucket.p100_cost + (bucket.cost_surcharge_total ?? 0))}
                                      {bucket.has_surcharges && <span className="absolute -top-0.5 -right-1.5 w-1 h-1 rounded-full bg-amber-400" title="Includes surcharges" />}
                                    </span>
                                  : <span className="text-[var(--text-muted)]/50">N/A</span>
                                }
                              </div>
                              {bucket.currency && (
                                <div className="text-[9px] text-[var(--text-muted)]/60 text-center mt-0.5">
                                  {bucket.currency}
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="text-xs text-[var(--text-muted)]/40">&mdash;</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Expanded detail panel */}
                {isExpanded && (
                  <div className="border-b-2 border-[var(--border)] bg-slate-50/80">
                    {!expandedDetail ? (
                      <div className="px-4 py-3 flex items-center gap-2 text-xs text-[var(--text-muted)]">
                        <div className="w-3 h-3 border border-[var(--text-muted)] border-t-transparent rounded-full animate-spin" />
                        Loading rate details…
                      </div>
                    ) : (
                      <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
                        <AirExpandedPanel
                          detail={expandedDetail}
                          companiesMap={companiesMap}
                          cardId={card.id}
                          companiesList={companiesList}
                          onRatesChanged={() => {
                            onCardsRefresh();
                            fetchAirRateCardDetailAction(card.id).then(r => {
                              if (r?.success) setExpandedDetail(r.data);
                            });
                          }}
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
