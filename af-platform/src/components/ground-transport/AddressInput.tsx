'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Loader2, X as XIcon } from 'lucide-react';
import { fetchPlaceAutocompleteAction, fetchPlaceDetailsAction } from '@/app/actions/ground-transport';
import type { City, HaulageArea } from '@/lib/types';

export interface AddressValue {
  address_line: string | null;
  city_id: number | null;
  haulage_area_id: number | null;
  lat: number | null;
  lng: number | null;
}

interface AddressInputProps {
  label: string;
  value: AddressValue;
  onChange: (value: AddressValue) => void;
  haulageAreas: HaulageArea[];
  cities: City[];
}

const inputCls =
  'w-full text-sm border border-[var(--border)] rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[var(--sky)]';

const COUNTRY_NAMES: Record<string, string> = {
  MY: 'Malaysia', SG: 'Singapore', CN: 'China', TH: 'Thailand',
  ID: 'Indonesia', VN: 'Vietnam', PH: 'Philippines', AU: 'Australia',
  US: 'United States', GB: 'United Kingdom', DE: 'Germany', NL: 'Netherlands',
  BE: 'Belgium', FR: 'France', JP: 'Japan', KR: 'South Korea',
  IN: 'India', AE: 'UAE', BN: 'Brunei', CA: 'Canada',
};

