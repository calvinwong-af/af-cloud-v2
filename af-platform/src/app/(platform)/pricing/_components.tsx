'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Ship, Package, Plane, MapPin, FileCheck, Truck, Car, Lock,
  Loader2, ChevronDown, ChevronRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  fetchPricingCountriesAction,
  fetchPricingDashboardSummaryAction,
  fetchFCLRateCardsAction,
  fetchFCLRateCardDetailAction,
  fetchLCLRateCardsAction,
  fetchLCLRateCardDetailAction,
  fetchFCLOriginsAction,
  fetchLCLOriginsAction,
} from '@/app/actions/pricing';
import type {
  PricingCountry,
  DashboardSummary,
  RateCard,
  RateDetail,
} from '@/app/actions/pricing';
import { fetchPortsAction } from '@/app/actions/shipments';
import { PortCombobox } from '@/components/shared/PortCombobox';

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const thCls = "px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide";
const tdCls = "px-4 py-3 text-sm text-[var(--text)]";

// ---------------------------------------------------------------------------
// Toggle Switch
// ---------------------------------------------------------------------------

function ToggleSwitch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 shrink-0"
    >
      <div className={`w-8 h-4 rounded-full transition-colors relative ${checked ? 'bg-[var(--sky)]' : 'bg-[var(--border)]'}`}>
        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </div>
      <span className="text-xs text-[var(--text-muted)]">{label}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

interface PricingComponent {
  key: string;
  label: string;
  icon: LucideIcon;
  href: string;
  locked: boolean;
}

const PRICING_COMPONENTS: PricingComponent[] = [
  { key: 'fcl',            label: 'FCL Ocean Freight',   icon: Ship,      href: '/pricing/fcl',              locked: false },
  { key: 'lcl',            label: 'LCL Ocean Freight',   icon: Package,   href: '/pricing/lcl',              locked: false },
  { key: 'air',            label: 'Air Freight',          icon: Plane,     href: '/pricing/air',              locked: true  },
  { key: 'local-charges',  label: 'Local Charges',        icon: MapPin,    href: '/pricing/local-charges',    locked: true  },
  { key: 'customs',        label: 'Customs Clearance',    icon: FileCheck, href: '/pricing/customs',          locked: true  },
  { key: 'haulage',        label: 'Haulage',              icon: Truck,     href: '/pricing/haulage',          locked: true  },
  { key: 'transportation', label: 'Transportation',        icon: Car,       href: '/pricing/transportation',   locked: true  },
];

