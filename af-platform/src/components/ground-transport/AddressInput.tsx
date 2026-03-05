'use client';

import { useState, useRef, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { geocodeAddressAction } from '@/app/actions/ground-transport';
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

export function AddressInput({ label, value, onChange, haulageAreas, cities }: AddressInputProps) {
  const [mode, setMode] = useState<'address' | 'zone'>('address');
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeMsg, setGeocodeMsg] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Group haulage areas by port
  const areasByPort = haulageAreas.reduce<Record<string, HaulageArea[]>>((acc, a) => {
    const key = a.port_un_code || 'Other';
    if (!acc[key]) acc[key] = [];
    acc[key].push(a);
    return acc;
  }, {});
  const portKeys = Object.keys(areasByPort).sort();

  function handleAddressChange(addressLine: string) {
    onChange({ ...value, address_line: addressLine });
    setGeocodeMsg(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (addressLine.trim().length < 5) return;

    setGeocoding(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const result = await geocodeAddressAction(addressLine.trim());
        if (!result) {
          setGeocodeMsg('Address not found — coordinates not available');
          setGeocoding(false);
          return;
        }
        if (result.success && result.data?.lat != null) {
          const geo = result.data;
          // Auto-match city
          let matchedCityId: number | null = null;
          if (geo.city) {
            const match = cities.find(
              (c) => c.name.toLowerCase() === geo.city!.toLowerCase(),
            );
            if (match) matchedCityId = match.city_id;
          }
          onChange({
            ...value,
            address_line: addressLine,
            lat: geo.lat,
            lng: geo.lng,
            city_id: matchedCityId ?? value.city_id,
          });
          setGeocodeMsg(geo.formatted_address ?? 'Coordinates found');
        } else {
          setGeocodeMsg('Address not found — coordinates not available');
        }
      } catch {
        setGeocodeMsg('Geocode failed — coordinates not available');
      }
      setGeocoding(false);
    }, 500);
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
              type="text"
              value={value.address_line ?? ''}
              onChange={(e) => handleAddressChange(e.target.value)}
              placeholder="Enter address..."
              className={inputCls}
            />
            {geocoding && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-[var(--text-muted)]" />
            )}
          </div>
          {geocodeMsg && (
            <p className={`text-xs ${value.lat != null ? 'text-emerald-600' : 'text-amber-600'}`}>
              {geocodeMsg}
            </p>
          )}
        </div>
      ) : (
        <select
          value={value.haulage_area_id ?? ''}
          onChange={(e) => {
            const v = e.target.value;
            if (v) handleZoneChange(Number(v));
          }}
          className={inputCls}
        >
          <option value="">Select haulage area...</option>
          {portKeys.length <= 1
            ? haulageAreas.map((a) => (
                <option key={a.area_id} value={a.area_id}>
                  {a.area_code} — {a.area_name}
                </option>
              ))
            : portKeys.map((port) => (
                <optgroup key={port} label={port}>
                  {areasByPort[port].map((a) => (
                    <option key={a.area_id} value={a.area_id}>
                      {a.area_code} — {a.area_name}
                    </option>
                  ))}
                </optgroup>
              ))}
        </select>
      )}
    </div>
  );
}
