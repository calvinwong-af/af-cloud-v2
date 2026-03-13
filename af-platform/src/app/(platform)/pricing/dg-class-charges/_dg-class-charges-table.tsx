'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ChevronDown, ChevronRight, FlaskConical, Info, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  fetchPricingCountriesAction,
  fetchDgClassChargeCardsAction,
  fetchDgClassChargePortsAction,
  createDgClassChargeAction,
  updateDgClassChargeAction,
  updateDgClassChargeCardAction,
  deleteDgClassChargeAction,
  deleteDgClassChargeCardAction,
} from '@/app/actions/pricing';
import type { PricingCountry, DgClassChargeCard } from '@/app/actions/pricing';
import { fetchPortsAction } from '@/app/actions/shipments';
import { PortCombobox } from '@/components/shared/PortCombobox';
import { ToggleSwitch } from '../_components';
import { useMonthBuckets, formatCompact, formatDate } from '../_helpers';
import { DgClassChargesModal } from './_dg-class-charges-modal';
import type { DgClassChargeModalSeed } from './_dg-class-charges-modal';

const SHIPMENT_TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'FCL', label: 'FCL' },
  { value: 'LCL', label: 'LCL' },
  { value: 'AIR', label: 'AIR' },
  { value: 'CB', label: 'CB' },
];

const DG_CLASS_OPTIONS = [
  { value: '', label: 'All Classes' },
  { value: 'DG-2', label: 'DG-2' },
  { value: 'DG-3', label: 'DG-3' },
];

const UOM_TOOLTIPS: Record<string, string> = {
  CONTAINER: 'Per container (FCL)',
  CBM: 'Per cubic metre (LCL)',
  KG: 'Per kilogram \u2014 gross weight',
  'W/M': 'W/M \u2014 Weight or Measurement (revenue tonne)',
  SET: 'Per set \u2014 fixed fee, qty 1',
  BL: 'Per Bill of Lading',
};

const CONTAINER_TYPE_TOOLTIPS: Record<string, string> = {
  GP: 'General Purpose',
  HC: 'High Cube',
  RF: 'Reefer',
  FF: 'Flat Rack',
  OT: 'Open Top',
  FR: 'Flat Rack (FR)',
  PL: 'Platform',
  ALL: 'All container types',
};

const DIRECTION_TOOLTIPS: Record<string, string> = {
  IMPORT: 'Import \u2014 inbound shipment',
  EXPORT: 'Export \u2014 outbound shipment',
};

const DIRECTION_LABELS: Record<string, string> = {
  IMPORT: 'IMP',
  EXPORT: 'EXP',
};

const directionBadge = (d: string) => {
  const cls = d === 'IMPORT' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700';
  return <span title={DIRECTION_TOOLTIPS[d] ?? d} className={`text-[10px] font-medium px-1.5 py-0.5 rounded cursor-help ${cls}`}>{DIRECTION_LABELS[d] ?? d}</span>;
};

const TYPE_TOOLTIPS: Record<string, string> = {
  FCL: 'FCL \u2014 Full Container Load',
  LCL: 'LCL \u2014 Less than Container Load',
  AIR: 'AIR \u2014 Air freight',
  CB: 'CB \u2014 Cross-border',
  ALL: 'ALL \u2014 Applies to all shipment types',
};

const typeBadge = (t: string) => {
  const colors: Record<string, string> = {
    FCL: 'bg-sky-50 text-sky-700',
    LCL: 'bg-violet-50 text-violet-700',
    AIR: 'bg-orange-50 text-orange-700',
    CB: 'bg-slate-100 text-slate-600',
    ALL: 'bg-slate-100 text-slate-600',
  };
  return <span title={TYPE_TOOLTIPS[t] ?? t} className={`text-[10px] font-medium px-1.5 py-0.5 rounded cursor-help ${colors[t] ?? 'bg-slate-100 text-slate-600'}`}>{t}</span>;
};

