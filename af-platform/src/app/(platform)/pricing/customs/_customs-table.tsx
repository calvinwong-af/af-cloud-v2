'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ChevronDown, ChevronRight, Plus, Warehouse } from 'lucide-react';
import {
  fetchPricingCountriesAction,
  fetchCustomsRateCardsAction,
  fetchCustomsRatePortsAction,
} from '@/app/actions/pricing';
import type { PricingCountry, CustomsRateCard, CustomsRate } from '@/app/actions/pricing';
import { fetchPortsAction } from '@/app/actions/shipments';
import { PortCombobox } from '@/components/shared/PortCombobox';
import { ToggleSwitch } from '../_components';
import { useMonthBuckets, formatCompact, formatDate } from '../_helpers';
import { CustomsModal } from './_customs-modal';

const SHIPMENT_TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'FCL', label: 'FCL' },
  { value: 'LCL', label: 'LCL' },
  { value: 'AIR', label: 'AIR' },
  { value: 'CB', label: 'CB' },
  { value: 'ALL', label: 'ALL' },
];

const directionBadge = (d: string) => {
  const cls = d === 'IMPORT' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700';
  return <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${cls}`}>{d}</span>;
};

const typeBadge = (t: string) => {
  const colors: Record<string, string> = {
    FCL: 'bg-sky-50 text-sky-700',
    LCL: 'bg-violet-50 text-violet-700',
    AIR: 'bg-orange-50 text-orange-700',
    CB: 'bg-slate-100 text-slate-600',
    ALL: 'bg-slate-100 text-slate-600',
  };
  return <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${colors[t] ?? 'bg-slate-100 text-slate-600'}`}>{t}</span>;
};

