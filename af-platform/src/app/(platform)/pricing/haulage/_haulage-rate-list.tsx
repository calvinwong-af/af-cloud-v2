'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, Pencil, Trash2 } from 'lucide-react';
import type { HaulageRateCard } from '@/app/actions/pricing';
import { fetchHaulageRateCardDetailAction } from '@/app/actions/pricing';
import { useMonthBuckets, formatCompact, getAlertLevel } from '../_helpers';
import type { AlertLevel } from '../_helpers';
import { HaulageExpandedPanel } from './_haulage-expanded-panel';

function HaulageSurchargeTooltip({
  mode,
  baseValue,
  items,
  currency,
}: {
  mode: 'list' | 'cost';
  baseValue: number | null;
  items: { label: string; amount: number }[];
  currency: string | null;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const label = mode === 'list' ? 'Freight' : 'Cost';
  const surchargeTotal = items.reduce((s, x) => s + x.amount, 0);
  const total = (baseValue ?? 0) + surchargeTotal;
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
          className="bg-white border border-[var(--border)] rounded shadow-lg p-2 min-w-[160px] text-left"
        >
          <div className="text-[10px] text-[var(--text-muted)] font-semibold mb-1">Surcharge breakdown</div>
          {baseValue != null && (
            <div className="flex justify-between gap-3 text-[10px]">
              <span className="text-[var(--text-muted)]">{label}</span>
              <span className="font-medium">{baseValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
            </div>
          )}
          {items.map((item, i) => (
            <div key={i} className="flex justify-between gap-3 text-[10px]">
              <span className="text-[var(--text-muted)]">{item.label}</span>
              <span className="font-medium text-amber-600">+{item.amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
            </div>
          ))}
          <div className="flex justify-between gap-3 text-[10px] font-semibold border-t border-[var(--border)] mt-1 pt-1">
            <span>Total</span>
            <span>{total.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
          </div>
          {currency && <div className="text-[9px] text-[var(--text-muted)] mt-1">{currency}</div>}
        </div>
      )}
    </span>
  );
}

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
  onEditCard?: (card: HaulageRateCard) => void;
  onDeleteCard?: (cardId: number) => Promise<void>;
}

export function HaulageTimeSeriesRateList({
  cards,
  loading,
  portsMap,
  companiesMap,
  companiesList,
  onCardsRefresh,
  onEditCard,
  onDeleteCard,
}: HaulageTimeSeriesRateListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [historicalCount, setHistoricalCount] = useState(6);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedDetail, setExpandedDetail] = useState<HaulageRateCard | null>(null);
  const [confirmDeleteCardId, setConfirmDeleteCardId] = useState<number | null>(null);
  const [deletingCard, setDeletingCard] = useState(false);

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
            Area / Container
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
            const areaDisplayLabel = truncate(areaFullLabel, 28);

            return (
              <div key={card.id}>
                <div
                  className={`group flex border-b border-[var(--border)] hover:bg-[var(--surface)]/30 cursor-pointer transition-colors ${
                    alert ? 'border-l-2 border-l-red-400' : ''
                  }`}
                  style={{ minWidth: `${totalWidth}px` }}
                  onClick={() => setExpandedId(isExpanded ? null : card.id)}
                >
                  {/* Identity */}
                  <div className="w-[280px] shrink-0 px-3 py-2.5 flex items-center gap-2">
                    {confirmDeleteCardId === card.id ? (
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        <span className="text-[11px] text-red-600 font-medium">Delete this rate card?</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!onDeleteCard) return;
                            setDeletingCard(true);
                            onDeleteCard(card.id).finally(() => { setDeletingCard(false); setConfirmDeleteCardId(null); });
                          }}
                          disabled={deletingCard}
                          className="text-[10px] px-1.5 py-0.5 rounded border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmDeleteCardId(null); }}
                          className="text-[10px] px-1.5 py-0.5 rounded border border-[var(--border)] hover:bg-[var(--surface)] transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div
                            className="text-xs font-semibold text-[var(--text)] truncate"
                            title={areaFullLabel}
                          >
                            {areaDisplayLabel}
                          </div>
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 flex items-center gap-0.5">
                            {onEditCard && (
                              <button
                                onClick={(e) => { e.stopPropagation(); onEditCard(card); }}
                                className="p-0.5 rounded hover:bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--sky)]"
                                title="Edit card"
                              >
                                <Pencil size={12} />
                              </button>
                            )}
                            {onDeleteCard && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setConfirmDeleteCardId(card.id); }}
                                className="p-0.5 rounded hover:bg-[var(--surface)] text-[var(--text-muted)] hover:text-red-500"
                                title="Delete card"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                          {card.terminal_name && (
                            <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 font-medium">
                              {card.terminal_name}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5">
                          <span className="text-[11px] text-[var(--text-muted)] truncate" title={portName}>
                            {card.port_un_code}{card.terminal_name ? ` · ${card.terminal_name}` : ''}
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
                          {card.is_tariff_rate && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-600 font-medium">
                              Tariff
                            </span>
                          )}
                          {alertBadge(alert)}
                        </div>
                      </div>
                    )}
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
                              <div className={`text-xs font-medium flex items-center justify-center gap-0 ${
                                isDraft ? 'text-amber-600' : cellAlert === 'cost_exceeds_price' ? 'text-red-700 font-semibold' : cellAlert === 'no_list_price' ? 'text-amber-700 font-semibold' : cellAlert === 'no_active_cost' ? 'text-red-600 font-semibold' : 'text-[var(--text)]'
                              }`}>
                                {bucket.list_price != null
                                  ? formatCompact(bucket.list_price + (bucket.cost_surcharge_total ?? 0))
                                  : <span className="text-[var(--text-muted)]/50">N/A</span>
                                }
                                {bucket.list_price != null && (bucket.cost_surcharge_total ?? 0) > 0 && (
                                  <HaulageSurchargeTooltip
                                    mode="list"
                                    baseValue={bucket.list_price}
                                    items={bucket.cost_surcharge_items ?? []}
                                    currency={bucket.currency}
                                  />
                                )}
                              </div>
                              <div className="text-[10px] text-[var(--text-muted)] flex items-center justify-center gap-0">
                                {bucket.cost != null
                                  ? formatCompact(bucket.cost + (bucket.cost_surcharge_total ?? bucket.surcharge_total ?? 0))
                                  : <span className="text-[var(--text-muted)]/50">N/A</span>
                                }
                                {bucket.cost != null && (bucket.cost_surcharge_total ?? 0) > 0 && (
                                  <HaulageSurchargeTooltip
                                    mode="cost"
                                    baseValue={bucket.cost}
                                    items={bucket.cost_surcharge_items ?? []}
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
