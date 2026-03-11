'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Car } from 'lucide-react';
import {
  fetchPricingCountriesAction,
  fetchPortTransportRateCardsAction,
  fetchPortTransportPortsAction,
  fetchPortTransportAreasAction,
  fetchPortTransportVehicleTypesAction,
} from '@/app/actions/pricing';
import type { PricingCountry, PortTransportRateCard, PortTransportArea, VehicleType } from '@/app/actions/pricing';
import { fetchCompaniesAction } from '@/app/actions/companies';
import { fetchPortsAction } from '@/app/actions/shipments';
import { PortCombobox } from '@/components/shared/PortCombobox';
import { ToggleSwitch } from '../_components';
import { PortTransportTimeSeriesRateList } from './_port-transport-rate-list';

export function PortTransportRateCardsTab({ countryCode, alertFilter }: { countryCode?: string; alertFilter?: string }) {
  const [countries, setCountries] = useState<PricingCountry[]>([]);
  const [country, setCountry] = useState(countryCode ?? '');
  const [cards, setCards] = useState<PortTransportRateCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [portOptions, setPortOptions] = useState<string[]>([]);
  const [portFilter, setPortFilter] = useState('');
  const [areaOptions, setAreaOptions] = useState<PortTransportArea[]>([]);
  const [areaFilter, setAreaFilter] = useState('');
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [vehicleFilter, setVehicleFilter] = useState('');
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
    fetchPortTransportVehicleTypesAction().then(r => {
      if (r?.success) setVehicleTypes(r.data);
    });
  }, []);

  const prevCountry = useRef(country);
  useEffect(() => {
    if (prevCountry.current !== country) {
      setPortFilter('');
      setAreaFilter('');
      setTextFilter('');
      prevCountry.current = country;
    }
    fetchPortTransportPortsAction(country || undefined).then(r => {
      if (r?.success) setPortOptions(r.data);
    });
  }, [country]);

  useEffect(() => {
    if (portFilter) {
      fetchPortTransportAreasAction(portFilter).then(r => {
        if (r?.success) setAreaOptions(r.data);
      });
    } else {
      setAreaOptions([]);
      setAreaFilter('');
    }
  }, [portFilter]);

  const fetchCards = useCallback(() => {
    if (!portFilter && !showIssuesOnly) {
      setCards([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchPortTransportRateCardsAction({
      countryCode: country || undefined,
      portUnCode: showIssuesOnly ? undefined : portFilter || undefined,
      areaId: areaFilter ? parseInt(areaFilter) : undefined,
      vehicleTypeId: vehicleFilter || undefined,
      isActive: showInactive ? undefined : true,
      alertsOnly: showIssuesOnly || undefined,
    }).then(r => {
      if (r?.success) setCards(r.data);
      setLoading(false);
    });
  }, [country, portFilter, areaFilter, vehicleFilter, showInactive, showIssuesOnly]);

  useEffect(() => { fetchCards(); }, [fetchCards]);

  const filteredCards = useMemo(() => {
    if (!textFilter.trim()) return cards;
    const q = textFilter.trim().toLowerCase();
    return cards.filter(c => {
      const stateCode = c.area_code ? c.area_code.split('-').slice(0, 2).join('-') : '';
      return (
        (c.area_name ?? '').toLowerCase().includes(q) ||
        (c.area_code ?? '').toLowerCase().includes(q) ||
        stateCode.toLowerCase().includes(q) ||
        (c.state_name ?? '').toLowerCase().includes(q) ||
        (c.vehicle_type_label ?? '').toLowerCase().includes(q) ||
        (c.vehicle_type_id ?? '').toLowerCase().includes(q) ||
        c.port_un_code.toLowerCase().includes(q) ||
        c.rate_card_key.toLowerCase().includes(q)
      );
    });
  }, [cards, textFilter]);

  useEffect(() => { setPage(1); }, [filteredCards]);

  const pagedCards = useMemo(
    () => filteredCards.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredCards, page, PAGE_SIZE]
  );
  const totalPages = Math.ceil(filteredCards.length / PAGE_SIZE);

  const companiesList = useMemo(() =>
    Object.entries(companiesMap).map(([id, name]) => ({ company_id: id, name })),
    [companiesMap]);

  const portComboOptions = [
    { value: '', label: 'All Ports' },
    ...portOptions.map(code => ({ value: code, label: code, sublabel: portsMap[code]?.name ?? '' })),
  ];

  const countryOptions = [
    { value: '', label: 'All Countries' },
    ...countries.filter(c => c.country_code && c.country_name).map(c => ({ value: c.country_code, label: `${c.country_code} — ${c.country_name}` })),
  ];

  const areaComboOptions = [
    { value: '', label: 'All Areas' },
    ...areaOptions.map(a => ({ value: String(a.area_id), label: a.area_name, sublabel: a.state_name ?? '' })),
  ];

  const vehicleComboOptions = [
    { value: '', label: 'All Vehicles' },
    ...vehicleTypes.map(v => ({ value: v.vehicle_type_id, label: v.label })),
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
        <div className="w-44">
          <PortCombobox value={areaFilter} onChange={setAreaFilter} options={areaComboOptions} placeholder="All Areas" />
        </div>
        <div className="w-40">
          <PortCombobox value={vehicleFilter} onChange={setVehicleFilter} options={vehicleComboOptions} placeholder="All Vehicles" />
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
          placeholder="Filter by area, vehicle type, rate card key…"
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

      {!portFilter && !showIssuesOnly ? (
        <div className="bg-white rounded-xl border border-[var(--border)] py-16 flex flex-col items-center gap-3 text-[var(--text-muted)]">
          <Car className="w-8 h-8 opacity-40" />
          <p className="text-sm">Select a port to view transport rate cards</p>
        </div>
      ) : (
        <>
          <PortTransportTimeSeriesRateList
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