function CustomsRatesTab({ countryCode }: { countryCode?: string }) {
  const [countries, setCountries] = useState<PricingCountry[]>([]);
  const [country, setCountry] = useState(countryCode ?? 'MY');
  const [portOptions, setPortOptions] = useState<string[]>([]);
  const [portFilter, setPortFilter] = useState('');
  const [shipmentTypeFilter, setShipmentTypeFilter] = useState('');
  const [textFilter, setTextFilter] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [cards, setCards] = useState<CustomsRateCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [portsMap, setPortsMap] = useState<Record<string, { name: string; country_name: string }>>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [editRate, setEditRate] = useState<CustomsRate | null>(null);

  useEffect(() => {
    fetchPricingCountriesAction().then(r => { if (r?.success) setCountries(r.data); });
    fetchPortsAction().then(portsData => {
      const map: Record<string, { name: string; country_name: string }> = {};
      for (const p of portsData) { map[p.un_code] = { name: p.name, country_name: p.country_name }; }
      setPortsMap(map);
    });
  }, []);

  const prevCountry = useRef(country);
  useEffect(() => {
    if (prevCountry.current !== country) {
      setPortFilter('');
      setTextFilter('');
      prevCountry.current = country;
    }
    fetchCustomsRatePortsAction(country || undefined).then(r => {
      if (r?.success) setPortOptions(r.data);
    });
  }, [country]);

  const fetchCards = useCallback(() => {
    if (!portFilter) {
      setCards([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchCustomsRateCardsAction({
      portCode: portFilter,
      shipmentType: shipmentTypeFilter || undefined,
      isActive: showInactive ? undefined : true,
    }).then(r => {
      if (r?.success) setCards(r.data);
      setLoading(false);
    });
  }, [portFilter, shipmentTypeFilter, showInactive]);

  useEffect(() => { fetchCards(); }, [fetchCards]);

  const filteredCards = useMemo(() => {
    if (!textFilter.trim()) return cards;
    const q = textFilter.trim().toLowerCase();
    return cards.filter(c =>
      c.charge_code.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q)
    );
  }, [cards, textFilter]);

  const portComboOptions = [
    { value: '', label: 'All Ports' },
    ...portOptions.map(code => ({ value: code, label: code, sublabel: portsMap[code]?.name ?? '' })),
  ];

  const countryOptions = [
    { value: '', label: 'All Countries' },
    ...countries.filter(c => c.country_code && c.country_name).map(c => ({
      value: c.country_code,
      label: `${c.country_code} — ${c.country_name}`,
    })),
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-56">
          <PortCombobox value={country} onChange={setCountry} options={countryOptions} placeholder="All Countries" />
        </div>
        <div className="w-44">
          <PortCombobox value={portFilter} onChange={setPortFilter} options={portComboOptions} placeholder="All Ports" />
        </div>
        <div className="w-36">
          <PortCombobox value={shipmentTypeFilter} onChange={setShipmentTypeFilter} options={SHIPMENT_TYPE_OPTIONS} placeholder="All Types" />
        </div>
        <ToggleSwitch checked={showInactive} onChange={setShowInactive} label="Show inactive" />
        <div className="flex-1" />
        <button
          onClick={() => { setEditRate(null); setModalOpen(true); }}
          className="h-9 px-3 text-sm rounded-lg bg-[var(--sky)] text-white font-medium hover:bg-[var(--sky)]/90 transition-colors flex items-center gap-1.5"
        >
          <Plus size={14} /> Add Rate
        </button>
      </div>
      <div className="relative">
        <input
          type="text"
          value={textFilter}
          onChange={e => setTextFilter(e.target.value)}
          placeholder="Filter by charge code, description..."
          className="w-full h-9 pl-3 pr-8 text-sm rounded-lg border border-[var(--border)] bg-white text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--sky)] focus:border-[var(--sky)] transition-colors"
        />
        {textFilter && (
          <button
            onClick={() => setTextFilter('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
            aria-label="Clear filter"
          >
            ×
          </button>
        )}
      </div>

      {!portFilter ? (
        <div className="bg-white rounded-xl border border-[var(--border)] py-16 flex flex-col items-center gap-3 text-[var(--text-muted)]">
          <Warehouse className="w-8 h-8 opacity-40" />
          <p className="text-sm">Select a port to view customs rates</p>
        </div>
      ) : (
        <>
          <CustomsCardList cards={filteredCards} loading={loading} />
          <div className="text-xs text-[var(--text-muted)]">
            {filteredCards.length}{filteredCards.length !== cards.length ? ` of ${cards.length}` : ''} charge codes
          </div>
        </>
      )}

      <CustomsModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditRate(null); }}
        onSave={async () => { setModalOpen(false); setEditRate(null); fetchCards(); }}
        editRate={editRate}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card List Component
// ---------------------------------------------------------------------------

function CustomsCardList({
  cards,
  loading,
}: {
  cards: CustomsRateCard[];
  loading: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [historicalCount, setHistoricalCount] = useState(6);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (width === 0) return;
      const available = width - 260;
      const historical = Math.min(9, Math.max(1, Math.floor((available - 240) / 80)));
      setHistoricalCount(historical);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const months = useMonthBuckets(historicalCount);
  const totalWidth = 260 + months.length * 80;

  const toggleGroup = (label: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const groups = useMemo(() => [
    { label: 'IMPORT', cards: cards.filter(c => c.trade_direction === 'IMPORT') },
    { label: 'EXPORT', cards: cards.filter(c => c.trade_direction === 'EXPORT') },
  ].filter(g => g.cards.length > 0), [cards]);

  if (loading) {
    return (
      <div ref={containerRef} className="bg-white rounded-xl border border-[var(--border)] overflow-hidden">
        <div className="overflow-x-auto">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex border-b border-[var(--border)] last:border-b-0" style={{ minWidth: `${totalWidth}px` }}>
              <div className="w-[260px] shrink-0 p-3 space-y-2">
                <div className="h-4 w-20 bg-[var(--surface)] rounded animate-pulse" />
                <div className="h-3 w-32 bg-[var(--surface)] rounded animate-pulse" />
                <div className="h-3 w-24 bg-[var(--surface)] rounded animate-pulse" />
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
        <Warehouse className="w-8 h-8 opacity-40" />
        <p className="text-sm">No customs rates found for this port</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="bg-white rounded-xl border border-[var(--border)] overflow-hidden flex flex-col">
      {/* Frozen header */}
      <div className="overflow-x-auto shrink-0 border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="flex" style={{ minWidth: `${totalWidth}px` }}>
          <div className="w-[260px] shrink-0 px-3 py-2">
            <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Charge</span>
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

      {/* Scrollable body */}
      <div className="overflow-auto flex-1">
        <div style={{ minWidth: `${totalWidth}px` }}>
          {groups.map(group => {
            const isCollapsed = collapsedGroups.has(group.label);
            return (
              <div key={group.label}>
                {/* Section header */}
                <div
                  className="flex items-center px-3 py-1.5 border-b border-[var(--border)] bg-[var(--surface)] cursor-pointer select-none sticky top-0 z-10"
                  style={{ minWidth: `${totalWidth}px` }}
                  onClick={() => toggleGroup(group.label)}
                >
                  {isCollapsed ? (
                    <ChevronRight className="w-3.5 h-3.5 mr-2 text-[var(--text-muted)]" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 mr-2 text-[var(--text-muted)]" />
                  )}
                  <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">{group.label}</span>
                  <span className="ml-2 text-xs text-[var(--text-muted)]/60">({group.cards.length})</span>
                </div>

                {/* Card rows */}
                {!isCollapsed && group.cards.map(card => {
                  const ts = card.time_series ?? [];
                  const tsMap = new Map(ts.map(t => [t.month_key, t]));

                  return (
                    <div
                      key={card.card_key}
                      className="flex border-b border-[var(--border)] hover:bg-[var(--sky-mist)]/10 border-l-2 border-l-transparent"
                      style={{ minWidth: `${totalWidth}px` }}
                    >
                      {/* Left identity panel */}
                      <div className="w-[260px] shrink-0 px-3 py-2.5 flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${card.is_active ? 'bg-emerald-500' : 'bg-red-400'}`} />
                          <span className="text-sm font-semibold text-[var(--text)] truncate">{card.charge_code}</span>
                        </div>
                        <span className="text-[11px] text-[var(--text-muted)] truncate pl-3">{card.description}</span>
                        <div className="flex items-center gap-1.5 pl-3 mt-0.5 flex-wrap">
                          {directionBadge(card.trade_direction)}
                          {typeBadge(card.shipment_type)}
                          {card.is_domestic && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">DOM</span>
                          )}
                        </div>
                        <span className="text-[10px] text-[var(--text-muted)]/60 pl-3">{card.uom}</span>
                        <span className="text-[10px] text-[var(--text-muted)]/60 pl-3">
                          {card.latest_effective_from
                            ? `Eff: ${formatDate(card.latest_effective_from)}${card.latest_effective_to ? ` \u2013 ${formatDate(card.latest_effective_to)}` : ' \u2013 ongoing'}`
                            : '\u2014'}
                        </span>
                      </div>

                      {/* Right: time-series cells */}
                      <div className="flex flex-1">
                        {months.map(m => {
                          const bucket = tsMap.get(m.month_key);
                          const hasData = bucket && (bucket.price != null || bucket.cost != null);

                          return (
                            <div
                              key={m.month_key}
                              className={`w-[80px] shrink-0 px-1 py-2.5 text-center ${
                                m.isCurrentMonth ? 'bg-[var(--sky-mist)]/40' : ''
                              }`}
                            >
                              {hasData ? (
                                <>
                                  <div className="text-xs font-medium text-[var(--text)]">
                                    {formatCompact(bucket.price)}
                                  </div>
                                  <div className="text-[10px] text-[var(--text-muted)]">
                                    {formatCompact(bucket.cost)}
                                  </div>
                                  {card.currency && (
                                    <div className="text-[9px] text-[var(--text-muted)]/60 text-center mt-0.5">
                                      {card.currency}
                                    </div>
                                  )}
                                </>
                              ) : (
                                <div className="text-xs text-[var(--text-muted)]/40">{'\u2014'}</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export { CustomsRatesTab };
