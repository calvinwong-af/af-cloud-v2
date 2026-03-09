'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { PortTransportRateCard } from '@/app/actions/pricing';
import { fetchPortTransportRateCardDetailAction } from '@/app/actions/pricing';
import { useMonthBuckets, formatCompact, getAlertLevel } from '../_helpers';
import type { AlertLevel } from '../_helpers';
import { PortTransportRateModal } from './_port-transport-rate-modal';

interface PortTransportTimeSeriesRateListProps {
  cards: PortTransportRateCard[];
  loading: boolean;
  portsMap: Record<string, { name: string; country_name: string }>;
  companiesMap: Record<string, string>;
  onCardsRefresh: () => void;
}

export function PortTransportTimeSeriesRateList({
  cards,
  loading,
  portsMap,
  companiesMap,
  onCardsRefresh,
}: PortTransportTimeSeriesRateListProps) {
  const months = useMonthBuckets(9);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedDetail, setExpandedDetail] = useState<PortTransportRateCard | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add-list-price' | 'add-supplier' | 'edit' | 'update'>('add-list-price');
  const [editRateId, setEditRateId] = useState<number | undefined>();
  const [editInitial, setEditInitial] = useState<Record<string, unknown> | undefined>();
  const [editCardId, setEditCardId] = useState<number>(0);

  useEffect(() => {
    if (expandedId == null) { setExpandedDetail(null); return; }
    fetchPortTransportRateCardDetailAction(expandedId).then(r => {
      if (r?.success) setExpandedDetail(r.data);
    });
  }, [expandedId]);

  // Auto-scroll to show current month
  useEffect(() => {
    if (scrollRef.current) {
      const currentIdx = months.findIndex(m => m.isCurrentMonth);
      if (currentIdx > 0) {
        scrollRef.current.scrollLeft = Math.max(0, (currentIdx - 3) * 80);
      }
    }
  }, [cards, months]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 bg-[var(--surface)] rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-[var(--border)] py-12 text-center text-sm text-[var(--text-muted)]">
        No transport rate cards found
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
    <div className="bg-white rounded-xl border border-[var(--border)] overflow-hidden">
      {/* Header */}
      <div className="flex border-b border-[var(--border)] bg-[var(--surface)]/50">
        <div className="w-[280px] shrink-0 px-3 py-2 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
          Route / Vehicle
        </div>
        <div className="flex-1 overflow-x-auto" ref={scrollRef}>
          <div className="flex">
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

      {/* Rows */}
      {cards.map(card => {
        const isExpanded = expandedId === card.id;
        const ts = card.time_series ?? [];
        const alert = getAlertLevel(
          ts as Parameters<typeof getAlertLevel>[0],
          card.latest_cost_from,
          card.latest_list_price_from,
        );
        const cellAlert = alert;

        return (
          <div key={card.id}>
            <div
              className={`flex border-b border-[var(--border)] hover:bg-[var(--surface)]/30 cursor-pointer transition-colors ${
                alert ? 'border-l-2 border-l-red-400' : ''
              }`}
              onClick={() => setExpandedId(isExpanded ? null : card.id)}
            >
              {/* Identity */}
              <div className="w-[280px] shrink-0 px-3 py-2.5 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-[var(--text)] truncate">
                      {portsMap[card.port_un_code]?.name ?? card.port_un_code}
                    </span>
                    <span className="text-[var(--text-muted)] text-[10px]">→</span>
                    <span className="text-xs font-medium text-[var(--text)] truncate">
                      {card.area_name ?? `Area ${card.area_id}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                      {card.vehicle_type_label ?? card.vehicle_type_id}
                    </span>
                    {card.include_depot_gate_fee && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">
                        +Depot
                      </span>
                    )}
                    {alertBadge(alert)}
                  </div>
                </div>
                {isExpanded ? <ChevronUp size={14} className="text-[var(--text-muted)]" /> : <ChevronDown size={14} className="text-[var(--text-muted)]" />}
              </div>

              {/* Time series cells */}
              <div className="flex-1 overflow-x-auto">
                <div className="flex">
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
            </div>

            {/* Expanded detail panel */}
            {isExpanded && expandedDetail && (
              <div className="border-b border-[var(--border)] bg-[var(--surface)]/20 px-4 py-3">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs text-[var(--text-muted)]">
                    Rate Card: <span className="font-mono font-medium text-[var(--text)]">{card.rate_card_key}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditCardId(card.id); setModalMode('add-list-price'); setEditRateId(undefined); setEditInitial(undefined); setModalOpen(true); }}
                      className="text-[10px] px-2.5 py-1 rounded border border-[var(--sky)]/30 text-[var(--sky)] hover:bg-[var(--sky-mist)]/30 transition-colors"
                    >
                      + List Price
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditCardId(card.id); setModalMode('add-supplier'); setEditRateId(undefined); setEditInitial(undefined); setModalOpen(true); }}
                      className="text-[10px] px-2.5 py-1 rounded border border-[var(--sky)]/30 text-[var(--sky)] hover:bg-[var(--sky-mist)]/30 transition-colors"
                    >
                      + Supplier Rate
                    </button>
                  </div>
                </div>

                {/* Rates by supplier */}
                {expandedDetail.rates_by_supplier && Object.entries(expandedDetail.rates_by_supplier).map(([supKey, rates]) => (
                  <div key={supKey} className="mb-3">
                    <div className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                      {supKey === 'null' || !supKey ? 'List Price Reference' : (companiesMap[supKey] ?? supKey)}
                    </div>
                    <div className="space-y-1">
                      {(rates as Array<{ id: number; effective_from: string; effective_to: string | null; rate_status: string; currency: string; list_price: number | null; cost: number | null; min_list_price: number | null; min_cost: number | null; supplier_id: string | null }>).map(rate => (
                        <div
                          key={rate.id}
                          className="flex items-center gap-3 text-xs bg-white rounded px-2.5 py-1.5 border border-[var(--border)] hover:border-[var(--sky)]/30 cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditCardId(card.id);
                            setEditRateId(rate.id);
                            setEditInitial(rate as unknown as Record<string, unknown>);
                            setModalMode('edit');
                            setModalOpen(true);
                          }}
                        >
                          <span className="text-[var(--text-muted)] w-16">{rate.effective_from}</span>
                          <span className="text-[var(--text-muted)] w-16">{rate.effective_to ?? 'Ongoing'}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                            rate.rate_status === 'PUBLISHED' ? 'bg-emerald-50 text-emerald-600'
                              : rate.rate_status === 'DRAFT' ? 'bg-amber-50 text-amber-600'
                              : 'bg-slate-100 text-slate-500'
                          }`}>
                            {rate.rate_status}
                          </span>
                          <span className="text-[var(--text)]">{rate.currency}</span>
                          {rate.list_price != null && (
                            <span className="text-[var(--text)]">List: {rate.list_price}</span>
                          )}
                          {rate.cost != null && (
                            <span className="text-[var(--text)]">Cost: {rate.cost}</span>
                          )}
                          {rate.min_list_price != null && (
                            <span className="text-[var(--text-muted)]">Min List: {rate.min_list_price}</span>
                          )}
                          {rate.min_cost != null && (
                            <span className="text-[var(--text-muted)]">Min Cost: {rate.min_cost}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Rate Modal */}
      <PortTransportRateModal
        open={modalOpen}
        mode={modalMode}
        rateId={editRateId}
        initial={editInitial}
        cardId={editCardId}
        companiesList={Object.entries(companiesMap).map(([id, name]) => ({ company_id: id, name }))}
        onSaved={() => {
          onCardsRefresh();
          if (expandedId) {
            fetchPortTransportRateCardDetailAction(expandedId).then(r => {
              if (r?.success) setExpandedDetail(r.data);
            });
          }
        }}
        onClose={() => { setModalOpen(false); setEditRateId(undefined); setEditInitial(undefined); }}
      />
    </div>
  );
}