function formatDate(d: string | null): string {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function PricingDashboard() {
  const [countries, setCountries] = useState<PricingCountry[]>([]);
  const [country, setCountry] = useState('MY');
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPricingCountriesAction().then(r => {
      if (r?.success) setCountries(r.data);
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchPricingDashboardSummaryAction(country || undefined).then(r => {
      if (r?.success) setSummary(r.data);
      setLoading(false);
    });
  }, [country]);

  const countryOptions = [
    { value: '', label: 'All Countries' },
    ...countries.filter(c => c.country_code && c.country_name).map(c => ({ value: c.country_code, label: `${c.country_code} — ${c.country_name}` })),
  ];

  return (
    <div className="space-y-6">
      {/* Country filter */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-[var(--text-muted)]">Country</span>
        <div className="w-64">
          <PortCombobox
            value={country}
            onChange={setCountry}
            options={countryOptions}
            placeholder="All Countries"
          />
        </div>
      </div>

      {/* Card grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {PRICING_COMPONENTS.map(comp => {
          if (comp.locked) {
            return <LockedCard key={comp.key} comp={comp} />;
          }
          const stats = summary?.[comp.key as keyof DashboardSummary] ?? null;
          return (
            <ActiveCard
              key={comp.key}
              comp={comp}
              stats={stats}
              loading={loading}
              country={country}
            />
          );
        })}
      </div>
    </div>
  );
}

function ActiveCard({
  comp,
  stats,
  loading,
  country,
}: {
  comp: PricingComponent;
  stats: { total_cards: number; last_updated: string | null; expiring_soon: number } | null;
  loading: boolean;
  country: string;
}) {
  const Icon = comp.icon;
  const href = country ? `${comp.href}?country=${country}` : comp.href;

  return (
    <Link
      href={href}
      className="bg-white rounded-xl border border-[var(--border)] p-5 hover:border-[var(--sky)]/30 hover:shadow-sm transition-all"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[var(--sky-mist)] flex items-center justify-center">
            <Icon size={16} className="text-[var(--sky)]" />
          </div>
          <span className="text-sm font-semibold text-[var(--text)]">{comp.label}</span>
        </div>
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">Live</span>
      </div>

      {/* Stats */}
      {loading || !stats ? (
        <div className="space-y-3">
          <div className="h-8 w-20 bg-[var(--surface)] rounded animate-pulse" />
          <div className="h-4 w-32 bg-[var(--surface)] rounded animate-pulse" />
          <div className="h-4 w-28 bg-[var(--surface)] rounded animate-pulse" />
        </div>
      ) : (
        <div className="space-y-2">
          <div>
            <span className="text-2xl font-bold text-[var(--text)]">{stats.total_cards}</span>
            <span className="text-xs text-[var(--text-muted)] ml-1.5">Rate Cards</span>
          </div>
          <div className="text-xs text-[var(--text-muted)]">
            Last Updated: {formatDate(stats.last_updated)}
          </div>
          {stats.expiring_soon > 0 ? (
            <div className="text-xs font-medium px-2 py-1 rounded-md bg-amber-50 text-amber-600 inline-block">
              {stats.expiring_soon} cards need attention
            </div>
          ) : (
            <div className="text-xs font-medium px-2 py-1 rounded-md bg-emerald-50 text-emerald-600 inline-block">
              Up to date
            </div>
          )}
        </div>
      )}
    </Link>
  );
}

function LockedCard({ comp }: { comp: PricingComponent }) {
  const Icon = comp.icon;
  return (
    <div className="bg-white rounded-xl border border-[var(--border)] p-5 opacity-50 cursor-not-allowed pointer-events-none">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[var(--surface)] flex items-center justify-center">
            <Icon size={16} className="text-[var(--text-muted)]" />
          </div>
          <span className="text-sm font-semibold text-[var(--text)]">{comp.label}</span>
        </div>
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Coming Soon</span>
      </div>
      <div className="flex items-center justify-center gap-2 py-6 text-[var(--text-muted)]">
        <Lock className="w-4 h-4" />
        <span className="text-sm">Not yet available</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FCL Rate Cards Tab
// ---------------------------------------------------------------------------

export function FCLRateCardsTab({ countryCode }: { countryCode?: string }) {
  const [countries, setCountries] = useState<PricingCountry[]>([]);
  const [country, setCountry] = useState(countryCode ?? '');
  const [cards, setCards] = useState<RateCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [originOptions, setOriginOptions] = useState<string[]>([]);
  const [originFilter, setOriginFilter] = useState('');
  const [textFilter, setTextFilter] = useState('');
  const [sizeFilter, setSizeFilter] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedRates, setExpandedRates] = useState<Record<string, RateDetail[]> | null>(null);
  const [expandLoading, setExpandLoading] = useState(false);
  const [portsMap, setPortsMap] = useState<Record<string, { name: string; country_name: string }>>({});

  useEffect(() => {
    fetchPricingCountriesAction().then(r => {
      if (r?.success) setCountries(r.data);
    });
    fetchPortsAction().then(portsData => {
      const map: Record<string, { name: string; country_name: string }> = {};
      for (const p of portsData) { map[p.un_code] = { name: p.name, country_name: p.country_name }; }
      setPortsMap(map);
    });
  }, []);

  // Fetch origin options on mount and when country changes
  const prevCountry = useRef(country);
  useEffect(() => {
    if (prevCountry.current !== country) {
      setOriginFilter('');
      setTextFilter('');
      prevCountry.current = country;
    }
    fetchFCLOriginsAction(country || undefined).then(r => {
      if (r?.success) setOriginOptions(r.data);
    });
  }, [country]);

  const fetchCards = useCallback(() => {
    if (!originFilter) {
      setCards([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setExpandedId(null);
    setExpandedRates(null);
    fetchFCLRateCardsAction({
      countryCode: country || undefined,
      originPort: originFilter,
      containerSize: sizeFilter || undefined,
      isActive: showInactive ? undefined : true,
    }).then(r => {
      if (r?.success) setCards(r.data);
      setLoading(false);
    });
  }, [country, originFilter, sizeFilter, showInactive]);

  useEffect(() => { fetchCards(); }, [fetchCards]);

  const filteredCards = useMemo(() => {
    if (!textFilter.trim()) return cards;
    const q = textFilter.trim().toLowerCase();
    return cards.filter(c => {
      const dest = portsMap[c.destination_port_code];
      return (
        c.destination_port_code.toLowerCase().includes(q) ||
        (dest?.name ?? '').toLowerCase().includes(q) ||
        (dest?.country_name ?? '').toLowerCase().includes(q) ||
        (c.container_size ?? '').toLowerCase().includes(q) ||
        (c.container_type ?? '').toLowerCase().includes(q) ||
        (c.dg_class_code ?? '').toLowerCase().includes(q) ||
        (c.terminal_id ?? '').toLowerCase().includes(q)
      );
    });
  }, [cards, textFilter, portsMap]);

  function handleExpand(cardId: number) {
    if (expandedId === cardId) {
      setExpandedId(null);
      setExpandedRates(null);
      return;
    }
    setExpandedId(cardId);
    setExpandedRates(null);
    setExpandLoading(true);
    fetchFCLRateCardDetailAction(cardId).then(r => {
      if (r?.success) {
        setExpandedRates(r.data.rates_by_supplier);
      }
      setExpandLoading(false);
    });
  }

  const originComboOptions = [
    { value: '', label: 'All Origins' },
    ...originOptions.map(code => ({ value: code, label: code, sublabel: portsMap[code]?.name ?? '' })),
  ];

  const countryOptions = [
    { value: '', label: 'All Countries' },
    ...countries.filter(c => c.country_code && c.country_name).map(c => ({ value: c.country_code, label: `${c.country_code} — ${c.country_name}` })),
  ];

  const sizeOptions = [
    { value: '', label: 'All Sizes' },
    { value: '20GP', label: '20GP' },
    { value: '40GP', label: '40GP' },
    { value: '40HC', label: '40HC' },
    { value: '45HC', label: '45HC' },
  ];

  return (
    <div className="space-y-4">
      {/* Filter bar — Row 1 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-56">
          <PortCombobox value={country} onChange={setCountry} options={countryOptions} placeholder="All Countries" />
        </div>
        <div className="w-44">
          <PortCombobox value={originFilter} onChange={setOriginFilter} options={originComboOptions} placeholder="All Origins" />
        </div>
        <div className="w-36">
          <PortCombobox value={sizeFilter} onChange={setSizeFilter} options={sizeOptions} placeholder="All Sizes" />
        </div>
        <ToggleSwitch checked={showInactive} onChange={setShowInactive} label="Show inactive" />
      </div>
      {/* Filter bar — Row 2: General text filter */}
      <div className="relative">
        <input
          type="text"
          value={textFilter}
          onChange={e => setTextFilter(e.target.value)}
          placeholder="Filter by destination, size, DG class, terminal…"
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

      {/* Table or empty state */}
      {!originFilter ? (
        <div className="bg-white rounded-xl border border-[var(--border)] py-16 flex flex-col items-center gap-3 text-[var(--text-muted)]">
          <Ship className="w-8 h-8 opacity-40" />
          <p className="text-sm">Select an origin port to view rate cards</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-[var(--border)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--surface)]">
                  <tr>
                    <th className={thCls}>Origin</th>
                    <th className={thCls}>Destination</th>
                    <th className={thCls}>Container</th>
                    <th className={thCls}>DG Class</th>
                    <th className={thCls}>Terminal</th>
                    <th className={thCls}>Latest Price</th>
                    <th className={thCls}>Last Updated</th>
                    <th className={thCls}>Active</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {loading ? (
                    <tr><td colSpan={8} className="py-12 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-[var(--text-muted)]" /></td></tr>
                  ) : filteredCards.length === 0 ? (
                    <tr><td colSpan={8} className="py-8 text-center text-sm text-[var(--text-muted)]">No rate cards found</td></tr>
                  ) : (
                    filteredCards.map(c => (
                      <RateCardRow
                        key={c.id}
                        card={c}
                        showContainer
                        expanded={expandedId === c.id}
                        expandedRates={expandedId === c.id ? expandedRates : null}
                        expandLoading={expandedId === c.id && expandLoading}
                        onToggle={() => handleExpand(c.id)}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="text-xs text-[var(--text-muted)]">
            {filteredCards.length}{filteredCards.length !== cards.length ? ` of ${cards.length}` : ''} rate cards
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// LCL Rate Cards Tab
// ---------------------------------------------------------------------------

export function LCLRateCardsTab({ countryCode }: { countryCode?: string }) {
  const [countries, setCountries] = useState<PricingCountry[]>([]);
  const [country, setCountry] = useState(countryCode ?? '');
  const [cards, setCards] = useState<RateCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [originOptions, setOriginOptions] = useState<string[]>([]);
  const [originFilter, setOriginFilter] = useState('');
  const [textFilter, setTextFilter] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedRates, setExpandedRates] = useState<Record<string, RateDetail[]> | null>(null);
  const [expandLoading, setExpandLoading] = useState(false);
  const [portsMap, setPortsMap] = useState<Record<string, { name: string; country_name: string }>>({});

  useEffect(() => {
    fetchPricingCountriesAction().then(r => {
      if (r?.success) setCountries(r.data);
    });
    fetchPortsAction().then(portsData => {
      const map: Record<string, { name: string; country_name: string }> = {};
      for (const p of portsData) { map[p.un_code] = { name: p.name, country_name: p.country_name }; }
      setPortsMap(map);
    });
  }, []);

  // Fetch origin options on mount and when country changes
  const prevCountry = useRef(country);
  useEffect(() => {
    if (prevCountry.current !== country) {
      setOriginFilter('');
      setTextFilter('');
      prevCountry.current = country;
    }
    fetchLCLOriginsAction(country || undefined).then(r => {
      if (r?.success) setOriginOptions(r.data);
    });
  }, [country]);

  const fetchCards = useCallback(() => {
    if (!originFilter) {
      setCards([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setExpandedId(null);
    setExpandedRates(null);
    fetchLCLRateCardsAction({
      countryCode: country || undefined,
      originPort: originFilter,
      isActive: showInactive ? undefined : true,
    }).then(r => {
      if (r?.success) setCards(r.data);
      setLoading(false);
    });
  }, [country, originFilter, showInactive]);

  useEffect(() => { fetchCards(); }, [fetchCards]);

  const filteredCards = useMemo(() => {
    if (!textFilter.trim()) return cards;
    const q = textFilter.trim().toLowerCase();
    return cards.filter(c => {
      const dest = portsMap[c.destination_port_code];
      return (
        c.destination_port_code.toLowerCase().includes(q) ||
        (dest?.name ?? '').toLowerCase().includes(q) ||
        (dest?.country_name ?? '').toLowerCase().includes(q) ||
        (c.container_size ?? '').toLowerCase().includes(q) ||
        (c.container_type ?? '').toLowerCase().includes(q) ||
        (c.dg_class_code ?? '').toLowerCase().includes(q) ||
        (c.terminal_id ?? '').toLowerCase().includes(q)
      );
    });
  }, [cards, textFilter, portsMap]);

  function handleExpand(cardId: number) {
    if (expandedId === cardId) {
      setExpandedId(null);
      setExpandedRates(null);
      return;
    }
    setExpandedId(cardId);
    setExpandedRates(null);
    setExpandLoading(true);
    fetchLCLRateCardDetailAction(cardId).then(r => {
      if (r?.success) {
        setExpandedRates(r.data.rates_by_supplier);
      }
      setExpandLoading(false);
    });
  }

  const originComboOptions = [
    { value: '', label: 'All Origins' },
    ...originOptions.map(code => ({ value: code, label: code, sublabel: portsMap[code]?.name ?? '' })),
  ];

  const countryOptions = [
    { value: '', label: 'All Countries' },
    ...countries.filter(c => c.country_code && c.country_name).map(c => ({ value: c.country_code, label: `${c.country_code} — ${c.country_name}` })),
  ];

  return (
    <div className="space-y-4">
      {/* Filter bar — Row 1 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-56">
          <PortCombobox value={country} onChange={setCountry} options={countryOptions} placeholder="All Countries" />
        </div>
        <div className="w-44">
          <PortCombobox value={originFilter} onChange={setOriginFilter} options={originComboOptions} placeholder="All Origins" />
        </div>
        <ToggleSwitch checked={showInactive} onChange={setShowInactive} label="Show inactive" />
      </div>
      {/* Filter bar — Row 2: General text filter */}
      <div className="relative">
        <input
          type="text"
          value={textFilter}
          onChange={e => setTextFilter(e.target.value)}
          placeholder="Filter by destination, size, DG class, terminal…"
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

      {/* Table or empty state */}
      {!originFilter ? (
        <div className="bg-white rounded-xl border border-[var(--border)] py-16 flex flex-col items-center gap-3 text-[var(--text-muted)]">
          <Ship className="w-8 h-8 opacity-40" />
          <p className="text-sm">Select an origin port to view rate cards</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-[var(--border)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--surface)]">
                  <tr>
                    <th className={thCls}>Origin</th>
                    <th className={thCls}>Destination</th>
                    <th className={thCls}>DG Class</th>
                    <th className={thCls}>Terminal</th>
                    <th className={thCls}>Latest Price</th>
                    <th className={thCls}>Last Updated</th>
                    <th className={thCls}>Active</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {loading ? (
                    <tr><td colSpan={7} className="py-12 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-[var(--text-muted)]" /></td></tr>
                  ) : filteredCards.length === 0 ? (
                    <tr><td colSpan={7} className="py-8 text-center text-sm text-[var(--text-muted)]">No rate cards found</td></tr>
                  ) : (
                    filteredCards.map(c => (
                      <RateCardRow
                        key={c.id}
                        card={c}
                        showContainer={false}
                        expanded={expandedId === c.id}
                        expandedRates={expandedId === c.id ? expandedRates : null}
                        expandLoading={expandedId === c.id && expandLoading}
                        onToggle={() => handleExpand(c.id)}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="text-xs text-[var(--text-muted)]">
            {filteredCards.length}{filteredCards.length !== cards.length ? ` of ${cards.length}` : ''} rate cards
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared rate card row + expand panel
// ---------------------------------------------------------------------------

function RateCardRow({
  card,
  showContainer,
  expanded,
  expandedRates,
  expandLoading,
  onToggle,
}: {
  card: RateCard;
  showContainer: boolean;
  expanded: boolean;
  expandedRates: Record<string, RateDetail[]> | null;
  expandLoading: boolean;
  onToggle: () => void;
}) {
  const colSpan = showContainer ? 8 : 7;
  const ref = card.latest_price_ref;
  const priceLabel = ref?.list_price != null
    ? `${ref.currency} ${ref.list_price.toLocaleString()}`
    : '—';

  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer hover:bg-[var(--sky-mist)]/30 transition-colors"
      >
        <td className={tdCls}>
          <div className="flex items-center gap-1">
            {expanded ? <ChevronDown size={12} className="text-[var(--text-muted)]" /> : <ChevronRight size={12} className="text-[var(--text-muted)]" />}
            {card.origin_port_code}
          </div>
        </td>
        <td className={tdCls}>{card.destination_port_code}</td>
        {showContainer && <td className={tdCls}>{card.container_size ?? ''}{card.container_type ? ` ${card.container_type}` : ''}</td>}
        <td className={tdCls}>{card.dg_class_code}</td>
        <td className={tdCls}>{card.terminal_id ?? '—'}</td>
        <td className={tdCls}>{priceLabel}</td>
        <td className={tdCls}>{formatDate(card.updated_at)}</td>
        <td className={tdCls}>
          {card.is_active
            ? <span className="text-emerald-600 text-xs font-medium">Yes</span>
            : <span className="text-red-400 text-xs font-medium">No</span>}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={colSpan} className="px-4 py-3 bg-[var(--surface)]">
            {expandLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-4 h-4 animate-spin text-[var(--text-muted)]" />
              </div>
            ) : expandedRates ? (
              <RateHistoryPanel rates={expandedRates} />
            ) : (
              <div className="text-xs text-[var(--text-muted)] text-center py-4">No rate data</div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function RateHistoryPanel({ rates }: { rates: Record<string, RateDetail[]> }) {
  const allRates: RateDetail[] = [];
  for (const key of Object.keys(rates)) {
    allRates.push(...rates[key]);
  }

  if (allRates.length === 0) {
    return <div className="text-xs text-[var(--text-muted)] text-center py-4">No rates recorded</div>;
  }

  // Sort by effective_from DESC
  allRates.sort((a, b) => {
    const da = a.effective_from ?? '';
    const db = b.effective_from ?? '';
    return db.localeCompare(da);
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-[var(--text-muted)]">
            <th className="px-3 py-2 text-left font-medium">Effective From</th>
            <th className="px-3 py-2 text-left font-medium">Status</th>
            <th className="px-3 py-2 text-left font-medium">Supplier</th>
            <th className="px-3 py-2 text-right font-medium">Currency</th>
            <th className="px-3 py-2 text-right font-medium">List Price</th>
            <th className="px-3 py-2 text-right font-medium">Min List</th>
            <th className="px-3 py-2 text-right font-medium">Cost</th>
            <th className="px-3 py-2 text-right font-medium">Min Cost</th>
            <th className="px-3 py-2 text-right font-medium">LSS</th>
            <th className="px-3 py-2 text-right font-medium">BAF</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {allRates.map(r => (
            <tr key={r.id} className="hover:bg-white/60">
              <td className="px-3 py-1.5">{formatDate(r.effective_from)}</td>
              <td className="px-3 py-1.5">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${r.rate_status === 'PUBLISHED' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                  {r.rate_status}
                </span>
              </td>
              <td className="px-3 py-1.5">{r.supplier_id ?? 'Price Ref'}</td>
              <td className="px-3 py-1.5 text-right">{r.currency}</td>
              <td className="px-3 py-1.5 text-right">{r.list_price?.toLocaleString() ?? '—'}</td>
              <td className="px-3 py-1.5 text-right">{r.min_list_price?.toLocaleString() ?? '—'}</td>
              <td className="px-3 py-1.5 text-right">{r.cost?.toLocaleString() ?? '—'}</td>
              <td className="px-3 py-1.5 text-right">{r.min_cost?.toLocaleString() ?? '—'}</td>
              <td className="px-3 py-1.5 text-right">{r.lss?.toLocaleString() ?? '—'}</td>
              <td className="px-3 py-1.5 text-right">{r.baf?.toLocaleString() ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