const dgClassBadge = (dg: string) => {
  const cls = dg === 'DG-2' ? 'bg-rose-50 text-rose-700' : 'bg-purple-50 text-purple-700';
  return <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${cls}`}>{dg}</span>;
};

function buildCardSeed(card: DgClassChargeCard): Omit<DgClassChargeModalSeed, 'rate_id' | 'price' | 'cost' | 'effective_from' | 'effective_to'> {
  return {
    card_id: card.card_id,
    card_key: card.card_key,
    port_code: card.port_code,
    trade_direction: card.trade_direction,
    shipment_type: card.shipment_type,
    container_size: card.container_size,
    container_type: card.container_type,
    dg_class_code: card.dg_class_code,
    charge_code: card.charge_code,
    description: card.description,
    currency: card.currency,
    uom: card.uom,
    is_domestic: card.is_domestic,
    is_international: card.is_international,
    is_active: card.is_active,
  };
}

function getDgClassChargeAlertLevel(card: DgClassChargeCard): 'cost_exceeds_price' | 'no_active_cost' | null {
  const today = new Date();
  const currentKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const bucket = (card.time_series ?? []).find(t => t.month_key === currentKey);
  if (!bucket) return null;
  const price = bucket.price;
  const cost = bucket.cost;
  if (price != null && cost != null && cost > price) return 'cost_exceeds_price';
  if (price != null && cost == null) return 'no_active_cost';
  return null;
}

export function DgClassChargesTab({ countryCode, alertFilter }: { countryCode?: string; alertFilter?: string }) {
  const [countries, setCountries] = useState<PricingCountry[]>([]);
  const [country, setCountry] = useState(countryCode ?? 'MY');
  const [portOptions, setPortOptions] = useState<string[]>([]);
  const [portFilter, setPortFilter] = useState('');
  const [shipmentTypeFilter, setShipmentTypeFilter] = useState('');
  const [dgClassFilter, setDgClassFilter] = useState('');
  const [textFilter, setTextFilter] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [cards, setCards] = useState<DgClassChargeCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [portsMap, setPortsMap] = useState<Record<string, { name: string; country_name: string }>>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'new' | 'edit-rate' | 'edit-card'>('new');
  const [modalSeed, setModalSeed] = useState<DgClassChargeModalSeed | null>(null);
  const [showIssuesOnly, setShowIssuesOnly] = useState(!!alertFilter);

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
    fetchDgClassChargePortsAction(country || undefined).then(r => {
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
    fetchDgClassChargeCardsAction({
      portCode: portFilter,
      isActive: showInactive ? undefined : true,
    }).then(r => {
      if (r?.success) setCards(r.data);
      setLoading(false);
    });
  }, [portFilter, showInactive]);

  useEffect(() => { fetchCards(); }, [fetchCards]);

  const filteredCards = useMemo(() => {
    let result = cards;
    if (showIssuesOnly) {
      result = result.filter(c => getDgClassChargeAlertLevel(c) !== null);
    }
    if (shipmentTypeFilter) {
      result = result.filter(c => c.shipment_type === shipmentTypeFilter || c.shipment_type === 'ALL');
    }
    if (dgClassFilter) {
      result = result.filter(c => c.dg_class_code === dgClassFilter);
    }
    if (!textFilter.trim()) return result;
    const q = textFilter.trim().toLowerCase();
    return result.filter(c =>
      c.charge_code.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q)
    );
  }, [cards, showIssuesOnly, shipmentTypeFilter, dgClassFilter, textFilter]);

  const portComboOptions = [
    { value: '', label: 'All Ports' },
    ...portOptions.map(code => ({ value: code, label: code, sublabel: portsMap[code]?.name ?? '' })),
  ];

  const modalPortOptions = useMemo(() =>
    Object.entries(portsMap).map(([code, p]) => ({ value: code, label: p.name, sublabel: p.country_name })),
    [portsMap],
  );

  const countryOptions = [
    { value: '', label: 'All Countries' },
    ...countries.filter(c => c.country_code && c.country_name).map(c => ({
      value: c.country_code,
      label: `${c.country_code} \u2014 ${c.country_name}`,
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
        <div className="w-36">
          <PortCombobox value={dgClassFilter} onChange={setDgClassFilter} options={DG_CLASS_OPTIONS} placeholder="All Classes" />
        </div>
        <ToggleSwitch checked={showInactive} onChange={setShowInactive} label="Show inactive" />
        <button
          onClick={() => setShowIssuesOnly(v => !v)}
          className={`h-9 px-3 text-sm rounded-lg border font-medium transition-colors flex items-center gap-1.5 ${
            showIssuesOnly
              ? 'bg-red-50 border-red-300 text-red-700 hover:bg-red-100'
              : 'bg-white border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--text-muted)]'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${showIssuesOnly ? 'bg-red-500' : 'bg-[var(--text-muted)]'}`} />
          Issues only
        </button>
        <div className="flex-1" />
        <button
          onClick={() => { setModalSeed(null); setModalMode('new'); setModalOpen(true); }}
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
            &times;
          </button>
        )}
      </div>

      {!portFilter ? (
        <div className="bg-white rounded-xl border border-[var(--border)] py-16 flex flex-col items-center gap-3 text-[var(--text-muted)]">
          <FlaskConical className="w-8 h-8 opacity-40" />
          <p className="text-sm">Select a port to view DG class charges</p>
        </div>
      ) : (
        <>
          <DgClassChargeCardList
            cards={filteredCards}
            loading={loading}
            onDeleteCard={async (cardKey) => {
              const result = await deleteDgClassChargeCardAction(cardKey);
              if (!result.success) throw new Error(result.error ?? 'Delete failed');
              fetchCards();
            }}
            onAction={(seed, mode) => {
              setModalSeed(seed);
              setModalMode(mode);
              setModalOpen(true);
            }}
          />
          <div className="text-xs text-[var(--text-muted)]">
            {showIssuesOnly
              ? `${filteredCards.length} charge${filteredCards.length !== 1 ? 's' : ''} with issues`
              : `${filteredCards.length}${filteredCards.length !== cards.length ? ` of ${cards.length}` : ''} charge codes`
            }
          </div>
        </>
      )}

      <DgClassChargesModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setModalSeed(null); }}
        mode={modalMode}
        seed={modalSeed ?? undefined}
        portOptions={modalPortOptions}
        onSave={async (payload) => {
          if (payload.mode === 'new') {
            const result = await createDgClassChargeAction(payload.data);
            if (!result.success) throw new Error(result.error ?? 'Create failed');
          } else if (payload.mode === 'edit-rate') {
            const result = await updateDgClassChargeAction(payload.rateId, payload.data);
            if (!result.success) throw new Error(result.error ?? 'Update failed');
          } else if (payload.mode === 'edit-card') {
            const result = await updateDgClassChargeCardAction(payload.cardId, payload.data);
            if (!result.success) throw new Error(result.error ?? 'Update failed');
          }
          fetchCards();
        }}
        onDelete={modalMode === 'edit-rate' && modalSeed?.rate_id != null ? async () => {
          const result = await deleteDgClassChargeAction(modalSeed!.rate_id!);
          if (!result.success) throw new Error(result.error ?? 'Delete failed');
          fetchCards();
        } : undefined}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card List Component
// ---------------------------------------------------------------------------

function DgClassChargeCardList({
  cards,
  loading,
  onAction,
  onDeleteCard,
}: {
  cards: DgClassChargeCard[];
  loading: boolean;
  onAction: (seed: DgClassChargeModalSeed, mode: 'new' | 'edit-rate' | 'edit-card') => void;
  onDeleteCard: (cardKey: string) => Promise<void>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [historicalCount, setHistoricalCount] = useState(6);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [confirmDeleteCard, setConfirmDeleteCard] = useState<string | null>(null);
  const [deletingCard, setDeletingCard] = useState(false);

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
    { label: 'EXPORT', cards: cards.filter(c => c.trade_direction === 'EXPORT') },
    { label: 'IMPORT', cards: cards.filter(c => c.trade_direction === 'IMPORT') },
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
        <FlaskConical className="w-8 h-8 opacity-40" />
        <p className="text-sm">No DG class charges found for this port</p>
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
                  const hasContainer = card.container_size !== 'ALL' || card.container_type !== 'ALL';
                  const alertLevel = getDgClassChargeAlertLevel(card);

                  return (
                    <div
                      key={card.card_key}
                      className={`flex border-b border-[var(--border)] border-l-2 ${
                        alertLevel === 'cost_exceeds_price'
                          ? 'bg-red-50 hover:bg-red-100/70 border-l-red-400'
                          : alertLevel === 'no_active_cost'
                          ? 'bg-red-50 hover:bg-red-100/70 border-l-red-500'
                          : 'hover:bg-[var(--sky-mist)]/10 border-l-transparent'
                      }`}
                      style={{ minWidth: `${totalWidth}px` }}
                    >
                      {/* Left identity panel */}
                      <div className="w-[260px] shrink-0 px-3 py-2.5 flex flex-col gap-0.5 relative group">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${card.is_active ? 'bg-emerald-500' : 'bg-red-400'}`} />
                          <span className="text-sm font-semibold text-[var(--text)] truncate">{card.charge_code}</span>
                        </div>
                        <span className="text-[11px] text-[var(--text-muted)] truncate pl-3">{card.description}</span>
                        <div className="flex items-center gap-1.5 pl-3 mt-0.5 flex-wrap">
                          {directionBadge(card.trade_direction)}
                          {typeBadge(card.shipment_type)}
                          {dgClassBadge(card.dg_class_code)}
                          {hasContainer ? (
                            <span title={`${card.container_size === 'ALL' ? 'All sizes' : `${card.container_size}ft container`} / ${CONTAINER_TYPE_TOOLTIPS[card.container_type] ?? card.container_type}`} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium cursor-help">
                              {card.container_size}/{card.container_type}
                            </span>
                          ) : (
                            <span title="Applies to all container sizes and types" className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium cursor-help">ALL</span>
                          )}
                          {card.is_international && (
                            <span title="INTL \u2014 International" className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 cursor-help">INTL</span>
                          )}
                          {card.is_domestic && (
                            <span title="DOM \u2014 Domestic" className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 cursor-help">DOM</span>
                          )}
                          <span title={UOM_TOOLTIPS[card.uom] ?? card.uom} className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 cursor-help">{card.uom}</span>
                          {alertLevel === 'cost_exceeds_price' && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-200 text-red-800 font-semibold">
                              Cost exceeds price
                            </span>
                          )}
                          {alertLevel === 'no_active_cost' && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-semibold border border-red-300">
                              Cost expired
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-[var(--text-muted)]/60 pl-3">
                          {card.latest_effective_from
                            ? `Eff: ${formatDate(card.latest_effective_from)}${card.latest_effective_to ? ` \u2013 ${formatDate(card.latest_effective_to)}` : ' \u2013 ongoing'}`
                            : '\u2014'}
                        </span>
                        <div className="absolute top-2 right-2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                          {/* Edit rate (pencil) */}
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              const tsList = card.time_series ?? [];
                              const latest = tsList.length > 0
                                ? tsList.reduce((a, b) => b.month_key > a.month_key ? b : a)
                                : null;
                              onAction({
                                ...buildCardSeed(card),
                                rate_id: latest?.rate_id ?? null,
                                price: latest?.price ?? null,
                                cost: latest?.cost ?? null,
                                effective_from: card.latest_effective_from,
                                effective_to: card.latest_effective_to,
                              }, 'edit-rate');
                            }}
                            className="p-1 rounded hover:bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]"
                            title="Edit rate"
                          >
                            <Pencil size={12} />
                          </button>
                          {/* Edit card details (info) */}
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              onAction({
                                ...buildCardSeed(card),
                                rate_id: null, price: null, cost: null,
                                effective_from: null, effective_to: null,
                              }, 'edit-card');
                            }}
                            className="p-1 rounded hover:bg-[var(--surface)] text-[var(--text-muted)] hover:text-amber-500"
                            title="Edit charge details"
                          >
                            <Info size={12} />
                          </button>
                          {/* New rate (plus) */}
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              const now = new Date();
                              const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
                              const nextMonth = next.toISOString().slice(0, 10);
                              onAction({
                                ...buildCardSeed(card),
                                rate_id: null, price: null, cost: null,
                                effective_from: nextMonth, effective_to: null,
                              }, 'new');
                            }}
                            className="p-1 rounded hover:bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--sky)]"
                            title="New rate"
                          >
                            <Plus size={12} />
                          </button>
                          {/* Delete card (trash) */}
                          <button
                            onClick={e => { e.stopPropagation(); setConfirmDeleteCard(card.card_key); }}
                            className="p-1 rounded hover:bg-red-50 text-[var(--text-muted)] hover:text-red-500"
                            title="Delete card"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                        {confirmDeleteCard === card.card_key && (
                          <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-white/95 rounded-lg">
                            <span className="text-xs text-red-600 font-medium">Delete all rates for this charge?</span>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                setDeletingCard(true);
                                try {
                                  await onDeleteCard(card.card_key);
                                } catch { /* error handled by caller */ }
                                setDeletingCard(false);
                                setConfirmDeleteCard(null);
                              }}
                              disabled={deletingCard}
                              className="h-6 px-2 text-xs rounded bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50"
                            >
                              {deletingCard ? 'Deleting...' : 'Confirm'}
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setConfirmDeleteCard(null); }}
                              disabled={deletingCard}
                              className="h-6 px-2 text-xs rounded border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Right: time-series cells */}
                      <div className="flex flex-1">
                        {months.map(m => {
                          const bucket = tsMap.get(m.month_key);
                          const hasData = bucket && (bucket.price != null || bucket.cost != null);

                          if (hasData) {
                            return (
                              <div
                                key={m.month_key}
                                onClick={() => onAction({
                                  ...buildCardSeed(card),
                                  rate_id: bucket.rate_id,
                                  price: bucket.price,
                                  cost: bucket.cost,
                                  effective_from: card.latest_effective_from,
                                  effective_to: card.latest_effective_to,
                                }, 'edit-rate')}
                                className={`w-[80px] shrink-0 px-1 py-2.5 text-center cursor-pointer group/cell transition-colors ${
                                  m.isCurrentMonth ? 'bg-[var(--sky-mist)]/40 hover:bg-[var(--sky-mist)]/70' : 'hover:bg-[var(--sky-mist)]/30'
                                }`}
                              >
                                <div className={`text-xs font-medium ${
                                  m.isCurrentMonth && alertLevel === 'cost_exceeds_price' ? 'text-red-700 font-semibold' :
                                  m.isCurrentMonth && alertLevel === 'no_active_cost' ? 'text-red-600 font-semibold' :
                                  'text-[var(--text)]'
                                }`}>
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
                                <div className="mt-0.5 flex justify-center opacity-0 group-hover/cell:opacity-100 transition-opacity">
                                  <span className="w-1 h-1 rounded-full bg-[var(--sky)]/50" />
                                </div>
                              </div>
                            );
                          }

                          const [year, month] = m.month_key.split('-');
                          const overrideDate = `${year}-${month}-01`;

                          return (
                            <div
                              key={m.month_key}
                              onClick={() => onAction({
                                ...buildCardSeed(card),
                                rate_id: null, price: null, cost: null,
                                effective_from: overrideDate, effective_to: null,
                              }, 'new')}
                              className={`w-[80px] shrink-0 px-1 py-2.5 text-center cursor-pointer group/cell transition-colors ${
                                m.isCurrentMonth ? 'bg-[var(--sky-mist)]/40 hover:bg-[var(--sky-mist)]/70' : 'hover:bg-slate-50'
                              }`}
                            >
                              <div className="text-xs text-[var(--text-muted)]/40 group-hover/cell:hidden">{'\u2014'}</div>
                              <div className="hidden group-hover/cell:block text-[10px] text-[var(--sky)]/60 font-medium">+</div>
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
