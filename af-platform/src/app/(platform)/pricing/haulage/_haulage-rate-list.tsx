'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { HaulageRateCard } from '@/app/actions/pricing';
import { fetchHaulageRateCardDetailAction } from '@/app/actions/pricing';
import { useMonthBuckets, formatCompact, getAlertLevel } from '../_helpers';
import type { AlertLevel } from '../_helpers';
import { HaulageExpandedPanel } from './_haulage-expanded-panel';

const containerSizeLabel = (size: string): string => {
  const map: Record<string, string> = { '20': '20ft', '40': '40ft', '40HC': '40HC', 'wildcard': 'All Sizes' };
  return map[size] ?? size;
};

interface HaulageTimeSeriesRateListProps {
  cards: HaulageRateCard[];
  loading: boolean;
  portsMap: Record<string, { name: string; country_name: string }>;
  companiesMap: Record<string, string>;
  companiesList: { company_id: string; name: string }[];
  onCardsRefresh: () => void;
}

export function HaulageTimeSeriesRateList({
  cards,
  loading,
  portsMap,
  companiesMap,
  companiesList,
  onCardsRefresh,
}: HaulageTimeSeriesRateListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [historicalCount, setHistoricalCount] = useState(6);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedDetail, setExpandedDetail] = useState<HaulageRateCard | null>(null);

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
    fetchHaulageRateCardDetailAction(expandedId).then(r => {
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
        No haulage rate cards found
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

  const truncate = (str: string, max: number) =>
    str.length > max ? str.slice(0, max).trimEnd() + '…' : str;

  return (
    <div
      ref={containerRef}
      className="bg-white rounded-xl border border-[var(--border)] overflow-hidden flex flex-col"
    >
      {/* Frozen header */}
      <div className="overflow-x-auto shrink-0 border-b border-[var(--border)] bg-[var(--surface)]/50">
        <div className="flex" style={{ minWidth: `${totalWidth}px` }}>
          <div className="w-[280px] shrink-0 px-3 py-2 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Route / Container
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
            const alert = getAlertLevel(
              ts as Parameters<typeof getAlertLevel>[0],
              card.latest_cost_from,
              card.latest_list_price_from,
            );
            const cellAlert = alert;
            const portName = portsMap[card.port_un_code]?.name ?? card.port_un_code;
            const areaName = card.area_name ?? `Area ${card.area_id}`;
            const stateName = card.state_name ?? '';

            const areaFullLabel = stateName ? `${areaName}, ${stateName}` : areaName;
            const areaDisplayLabel = truncate(areaFullLabel, 32);

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
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="text-xs font-semibold text-[var(--text)] truncate" title={portName}>
                          {portName}
                        </div>
                        {card.terminal_name && (
                          <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 font-medium">
                            {card.terminal_name}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5">
                        <span
                          className="text-[11px] text-[var(--text-muted)]"
                          title={areaFullLabel}
                        >
                          {areaDisplayLabel}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                          {containerSizeLabel(card.container_size)}
                        </span>
                        {card.side_loader_available && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">
                            SL
                          </span>
                        )}
                        {card.include_depot_gate_fee && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">
                            +DGF
                          </span>
                        )}
                        {alertBadge(alert)}
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp size={14} className="text-[var(--text-muted)]" /> : <ChevronDown size={14} className="text-[var(--text-muted)]" />}
                  </div>

                  {/* Time series cells */}
                  <div className="flex flex-1">
                    {months.map(m => {
                      const bucket = ts.find(b => b.month_key === m.month_key);
                      const hasData = bucket && (bucket.list_price != null || bucket.cost != null);
                      const isDraft = bucket?.rate_status === 'DRAFT';

                      return (
                        <div
                          key={m.month_key}
                          className={`w-[80px] shrink-0 px-1 py-2.5 text-center ${
                            m.isCurrentMonth && !cellAlert ? 'bg-[var(--sky-mist)]/40' : ''
                          }`}
                        >
                          {hasData ? (
                            <>
                              <div className={`text-xs font-medium ${
                                isDraft ? 'text-amber-600' : cellAlert === 'cost_exceeds_price' ? 'text-red-700 font-semibold' : cellAlert === 'no_list_price' ? 'text-amber-700 font-semibold' : cellAlert === 'no_active_cost' ? 'text-red-600 font-semibold' : 'text-[var(--text)]'
                              }`}>
                                {bucket.list_price != null
                                  ? formatCompact(bucket.list_price + (bucket.list_surcharge_total ?? bucket.surcharge_total ?? 0))
                                  : <span className="text-[var(--text-muted)]/50">N/A</span>
                                }
                              </div>
                              <div className="text-[10px] text-[var(--text-muted)]">
                                {bucket.cost != null
                                  ? formatCompact(bucket.cost + (bucket.cost_surcharge_total ?? bucket.surcharge_total ?? 0))
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
                      <div className="px-4 py-3 flex items-center gap-2 text-xs text-[var(--text-muted)]" style={{ minWidth: `${totalWidth}px` }}>
                        <div className="w-3 h-3 border border-[var(--text-muted)] border-t-transparent rounded-full animate-spin" />
                        Loading rate details…
                      </div>
                    ) : (
                      <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                        <HaulageExpandedPanel
                          detail={expandedDetail}
                          months={months}
                          companiesMap={companiesMap}
                          totalWidth={totalWidth}
                          cardId={card.id}
                          companiesList={companiesList}
                          onRatesChanged={() => {
                            onCardsRefresh();
                            fetchHaulageRateCardDetailAction(card.id).then(r => {
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