export function AddressInput({ label, value, onChange, haulageAreas, cities }: AddressInputProps) {
  const [mode, setMode] = useState<'address' | 'zone'>('address');

  // Address autocomplete state
  const [suggestions, setSuggestions] = useState<{ place_id: string; description: string }[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressMsg, setAddressMsg] = useState<string | null>(null);
  const [addressMsgOk, setAddressMsgOk] = useState(false);
  const [sessionToken, setSessionToken] = useState<string>('');
  const [addressHighlight, setAddressHighlight] = useState<number | null>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const addressDropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Zone combobox state
  const [zoneQuery, setZoneQuery] = useState('');
  const [zoneOpen, setZoneOpen] = useState(false);
  const [zoneHighlight, setZoneHighlight] = useState<number | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string>('ALL');
  const zoneInputRef = useRef<HTMLInputElement>(null);
  const zoneDropdownRef = useRef<HTMLDivElement>(null);

  // Unique country codes for pills
  const uniqueCountryCodes = useMemo(() =>
    Array.from(
      new Set(
        haulageAreas
          .map(a => a.state_code?.split('-')[0])
          .filter(Boolean) as string[]
      )
    ).sort(),
    [haulageAreas],
  );

  // Filtered areas for zone combobox
  const filteredAreas = useMemo(() => {
    const countryFiltered = selectedCountry === 'ALL'
      ? haulageAreas
      : haulageAreas.filter(a => a.state_code?.startsWith(selectedCountry + '-') || a.state_code === selectedCountry);
    return zoneQuery.trim()
      ? countryFiltered.filter(a => a.area_name.toLowerCase().includes(zoneQuery.toLowerCase()))
      : countryFiltered;
  }, [haulageAreas, selectedCountry, zoneQuery]);

  // Group filtered areas
  const filteredByGroup = useMemo(() => {
    const groups: Record<string, HaulageArea[]> = {};
    for (const a of filteredAreas) {
      let groupKey = 'Other';
      if (a.state_code) {
        const parts = a.state_code.split('-');
        const countryCode = parts[0];
        const stateSegment = parts.slice(1).join('-');
        const countryName = COUNTRY_NAMES[countryCode] ?? countryCode;
        groupKey = stateSegment ? `${stateSegment}, ${countryName}` : countryName;
      }
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(a);
    }
    return groups;
  }, [filteredAreas]);
  const filteredGroupKeys = Object.keys(filteredByGroup).sort();

  // Flat list of selectable area IDs for keyboard nav
  const flatAreaIds = useMemo(() =>
    filteredGroupKeys.flatMap(g => filteredByGroup[g].map(a => a.area_id)),
    [filteredGroupKeys, filteredByGroup],
  );

  // Selected area name for display
  const selectedAreaName = useMemo(() => {
    if (!value.haulage_area_id) return '';
    const area = haulageAreas.find(a => a.area_id === value.haulage_area_id);
    return area?.area_name ?? '';
  }, [value.haulage_area_id, haulageAreas]);

  function handleAddressInput(text: string) {
    onChange({ ...value, address_line: text });
    setAddressMsg(null);
    setAddressMsgOk(false);
    setAddressHighlight(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length < 3) {
      setSuggestions([]);
      setSuggestionsOpen(false);
      return;
    }

    setAddressLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const result = await fetchPlaceAutocompleteAction(text.trim(), sessionToken || undefined);
        if (result?.success) {
          setSuggestions(result.data);
          setSuggestionsOpen(result.data.length > 0);
        } else {
          setSuggestions([]);
          setSuggestionsOpen(false);
        }
      } catch {
        setSuggestions([]);
        setSuggestionsOpen(false);
      }
      setAddressLoading(false);
    }, 300);
  }

  async function handleSuggestionSelect(suggestion: { place_id: string; description: string }) {
    setSuggestionsOpen(false);
    setSuggestions([]);
    setAddressLoading(true);
    onChange({ ...value, address_line: suggestion.description });

    try {
      const result = await fetchPlaceDetailsAction(suggestion.place_id, sessionToken || undefined);
      if (result?.success && result.data?.lat != null) {
        const geo = result.data;
        let matchedCityId: number | null = null;
        if (geo.city) {
          const match = cities.find(
            (c) => c.name.toLowerCase() === geo.city!.toLowerCase(),
          );
          if (match) matchedCityId = match.city_id;
        }
        onChange({
          ...value,
          address_line: suggestion.description,
          lat: geo.lat,
          lng: geo.lng,
          city_id: matchedCityId ?? value.city_id,
        });
        setAddressMsg(geo.formatted_address ?? 'Coordinates found');
        setAddressMsgOk(true);
      } else {
        setAddressMsg('Address not found — coordinates not available');
        setAddressMsgOk(false);
      }
    } catch {
      setAddressMsg('Failed to resolve address');
      setAddressMsgOk(false);
    }
    setAddressLoading(false);
    setSessionToken(crypto.randomUUID());
  }

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  function handleZoneChange(areaId: number) {
    const area = haulageAreas.find((a) => a.area_id === areaId);
    onChange({
      ...value,
      haulage_area_id: areaId,
      city_id: area?.city_id ?? value.city_id,
      lat: area?.lat ?? value.lat,
      lng: area?.lng ?? value.lng,
    });
  }

  function handleZoneSelect(areaId: number) {
    handleZoneChange(areaId);
    setZoneOpen(false);
    setZoneQuery('');
    setZoneHighlight(null);
  }

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">
        {label}
      </div>

      {/* Mode toggle */}
      <div className="flex rounded-lg border border-[var(--border)] overflow-hidden w-fit">
        <button
          type="button"
          onClick={() => setMode('address')}
          className={`px-3 py-1.5 text-xs font-medium transition-colors ${
            mode === 'address'
              ? 'bg-[var(--sky)] text-white'
              : 'bg-white text-[var(--text-mid)] hover:bg-[var(--surface)]'
          }`}
        >
          Type Address
        </button>
        <button
          type="button"
          onClick={() => setMode('zone')}
          className={`px-3 py-1.5 text-xs font-medium transition-colors ${
            mode === 'zone'
              ? 'bg-[var(--sky)] text-white'
              : 'bg-white text-[var(--text-mid)] hover:bg-[var(--surface)]'
          }`}
        >
          Select Zone
        </button>
      </div>

      {mode === 'address' ? (
        <div className="space-y-1.5">
          <div className="relative">
            <input
              ref={addressInputRef}
              type="text"
              value={value.address_line ?? ''}
              onChange={(e) => handleAddressInput(e.target.value)}
              onFocus={() => {
                if (!sessionToken) setSessionToken(crypto.randomUUID());
                if (suggestions.length > 0) setSuggestionsOpen(true);
              }}
              onBlur={() => {
                setTimeout(() => {
                  if (!addressDropdownRef.current?.contains(document.activeElement)) {
                    setSuggestionsOpen(false);
                  }
                }, 150);
              }}
              onKeyDown={(e) => {
                if (!suggestionsOpen) {
                  if (e.key === 'ArrowDown' && suggestions.length > 0) {
                    e.preventDefault();
                    setSuggestionsOpen(true);
                  }
                  return;
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  setSuggestionsOpen(false);
                  return;
                }
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setAddressHighlight(prev => {
                    if (prev === null) return 0;
                    return prev < suggestions.length - 1 ? prev + 1 : 0;
                  });
                  return;
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setAddressHighlight(prev => {
                    if (prev === null) return suggestions.length - 1;
                    return prev > 0 ? prev - 1 : suggestions.length - 1;
                  });
                  return;
                }
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (addressHighlight !== null && suggestions[addressHighlight]) {
                    handleSuggestionSelect(suggestions[addressHighlight]);
                  }
                }
              }}
              placeholder="Enter address..."
              className={inputCls}
            />
            {addressLoading && (
              <Loader2 className="absolute right-8 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-[var(--text-muted)]" />
            )}
            {value.address_line && (
              <button
                type="button"
                onClick={() => {
                  onChange({ ...value, address_line: null, lat: null, lng: null, city_id: null });
                  setSuggestions([]);
                  setSuggestionsOpen(false);
                  setAddressMsg(null);
                  setAddressMsgOk(false);
                  setSessionToken(crypto.randomUUID());
                  setTimeout(() => addressInputRef.current?.focus(), 0);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-[var(--surface)] text-[var(--text-muted)] hover:text-red-500"
              >
                <XIcon size={12} />
              </button>
            )}

            {/* Suggestions dropdown */}
            {suggestionsOpen && (
              <div
                ref={addressDropdownRef}
                className="absolute z-50 w-full mt-1 bg-white border border-[var(--border)] rounded-lg shadow-lg max-h-[320px] overflow-y-auto"
              >
                {suggestions.length === 0 ? (
                  <div className="px-3 py-3 text-sm text-[var(--text-muted)] italic">
                    No results found
                  </div>
                ) : (
                  suggestions.map((s, i) => (
                    <div
                      key={s.place_id}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSuggestionSelect(s);
                      }}
                      onMouseEnter={() => setAddressHighlight(i)}
                      className={`px-3 py-2 text-sm cursor-pointer ${
                        addressHighlight === i
                          ? 'bg-[var(--sky)]/10 text-[var(--sky)]'
                          : 'text-[var(--text)] hover:bg-[var(--surface)]'
                      }`}
                    >
                      {s.description}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
          {addressMsg && (
            <p className={`text-xs ${addressMsgOk ? 'text-emerald-600' : 'text-amber-600'}`}>
              {addressMsg}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {/* Country filter pills */}
          {uniqueCountryCodes.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              <button
                type="button"
                onClick={() => setSelectedCountry('ALL')}
                className={`px-2.5 py-1 text-xs font-medium rounded-full cursor-pointer transition-colors whitespace-nowrap ${
                  selectedCountry === 'ALL'
                    ? 'bg-[var(--sky)] text-white'
                    : 'bg-[var(--surface)] text-[var(--text-mid)] hover:bg-gray-200'
                }`}
              >
                All
              </button>
              {uniqueCountryCodes.map(code => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setSelectedCountry(code)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-full cursor-pointer transition-colors whitespace-nowrap ${
                    selectedCountry === code
                      ? 'bg-[var(--sky)] text-white'
                      : 'bg-[var(--surface)] text-[var(--text-mid)] hover:bg-gray-200'
                  }`}
                >
                  {COUNTRY_NAMES[code] ?? code}
                </button>
              ))}
            </div>
          )}

          {/* Combobox input */}
          <div className="relative">
            <input
              ref={zoneInputRef}
              type="text"
              value={zoneOpen ? zoneQuery : (selectedAreaName || zoneQuery)}
              onChange={(e) => {
                setZoneQuery(e.target.value);
                setZoneHighlight(null);
                if (!zoneOpen) setZoneOpen(true);
              }}
              onFocus={() => {
                setZoneOpen(true);
                if (selectedAreaName) setZoneQuery('');
              }}
              onBlur={() => {
                setTimeout(() => {
                  if (!zoneDropdownRef.current?.contains(document.activeElement)) {
                    setZoneOpen(false);
                    setZoneQuery('');
                  }
                }, 150);
              }}
              onKeyDown={(e) => {
                if (!zoneOpen) {
                  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    setZoneOpen(true);
                  }
                  return;
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  setZoneOpen(false);
                  setZoneQuery('');
                  return;
                }
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setZoneHighlight(prev => {
                    if (prev === null || flatAreaIds.indexOf(prev) === -1) return flatAreaIds[0] ?? null;
                    const idx = flatAreaIds.indexOf(prev);
                    return idx < flatAreaIds.length - 1 ? flatAreaIds[idx + 1] : flatAreaIds[0];
                  });
                  return;
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setZoneHighlight(prev => {
                    if (prev === null || flatAreaIds.indexOf(prev) === -1) return flatAreaIds[flatAreaIds.length - 1] ?? null;
                    const idx = flatAreaIds.indexOf(prev);
                    return idx > 0 ? flatAreaIds[idx - 1] : flatAreaIds[flatAreaIds.length - 1];
                  });
                  return;
                }
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (zoneHighlight !== null && flatAreaIds.includes(zoneHighlight)) {
                    handleZoneSelect(zoneHighlight);
                  }
                }
              }}
              placeholder="Select area..."
              className={inputCls}
            />
            {value.haulage_area_id && !zoneOpen && (
              <button
                type="button"
                onClick={() => {
                  onChange({ ...value, haulage_area_id: null, lat: null, lng: null });
                  setZoneQuery('');
                  setZoneOpen(true);
                  setTimeout(() => zoneInputRef.current?.focus(), 0);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-[var(--surface)] text-[var(--text-muted)] hover:text-red-500"
              >
                <XIcon size={12} />
              </button>
            )}

            {/* Dropdown */}
            {zoneOpen && (
              <div
                ref={zoneDropdownRef}
                className="absolute z-50 w-full mt-1 bg-white border border-[var(--border)] rounded-lg shadow-lg max-h-[240px] overflow-y-auto"
              >
                {filteredGroupKeys.length === 0 ? (
                  <div className="px-3 py-3 text-sm text-[var(--text-muted)] text-center">
                    No areas found
                  </div>
                ) : (
                  filteredGroupKeys.map(group => (
                    <div key={group}>
                      <div className="px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide bg-[var(--surface)] sticky top-0">
                        {group}
                      </div>
                      {filteredByGroup[group].map(a => (
                        <div
                          key={a.area_id}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleZoneSelect(a.area_id);
                          }}
                          onMouseEnter={() => setZoneHighlight(a.area_id)}
                          className={`px-3 py-2 text-sm cursor-pointer ${
                            zoneHighlight === a.area_id
                              ? 'bg-[var(--sky)]/10 text-[var(--sky)]'
                              : 'text-[var(--text)] hover:bg-[var(--surface)]'
                          }`}
                        >
                          {a.area_name}
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
