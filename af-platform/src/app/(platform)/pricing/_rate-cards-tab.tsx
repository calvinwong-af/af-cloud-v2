'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Ship } from 'lucide-react';
import {
  fetchPricingCountriesAction,
  fetchFCLRateCardsAction,
  fetchLCLRateCardsAction,
  fetchFCLOriginsAction,
  fetchLCLOriginsAction,
} from '@/app/actions/pricing';
import type { PricingCountry, RateCard } from '@/app/actions/pricing';
import { fetchCompaniesAction } from '@/app/actions/companies';
import { fetchPortsAction } from '@/app/actions/shipments';
import { PortCombobox } from '@/components/shared/PortCombobox';
import { ToggleSwitch } from './_components';
import { TimeSeriesRateList } from './_rate-list';

export function FCLRateCardsTab({ countryCode, alertFilter }: { countryCode?: string; alertFilter?: string }) {
  const [countries, setCountries] = useState<PricingCountry[]>([]);
  const [country, setCountry] = useState(countryCode ?? '');
  const [cards, setCards] = useState<RateCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [originOptions, setOriginOptions] = useState<string[]>([]);
  const [originFilter, setOriginFilter] = useState('');
  const [textFilter, setTextFilter] = useState('');
  const [sizeFilter, setSizeFilter] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [showIssuesOnly, setShowIssuesOnly] = useState(!!alertFilter);
  const [portsMap, setPortsMap] = useState<Record<string, { name: string; country_name: string }>>({});
  const [companiesMap, setCompaniesMap] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchPricingCountriesAction().then(r => {
      if (r?.success) setCountries(r.data);
    });
    fetchPortsAction().then(portsData => {
      const map: Record<string, { name: string; country_name: string }> = {};
      for (const p of portsData) { map[p.un_code] = { name: p.name, country_name: p.country_name }; }
      setPortsMap(map);
    });
    fetchCompaniesAction({ limit: 500 }).then(r => {
      if (r?.success) {
        const map: Record<string, string> = {};
        for (const c of r.data) { map[c.company_id] = c.name; }
        setCompaniesMap(map);
      }
    });
  }, []);

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
    if (!originFilter && !showIssuesOnly) {
      setCards([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchFCLRateCardsAction({
      countryCode: country || undefined,
      originPort: showIssuesOnly ? undefined : originFilter || undefined,
      containerSize: sizeFilter || undefined,
      isActive: showInactive ? undefined : true,
      alertsOnly: showIssuesOnly || undefined,
    }).then(r => {
      if (r?.success) setCards(r.data);
      setLoading(false);
    });
  }, [country, originFilter, sizeFilter, showInactive, showIssuesOnly]);

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
      </div>
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

      {!originFilter && !showIssuesOnly ? (
        <div className="bg-white rounded-xl border border-[var(--border)] py-16 flex flex-col items-center gap-3 text-[var(--text-muted)]">
          <Ship className="w-8 h-8 opacity-40" />
          <p className="text-sm">Select an origin port to view rate cards</p>
        </div>
      ) : (
        <>
          <TimeSeriesRateList
            cards={filteredCards}
            loading={loading}
            showContainer
            portsMap={portsMap}
            mode="fcl"
            companiesMap={companiesMap}
            onCardsRefresh={fetchCards}
          />
          <div className="text-xs text-[var(--text-muted)]">
            {showIssuesOnly
              ? `${filteredCards.length} card${filteredCards.length !== 1 ? 's' : ''} with issues`
              : `${filteredCards.length}${filteredCards.length !== cards.length ? ` of ${cards.length}` : ''} rate cards`
            }
          </div>
        </>
      )}
    </div>
  );
}

export function LCLRateCardsTab({ countryCode, alertFilter }: { countryCode?: string; alertFilter?: string }) {
  const [countries, setCountries] = useState<PricingCountry[]>([]);
  const [country, setCountry] = useState(countryCode ?? '');
  const [cards, setCards] = useState<RateCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [originOptions, setOriginOptions] = useState<string[]>([]);
  const [originFilter, setOriginFilter] = useState('');
  const [textFilter, setTextFilter] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [showIssuesOnly, setShowIssuesOnly] = useState(!!alertFilter);
  const [portsMap, setPortsMap] = useState<Record<string, { name: string; country_name: string }>>({});
  const [companiesMap, setCompaniesMap] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchPricingCountriesAction().then(r => {
      if (r?.success) setCountries(r.data);
    });
    fetchPortsAction().then(portsData => {
      const map: Record<string, { name: string; country_name: string }> = {};
      for (const p of portsData) { map[p.un_code] = { name: p.name, country_name: p.country_name }; }
      setPortsMap(map);
    });
    fetchCompaniesAction({ limit: 500 }).then(r => {
      if (r?.success) {
        const map: Record<string, string> = {};
        for (const c of r.data) { map[c.company_id] = c.name; }
        setCompaniesMap(map);
      }
    });
  }, []);

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
    if (!originFilter && !showIssuesOnly) {
      setCards([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchLCLRateCardsAction({
      countryCode: country || undefined,
      originPort: showIssuesOnly ? undefined : originFilter || undefined,
      isActive: showInactive ? undefined : true,
      alertsOnly: showIssuesOnly || undefined,
    }).then(r => {
      if (r?.success) setCards(r.data);
      setLoading(false);
    });
  }, [country, originFilter, showInactive, showIssuesOnly]);

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
        (c.dg_class_code ?? '').toLowerCase().includes(q) ||
        (c.terminal_id ?? '').toLowerCase().includes(q)
      );
    });
  }, [cards, textFilter, portsMap]);

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
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-56">
          <PortCombobox value={country} onChange={setCountry} options={countryOptions} placeholder="All Countries" />
        </div>
        <div className="w-44">
          <PortCombobox value={originFilter} onChange={setOriginFilter} options={originComboOptions} placeholder="All Origins" />
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
      </div>
      <div className="relative">
        <input
          type="text"
          value={textFilter}
          onChange={e => setTextFilter(e.target.value)}
          placeholder="Filter by destination, DG class, terminal…"
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

      {!originFilter && !showIssuesOnly ? (
        <div className="bg-white rounded-xl border border-[var(--border)] py-16 flex flex-col items-center gap-3 text-[var(--text-muted)]">
          <Ship className="w-8 h-8 opacity-40" />
          <p className="text-sm">Select an origin port to view rate cards</p>
        </div>
      ) : (
        <>
          <TimeSeriesRateList
            cards={filteredCards}
            loading={loading}
            showContainer={false}
            portsMap={portsMap}
            mode="lcl"
            companiesMap={companiesMap}
            onCardsRefresh={fetchCards}
          />
          <div className="text-xs text-[var(--text-muted)]">
            {showIssuesOnly
              ? `${filteredCards.length} card${filteredCards.length !== 1 ? 's' : ''} with issues`
              : `${filteredCards.length}${filteredCards.length !== cards.length ? ` of ${cards.length}` : ''} rate cards`
            }
          </div>
        </>
      )}
    </div>
  );
}
