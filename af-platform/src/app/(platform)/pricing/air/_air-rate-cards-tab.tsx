'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Plane } from 'lucide-react';
import {
  fetchPricingCountriesAction,
  fetchAirRateCardsAction,
  fetchAirOriginsAction,
  fetchAirAirlinesAction,
} from '@/app/actions/pricing';
import type { PricingCountry, AirRateCard } from '@/app/actions/pricing';
import { fetchCompaniesAction } from '@/app/actions/companies';
import { fetchPortsAction } from '@/app/actions/shipments';
import { PortCombobox } from '@/components/shared/PortCombobox';
import { ToggleSwitch } from '../_components';
import { AirTimeSeriesRateList } from './_air-rate-list';

export function AirRateCardsTab({ countryCode, alertFilter }: { countryCode?: string; alertFilter?: string }) {
  const [countries, setCountries] = useState<PricingCountry[]>([]);
  const [country, setCountry] = useState(countryCode ?? '');
  const [cards, setCards] = useState<AirRateCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [originOptions, setOriginOptions] = useState<string[]>([]);
  const [originFilter, setOriginFilter] = useState('');
  const [airlineOptions, setAirlineOptions] = useState<string[]>([]);
  const [airlineFilter, setAirlineFilter] = useState('');
  const [textFilter, setTextFilter] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [showIssuesOnly, setShowIssuesOnly] = useState(!!alertFilter);
  const [portsMap, setPortsMap] = useState<Record<string, { name: string; country_name: string }>>({});
  const [companiesMap, setCompaniesMap] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

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
      setAirlineFilter('');
      setTextFilter('');
      prevCountry.current = country;
    }
    fetchAirOriginsAction(country || undefined).then(r => {
      if (r?.success) setOriginOptions(r.data);
    });
  }, [country]);

  useEffect(() => {
    if (originFilter) {
      fetchAirAirlinesAction(originFilter).then(r => {
        if (r?.success) setAirlineOptions(r.data);
      });
    } else {
      setAirlineOptions([]);
      setAirlineFilter('');
    }
  }, [originFilter]);

  const fetchCards = useCallback(() => {
    if (!originFilter && !showIssuesOnly) {
      setCards([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchAirRateCardsAction({
      countryCode: country || undefined,
      originPortCode: showIssuesOnly ? undefined : originFilter || undefined,
      airlineCode: airlineFilter || undefined,
      isActive: showInactive ? undefined : true,
      alertsOnly: showIssuesOnly || undefined,
    }).then(r => {
      if (r?.success) setCards(r.data);
      setLoading(false);
    });
  }, [country, originFilter, airlineFilter, showInactive, showIssuesOnly]);

  useEffect(() => { fetchCards(); }, [fetchCards]);

  const filteredCards = useMemo(() => {
    if (!textFilter.trim()) return cards;
    const q = textFilter.trim().toLowerCase();
    return cards.filter(c =>
      c.origin_port_code.toLowerCase().includes(q) ||
      c.destination_port_code.toLowerCase().includes(q) ||
      c.airline_code.toLowerCase().includes(q) ||
      c.dg_class_code.toLowerCase().includes(q) ||
      c.rate_card_key.toLowerCase().includes(q) ||
      (portsMap[c.origin_port_code]?.name ?? '').toLowerCase().includes(q) ||
      (portsMap[c.destination_port_code]?.name ?? '').toLowerCase().includes(q)
    );
  }, [cards, textFilter, portsMap]);

  useEffect(() => { setPage(1); }, [filteredCards]);

  const pagedCards = useMemo(
    () => filteredCards.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredCards, page, PAGE_SIZE]
  );
  const totalPages = Math.ceil(filteredCards.length / PAGE_SIZE);

  const companiesList = useMemo(() =>
    Object.entries(companiesMap).map(([id, name]) => ({ company_id: id, name })),
    [companiesMap]);

  const originComboOptions = [
    { value: '', label: 'All Origins' },
    ...originOptions.map(code => ({ value: code, label: code, sublabel: portsMap[code]?.name ?? '' })),
  ];

  const countryOptions = [
    { value: '', label: 'All Countries' },
    ...countries.filter(c => c.country_code && c.country_name).map(c => ({ value: c.country_code, label: `${c.country_code} — ${c.country_name}` })),
  ];

  const airlineComboOptions = [
    { value: '', label: 'All Airlines' },
    ...airlineOptions.map(code => ({ value: code, label: code })),
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
        <div className="w-40">
          <PortCombobox value={airlineFilter} onChange={setAirlineFilter} options={airlineComboOptions} placeholder="All Airlines" />
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
          placeholder="Filter by origin, destination, airline, DG class, rate card key…"
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
          <Plane className="w-8 h-8 opacity-40" />
          <p className="text-sm">Select an origin port to view air freight rate cards</p>
        </div>
      ) : (
        <>
          <AirTimeSeriesRateList
            cards={pagedCards}
            loading={loading}
            portsMap={portsMap}
            companiesMap={companiesMap}
            companiesList={companiesList}
            onCardsRefresh={fetchCards}
          />
          <div className="flex items-center justify-between">
            <div className="text-xs text-[var(--text-muted)]">
              {showIssuesOnly
                ? `${filteredCards.length} card${filteredCards.length !== 1 ? 's' : ''} with issues`
                : `${filteredCards.length}${filteredCards.length !== cards.length ? ` of ${cards.length}` : ''} rate cards`
              }
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="h-7 px-2.5 text-xs rounded border border-[var(--border)] bg-white hover:bg-[var(--surface)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Prev
                </button>
                <span className="text-xs text-[var(--text-muted)]">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="h-7 px-2.5 text-xs rounded border border-[var(--border)] bg-white hover:bg-[var(--surface)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
