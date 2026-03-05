'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Search, Loader2, MapPin, X, Pencil, Trash2, Sparkles } from 'lucide-react';
import {
  fetchStatesAction, fetchCitiesAction, fetchHaulageAreasAction,
  fetchGeoPortsAction, createCityAction, updateCityAction,
  createHaulageAreaAction, updateHaulageAreaAction, deleteHaulageAreaAction,
  updatePortCoordinatesAction, resolvePortAction, confirmPortAction,
  fetchCountriesAction, updateCountryAction,
} from '@/app/actions/geography';
import type { Country } from '@/app/actions/geography';
import type { State, City, HaulageArea } from '@/lib/types';
import type { Port } from '@/lib/ports';

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

function EmptyRow({ cols, message }: { cols: number; message: string }) {
  return (
    <tr>
      <td colSpan={cols} className="py-8 text-center text-sm text-[var(--text-muted)]">
        {message}
      </td>
    </tr>
  );
}

function TableShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-[var(--border)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          {children}
        </table>
      </div>
    </div>
  );
}

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-white text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--sky)]/30 focus:border-[var(--sky)]";
const btnPrimary = "px-4 py-2 text-sm font-medium rounded-lg bg-[var(--sky)] text-white hover:opacity-90 transition-opacity disabled:opacity-50";
const btnSecondary = "px-4 py-2 text-sm font-medium rounded-lg border border-[var(--border)] text-[var(--text-mid)] hover:bg-[var(--surface)] transition-colors";
const thCls = "px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide";
const tdCls = "px-4 py-3 text-sm text-[var(--text)]";

// ---------------------------------------------------------------------------
// FilterCombobox — typeable dropdown for filter controls
// ---------------------------------------------------------------------------

function FilterCombobox({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedLabel = options.find(o => o.value === value)?.label ?? '';
  const displayText = open ? query : selectedLabel;
  const filtered = open
    ? options.filter(o =>
        o.label.toLowerCase().includes(query.toLowerCase()) ||
        o.value.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 30)
    : [];

  return (
    <div className="relative min-w-[160px]">
      <input
        ref={inputRef}
        type="text"
        value={displayText}
        placeholder={placeholder ?? 'Search...'}
        className={inputCls}
        onFocus={() => { setOpen(true); setQuery(''); }}
        onChange={e => setQuery(e.target.value)}
        onBlur={() => setTimeout(() => { setOpen(false); setQuery(''); }, 150)}
        onKeyDown={e => { if (e.key === 'Escape') { setOpen(false); setQuery(''); } }}
      />
      {value && !open && (
        <button
          type="button"
          onMouseDown={e => {
            e.preventDefault();
            onChange('');
            setOpen(true);
            setQuery('');
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-[var(--border)] rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.length > 0 ? (
            filtered.map(o => (
              <button
                key={o.value}
                type="button"
                onMouseDown={e => { e.preventDefault(); onChange(o.value); setOpen(false); setQuery(''); }}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-[var(--sky-mist)] ${o.value === value ? 'bg-[var(--sky-mist)] font-medium' : ''}`}
              >
                {o.label}
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-xs text-[var(--text-muted)]">No results</div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mini map preview (placeholder when no Google Maps key)
// ---------------------------------------------------------------------------

function MiniMapPreview({ lat, lng }: { lat: number | null; lng: number | null }) {
  if (lat == null || lng == null) {
    return (
      <div className="h-[150px] rounded-lg bg-[var(--surface)] flex items-center justify-center text-xs text-[var(--text-muted)]">
        No coordinates
      </div>
    );
  }

  const mapsKey = typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '')
    : '';

  if (!mapsKey || mapsKey === 'PENDING') {
    return (
      <div className="h-[150px] rounded-lg bg-[var(--surface)] flex flex-col items-center justify-center text-xs text-[var(--text-muted)] gap-1">
        <MapPin className="w-4 h-4" />
        <span>{lat.toFixed(4)}, {lng.toFixed(4)}</span>
        <span className="text-[10px]">Map unavailable</span>
      </div>
    );
  }

  // Dynamic import — will be used when maps are available
  return (
    <div className="h-[150px] rounded-lg overflow-hidden">
      <PortMarkerMapLazy lat={lat} lng={lng} />
    </div>
  );
}

function PortMarkerMapLazy({ lat, lng }: { lat: number; lng: number }) {
  // Lazy-load the map component only when Google Maps key is available
  const [MapComp, setMapComp] = useState<React.ComponentType<{ lat: number; lng: number }> | null>(null);

  useEffect(() => {
    import('@/components/maps/PortMarkerMap').then((mod) => setMapComp(() => mod.default)).catch(() => {});
  }, []);

  if (!MapComp) {
    return (
      <div className="h-full bg-[var(--surface)] flex items-center justify-center text-xs text-[var(--text-muted)]">
        <Loader2 className="w-4 h-4 animate-spin" />
      </div>
    );
  }

  return <MapComp lat={lat} lng={lng} />;
}

// ---------------------------------------------------------------------------
// States Tab
// ---------------------------------------------------------------------------

export function StatesTab() {
  const [states, setStates] = useState<State[]>([]);
  const [countryMap, setCountryMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [filterCountry, setFilterCountry] = useState('');

  useEffect(() => {
    Promise.all([fetchStatesAction(), fetchCountriesAction()]).then(([sr, cr]) => {
      if (sr.success) setStates(sr.data);
      if (cr.success) setCountryMap(new Map(cr.data.map(c => [c.country_code, c.name])));
      setLoading(false);
    });
  }, []);

  const countryOptions = Array.from(
    new Map(
      states
        .filter(s => !!s.country_code)
        .map(s => [s.country_code, { value: s.country_code, label: `${s.country_code} — ${countryMap.get(s.country_code) ?? s.country_code}` }])
    ).values()
  ).sort((a, b) => a.value.localeCompare(b.value));

  const filtered = filterCountry
    ? states.filter(s => s.country_code === filterCountry)
    : states;

  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <FilterCombobox
          value={filterCountry}
          onChange={setFilterCountry}
          options={countryOptions}
          placeholder="All countries"
        />
      </div>
      <TableShell>
        <thead className="bg-[var(--surface)]">
          <tr>
            <th className={thCls}>Code</th>
            <th className={thCls}>Name</th>
            <th className={thCls}>Country</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {loading ? (
            <tr><td colSpan={3} className="py-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-[var(--text-muted)]" /></td></tr>
          ) : filtered.length === 0 ? (
            <EmptyRow cols={3} message="No states found" />
          ) : (
            filtered.map((s) => (
              <tr key={s.state_code} className="hover:bg-[var(--surface)]/50">
                <td className={`${tdCls} font-mono`}>{s.state_code}</td>
                <td className={tdCls}>{s.name}</td>
                <td className={tdCls}>{s.country_code}</td>
              </tr>
            ))
          )}
        </tbody>
      </TableShell>
    </>
  );
}

// ---------------------------------------------------------------------------
// Cities Tab
// ---------------------------------------------------------------------------

export function CitiesTab() {
  const [cities, setCities] = useState<City[]>([]);
  const [states, setStates] = useState<State[]>([]);
  const [countryMap, setCountryMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [filterCountry, setFilterCountry] = useState('');
  const [filterState, setFilterState] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editCity, setEditCity] = useState<City | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [citiesRes, statesRes, countriesRes] = await Promise.all([
      fetchCitiesAction(filterState || undefined),
      fetchStatesAction(),
      fetchCountriesAction(),
    ]);
    if (citiesRes.success) setCities(citiesRes.data);
    if (statesRes.success) setStates(statesRes.data);
    if (countriesRes.success) setCountryMap(new Map(countriesRes.data.map(c => [c.country_code, c.name])));
    setLoading(false);
  }, [filterState]);

  useEffect(() => { load(); }, [load]);

  const countryOptions = Array.from(
    new Map(
      states
        .filter(s => !!s.country_code)
        .map(s => [s.country_code, { value: s.country_code, label: `${s.country_code} — ${countryMap.get(s.country_code) ?? s.country_code}` }])
    ).values()
  ).sort((a, b) => a.value.localeCompare(b.value));

  const stateOptions = (filterCountry
    ? states.filter(s => s.country_code === filterCountry)
    : states
  ).map(s => ({ value: s.state_code, label: s.name }));

  const filteredCities = filterCountry
    ? cities.filter(c => c.state_code.startsWith(filterCountry + '-'))
    : cities;

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4">
        <FilterCombobox
          value={filterCountry}
          onChange={(v) => { setFilterCountry(v); setFilterState(''); }}
          options={countryOptions}
          placeholder="All countries"
        />
        <FilterCombobox
          value={filterState}
          onChange={setFilterState}
          options={stateOptions}
          placeholder="All states"
        />
        <button onClick={() => setShowAdd(true)} className={btnPrimary}>
          <Plus className="w-4 h-4 inline mr-1" />Add City
        </button>
      </div>

      <TableShell>
        <thead className="bg-[var(--surface)]">
          <tr>
            <th className={thCls}>Name</th>
            <th className={thCls}>State</th>
            <th className={thCls}>Coordinates</th>
            <th className={thCls}>Active</th>
            <th className={thCls}></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {loading ? (
            <tr><td colSpan={5} className="py-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-[var(--text-muted)]" /></td></tr>
          ) : filteredCities.length === 0 ? (
            <EmptyRow cols={5} message="No cities found" />
          ) : (
            filteredCities.map((c) => (
              <tr key={c.city_id} className="hover:bg-[var(--surface)]/50">
                <td className={tdCls}>{c.name}</td>
                <td className={`${tdCls} text-[var(--text-muted)]`}>{c.state_name || c.state_code}</td>
                <td className={`${tdCls} font-mono text-xs`}>
                  {c.lat != null && c.lng != null ? `${c.lat}, ${c.lng}` : '—'}
                </td>
                <td className={tdCls}>
                  <span className={`inline-block w-2 h-2 rounded-full ${c.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
                </td>
                <td className={tdCls}>
                  <button onClick={() => setEditCity(c)} className="text-[var(--text-muted)] hover:text-[var(--text)]">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </TableShell>

      {/* Add City Modal */}
      {showAdd && (
        <CityFormModal
          states={states}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); load(); }}
        />
      )}

      {/* Edit City Modal */}
      {editCity && (
        <CityFormModal
          city={editCity}
          states={states}
          onClose={() => setEditCity(null)}
          onSaved={() => { setEditCity(null); load(); }}
        />
      )}
    </>
  );
}

function CityFormModal({ city, states, onClose, onSaved }: {
  city?: City;
  states: State[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!city;
  const [name, setName] = useState(city?.name ?? '');
  const [stateCode, setStateCode] = useState(city?.state_code ?? '');
  const [lat, setLat] = useState(city?.lat?.toString() ?? '');
  const [lng, setLng] = useState(city?.lng?.toString() ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name.trim()) { setError('Name is required'); return; }
    if (!isEdit && !stateCode) { setError('State is required'); return; }
    setSaving(true);
    setError('');

    const latNum = lat ? parseFloat(lat) : null;
    const lngNum = lng ? parseFloat(lng) : null;

    const result = isEdit
      ? await updateCityAction(city!.city_id, { name: name.trim(), lat: latNum, lng: lngNum })
      : await createCityAction({ name: name.trim(), state_code: stateCode, lat: latNum, lng: lngNum });

    if (!result) { setError('No response'); setSaving(false); return; }
    if (!result.success) { setError(result.error); setSaving(false); return; }
    onSaved();
  };

  return (
    <ModalOverlay onClose={onClose}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[var(--text)]">{isEdit ? 'Edit City' : 'Add City'}</h3>
        <button onClick={onClose}><X className="w-5 h-5 text-[var(--text-muted)]" /></button>
      </div>
      <div className="space-y-3">
        <Field label="Name">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        {!isEdit && (
          <Field label="State">
            <select className={inputCls} value={stateCode} onChange={(e) => setStateCode(e.target.value)}>
              <option value="">Select state...</option>
              {states.map((s) => <option key={s.state_code} value={s.state_code}>{s.name}</option>)}
            </select>
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Latitude">
            <input className={inputCls} value={lat} onChange={(e) => setLat(e.target.value)} placeholder="e.g. 3.1578" />
          </Field>
          <Field label="Longitude">
            <input className={inputCls} value={lng} onChange={(e) => setLng(e.target.value)} placeholder="e.g. 101.7117" />
          </Field>
        </div>
        <MiniMapPreview lat={lat ? parseFloat(lat) : null} lng={lng ? parseFloat(lng) : null} />
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <button onClick={onClose} className={btnSecondary}>Cancel</button>
        <button onClick={handleSave} disabled={saving} className={btnPrimary}>
          {saving && <Loader2 className="w-4 h-4 animate-spin inline mr-1" />}
          {isEdit ? 'Save' : 'Add City'}
        </button>
      </div>
    </ModalOverlay>
  );
}

// ---------------------------------------------------------------------------
// Haulage Areas Tab
// ---------------------------------------------------------------------------

export function HaulageAreasTab() {
  const [areas, setAreas] = useState<HaulageArea[]>([]);
  const [states, setStates] = useState<State[]>([]);
  const [ports, setPorts] = useState<Port[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCountry, setFilterCountry] = useState('');
  const [filterPort, setFilterPort] = useState('');
  const [filterState, setFilterState] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editArea, setEditArea] = useState<HaulageArea | null>(null);

  const seaPorts = ports.filter((p) => p.port_type === 'SEA');

  const load = useCallback(async () => {
    setLoading(true);
    const filters: { port_un_code?: string; state_code?: string } = {};
    if (filterPort) filters.port_un_code = filterPort;
    if (filterState) filters.state_code = filterState;

    const [areasRes, statesRes, portsRes] = await Promise.all([
      fetchHaulageAreasAction(filters),
      fetchStatesAction(),
      fetchGeoPortsAction(),
    ]);
    let areaData = areasRes.success ? areasRes.data : [];
    if (filterCountry && portsRes.success) {
      const portsInCountry = new Set(
        portsRes.data.filter(p => p.country_code === filterCountry).map(p => p.un_code)
      );
      areaData = areaData.filter(a => portsInCountry.has(a.port_un_code));
    }
    setAreas(areaData);
    if (statesRes.success) setStates(statesRes.data);
    if (portsRes.success) setPorts(portsRes.data);
    setLoading(false);
  }, [filterPort, filterState, filterCountry]);

  useEffect(() => { load(); }, [load]);

  const portsInAreas = new Set(areas.map(a => a.port_un_code));
  const countryOptions = Array.from(
    new Map(
      ports
        .filter(p => portsInAreas.has(p.un_code) && !!p.country_code)
        .map(p => [p.country_code, { value: p.country_code, label: `${p.country_code} — ${p.country}` }])
    ).values()
  ).sort((a, b) => a.value.localeCompare(b.value));

  const portOptions = (filterCountry
    ? seaPorts.filter(p => p.country_code === filterCountry)
    : seaPorts
  ).map(p => ({ value: p.un_code, label: `${p.name} (${p.un_code})` }));

  const stateOptions = states.map(s => ({ value: s.state_code, label: s.name }));

  const handleDelete = async (area: HaulageArea) => {
    if (!confirm(`Deactivate "${area.area_name}"?`)) return;
    await deleteHaulageAreaAction(area.area_id);
    load();
  };

  return (
    <>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <FilterCombobox
          value={filterCountry}
          onChange={(v) => { setFilterCountry(v); setFilterPort(''); setFilterState(''); }}
          options={countryOptions}
          placeholder="All countries"
        />
        <FilterCombobox
          value={filterPort}
          onChange={setFilterPort}
          options={portOptions}
          placeholder="All ports"
        />
        <FilterCombobox
          value={filterState}
          onChange={setFilterState}
          options={stateOptions}
          placeholder="All states"
        />
        <button onClick={() => setShowAdd(true)} className={btnPrimary}>
          <Plus className="w-4 h-4 inline mr-1" />Add Area
        </button>
      </div>

      <TableShell>
        <thead className="bg-[var(--surface)]">
          <tr>
            <th className={thCls}>Code</th>
            <th className={thCls}>Name</th>
            <th className={thCls}>Port</th>
            <th className={thCls}>State</th>
            <th className={thCls}>Active</th>
            <th className={thCls}></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {loading ? (
            <tr><td colSpan={6} className="py-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-[var(--text-muted)]" /></td></tr>
          ) : areas.length === 0 ? (
            <EmptyRow cols={6} message="No haulage areas found" />
          ) : (
            areas.map((a) => (
              <tr key={a.area_id} className="hover:bg-[var(--surface)]/50">
                <td className={`${tdCls} font-mono`}>{a.area_code}</td>
                <td className={tdCls}>{a.area_name}</td>
                <td className={`${tdCls} font-mono text-xs`}>{a.port_un_code}</td>
                <td className={`${tdCls} text-[var(--text-muted)]`}>{a.state_code || '—'}</td>
                <td className={tdCls}>
                  <span className={`inline-block w-2 h-2 rounded-full ${a.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
                </td>
                <td className={`${tdCls} flex gap-2`}>
                  <button onClick={() => setEditArea(a)} className="text-[var(--text-muted)] hover:text-[var(--text)]">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(a)} className="text-[var(--text-muted)] hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </TableShell>

      {showAdd && (
        <HaulageAreaFormModal
          states={states} ports={seaPorts}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); load(); }}
        />
      )}
      {editArea && (
        <HaulageAreaFormModal
          area={editArea} states={states} ports={seaPorts}
          onClose={() => setEditArea(null)}
          onSaved={() => { setEditArea(null); load(); }}
        />
      )}
    </>
  );
}

function HaulageAreaFormModal({ area, states, ports, onClose, onSaved }: {
  area?: HaulageArea;
  states: State[];
  ports: Port[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!area;
  const [areaCode, setAreaCode] = useState(area?.area_code ?? '');
  const [areaName, setAreaName] = useState(area?.area_name ?? '');
  const [portUnCode, setPortUnCode] = useState(area?.port_un_code ?? '');
  const [stateCode, setStateCode] = useState(area?.state_code ?? '');
  const [lat, setLat] = useState(area?.lat?.toString() ?? '');
  const [lng, setLng] = useState(area?.lng?.toString() ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!areaCode.trim() || !areaName.trim() || !portUnCode) {
      setError('Code, name, and port are required');
      return;
    }
    setSaving(true);
    setError('');

    const latNum = lat ? parseFloat(lat) : null;
    const lngNum = lng ? parseFloat(lng) : null;

    const result = isEdit
      ? await updateHaulageAreaAction(area!.area_id, {
          area_code: areaCode.trim(), area_name: areaName.trim(),
          port_un_code: portUnCode, state_code: stateCode || null,
          lat: latNum, lng: lngNum,
        })
      : await createHaulageAreaAction({
          area_code: areaCode.trim(), area_name: areaName.trim(),
          port_un_code: portUnCode, state_code: stateCode || null,
          lat: latNum, lng: lngNum,
        });

    if (!result) { setError('No response'); setSaving(false); return; }
    if (!result.success) { setError(result.error); setSaving(false); return; }
    onSaved();
  };

  return (
    <ModalOverlay onClose={onClose}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[var(--text)]">{isEdit ? 'Edit Haulage Area' : 'Add Haulage Area'}</h3>
        <button onClick={onClose}><X className="w-5 h-5 text-[var(--text-muted)]" /></button>
      </div>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Area Code">
            <input className={inputCls} value={areaCode} onChange={(e) => setAreaCode(e.target.value.toUpperCase())} placeholder="e.g. KV-01" />
          </Field>
          <Field label="Area Name">
            <input className={inputCls} value={areaName} onChange={(e) => setAreaName(e.target.value)} placeholder="e.g. Klang Valley Zone 1" />
          </Field>
        </div>
        <Field label="Port">
          <select className={inputCls} value={portUnCode} onChange={(e) => setPortUnCode(e.target.value)}>
            <option value="">Select port...</option>
            {ports.map((p) => <option key={p.un_code} value={p.un_code}>{p.name} ({p.un_code})</option>)}
          </select>
        </Field>
        <Field label="State">
          <select className={inputCls} value={stateCode} onChange={(e) => setStateCode(e.target.value)}>
            <option value="">None</option>
            {states.map((s) => <option key={s.state_code} value={s.state_code}>{s.name}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Latitude">
            <input className={inputCls} value={lat} onChange={(e) => setLat(e.target.value)} placeholder="e.g. 3.0449" />
          </Field>
          <Field label="Longitude">
            <input className={inputCls} value={lng} onChange={(e) => setLng(e.target.value)} placeholder="e.g. 101.4455" />
          </Field>
        </div>
        <MiniMapPreview lat={lat ? parseFloat(lat) : null} lng={lng ? parseFloat(lng) : null} />
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <button onClick={onClose} className={btnSecondary}>Cancel</button>
        <button onClick={handleSave} disabled={saving} className={btnPrimary}>
          {saving && <Loader2 className="w-4 h-4 animate-spin inline mr-1" />}
          {isEdit ? 'Save' : 'Add Area'}
        </button>
      </div>
    </ModalOverlay>
  );
}

// ---------------------------------------------------------------------------
// Ports Tab
// ---------------------------------------------------------------------------

export function PortsTab() {
  const [ports, setPorts] = useState<Port[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCountry, setFilterCountry] = useState('');
  const [search, setSearch] = useState('');
  const [editPort, setEditPort] = useState<Port | null>(null);
  const [showResolve, setShowResolve] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetchGeoPortsAction();
    if (r.success) setPorts(r.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const countryOptions = Array.from(
    new Map(
      ports
        .filter(p => !!p.country_code)
        .map(p => [p.country_code, { value: p.country_code, label: `${p.country_code} — ${p.country}` }])
    ).values()
  ).sort((a, b) => a.value.localeCompare(b.value));

  const filtered = ports.filter((p) => {
    if (filterCountry && p.country_code !== filterCountry) return false;
    if (search) {
      const q = search.toLowerCase();
      return p.un_code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <FilterCombobox
          value={filterCountry}
          onChange={(v) => { setFilterCountry(v); setSearch(''); }}
          options={countryOptions}
          placeholder="All countries"
        />
        <div className="relative flex-1 max-w-[300px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            className={`${inputCls} pl-9`}
            placeholder="Search ports..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button onClick={() => setShowResolve(true)} className={btnPrimary}>
          <Sparkles className="w-4 h-4 inline mr-1" />Resolve Unknown Port
        </button>
      </div>

      <TableShell>
        <thead className="bg-[var(--surface)]">
          <tr>
            <th className={thCls}>UN Code</th>
            <th className={thCls}>Name</th>
            <th className={thCls}>Country</th>
            <th className={thCls}>Type</th>
            <th className={thCls}>Coordinates</th>
            <th className={thCls}></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {loading ? (
            <tr><td colSpan={6} className="py-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-[var(--text-muted)]" /></td></tr>
          ) : filtered.length === 0 ? (
            <EmptyRow cols={6} message="No ports found" />
          ) : (
            filtered.map((p) => (
              <tr key={p.un_code} className="hover:bg-[var(--surface)]/50">
                <td className={`${tdCls} font-mono`}>{p.un_code}</td>
                <td className={tdCls}>{p.name}</td>
                <td className={`${tdCls} text-[var(--text-muted)]`}>{p.country}</td>
                <td className={tdCls}>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    p.port_type === 'AIR' ? 'bg-sky-50 text-sky-700' : 'bg-blue-50 text-blue-700'
                  }`}>{p.port_type}</span>
                </td>
                <td className={`${tdCls} font-mono text-xs`}>
                  {p.lat != null && p.lng != null ? `${p.lat}, ${p.lng}` : '—'}
                </td>
                <td className={tdCls}>
                  <button onClick={() => setEditPort(p)} className="text-[var(--text-muted)] hover:text-[var(--text)]">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </TableShell>

      {editPort && (
        <PortEditModal port={editPort} onClose={() => setEditPort(null)} onSaved={() => { setEditPort(null); load(); }} />
      )}
      {showResolve && (
        <PortResolveModal onClose={() => setShowResolve(false)} onSaved={() => { setShowResolve(false); load(); }} />
      )}
    </>
  );
}

function PortEditModal({ port, onClose, onSaved }: { port: Port; onClose: () => void; onSaved: () => void }) {
  const [lat, setLat] = useState(port.lat?.toString() ?? '');
  const [lng, setLng] = useState(port.lng?.toString() ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setSaving(true);
    setError('');
    const result = await updatePortCoordinatesAction(port.un_code, {
      lat: lat ? parseFloat(lat) : null,
      lng: lng ? parseFloat(lng) : null,
    });
    if (!result) { setError('No response'); setSaving(false); return; }
    if (!result.success) { setError(result.error); setSaving(false); return; }
    onSaved();
  };

  return (
    <ModalOverlay onClose={onClose}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[var(--text)]">Edit Port — {port.un_code}</h3>
        <button onClick={onClose}><X className="w-5 h-5 text-[var(--text-muted)]" /></button>
      </div>
      <div className="space-y-3">
        <div className="text-sm text-[var(--text-muted)]">
          <p><strong>Name:</strong> {port.name}</p>
          <p><strong>Country:</strong> {port.country} ({port.country_code})</p>
          <p><strong>Type:</strong> {port.port_type}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Latitude">
            <input className={inputCls} value={lat} onChange={(e) => setLat(e.target.value)} />
          </Field>
          <Field label="Longitude">
            <input className={inputCls} value={lng} onChange={(e) => setLng(e.target.value)} />
          </Field>
        </div>
        <MiniMapPreview lat={lat ? parseFloat(lat) : null} lng={lng ? parseFloat(lng) : null} />
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <button onClick={onClose} className={btnSecondary}>Cancel</button>
        <button onClick={handleSave} disabled={saving} className={btnPrimary}>
          {saving && <Loader2 className="w-4 h-4 animate-spin inline mr-1" />}Save
        </button>
      </div>
    </ModalOverlay>
  );
}

// ---------------------------------------------------------------------------
// Port Resolution Modal
// ---------------------------------------------------------------------------

function PortResolveModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [code, setCode] = useState('');
  const [resolving, setResolving] = useState(false);
  const [candidate, setCandidate] = useState<{
    un_code: string; name: string; country: string; country_code: string;
    port_type: string; lat: number | null; lng: number | null; confidence: string;
  } | null>(null);
  const [alreadyExists, setAlreadyExists] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');

  // Editable fields for candidate
  const [editUnCode, setEditUnCode] = useState('');
  const [editName, setEditName] = useState('');
  const [editCountry, setEditCountry] = useState('');
  const [editCountryCode, setEditCountryCode] = useState('');
  const [editPortType, setEditPortType] = useState('SEA');
  const [editLat, setEditLat] = useState('');
  const [editLng, setEditLng] = useState('');

  const handleResolve = async () => {
    if (!code.trim()) return;
    setResolving(true);
    setError('');
    setCandidate(null);

    const result = await resolvePortAction(code.trim());
    if (!result) { setError('No response'); setResolving(false); return; }
    if (!result.success) { setError(result.error); setResolving(false); return; }

    setAlreadyExists(result.data.already_exists);
    const c = result.data.candidate;
    setCandidate(c);
    setEditUnCode(c.un_code || '');
    setEditName(c.name || '');
    setEditCountry(c.country || '');
    setEditCountryCode(c.country_code || '');
    setEditPortType(c.port_type || 'SEA');
    setEditLat(c.lat?.toString() ?? '');
    setEditLng(c.lng?.toString() ?? '');
    setResolving(false);
  };

  const handleConfirm = async () => {
    setConfirming(true);
    setError('');

    const result = await confirmPortAction({
      un_code: editUnCode.trim(),
      name: editName.trim(),
      country: editCountry.trim(),
      country_code: editCountryCode.trim(),
      port_type: editPortType,
      lat: editLat ? parseFloat(editLat) : null,
      lng: editLng ? parseFloat(editLng) : null,
    });

    if (!result) { setError('No response'); setConfirming(false); return; }
    if (!result.success) { setError(result.error); setConfirming(false); return; }
    onSaved();
  };

  return (
    <ModalOverlay onClose={onClose}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[var(--text)]">Resolve Unknown Port</h3>
        <button onClick={onClose}><X className="w-5 h-5 text-[var(--text-muted)]" /></button>
      </div>

      {/* Step 1: Enter code */}
      <div className="flex gap-2 mb-4">
        <input
          className={`${inputCls} flex-1`}
          placeholder="Enter port/airport code (e.g. MUC)"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === 'Enter' && handleResolve()}
        />
        <button onClick={handleResolve} disabled={resolving || !code.trim()} className={btnPrimary}>
          {resolving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        </button>
      </div>

      {/* Step 2: Show candidate */}
      {candidate && (
        <div className="space-y-3">
          {alreadyExists && (
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-700">
              Port already exists in the database.
            </div>
          )}

          {!alreadyExists && (
            <>
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  candidate.confidence === 'HIGH' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                }`}>
                  {candidate.confidence} confidence
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="UN Code">
                  <input className={inputCls} value={editUnCode} onChange={(e) => setEditUnCode(e.target.value.toUpperCase())} />
                </Field>
                <Field label="Name">
                  <input className={inputCls} value={editName} onChange={(e) => setEditName(e.target.value)} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Country">
                  <input className={inputCls} value={editCountry} onChange={(e) => setEditCountry(e.target.value)} />
                </Field>
                <Field label="Country Code">
                  <input className={inputCls} value={editCountryCode} onChange={(e) => setEditCountryCode(e.target.value.toUpperCase())} />
                </Field>
              </div>
              <Field label="Port Type">
                <select className={inputCls} value={editPortType} onChange={(e) => setEditPortType(e.target.value)}>
                  <option value="SEA">SEA</option>
                  <option value="AIR">AIR</option>
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Latitude">
                  <input className={inputCls} value={editLat} onChange={(e) => setEditLat(e.target.value)} />
                </Field>
                <Field label="Longitude">
                  <input className={inputCls} value={editLng} onChange={(e) => setEditLng(e.target.value)} />
                </Field>
              </div>
            </>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 mt-4">
            <button onClick={onClose} className={btnSecondary}>Cancel</button>
            {!alreadyExists && (
              <button onClick={handleConfirm} disabled={confirming} className={btnPrimary}>
                {confirming && <Loader2 className="w-4 h-4 animate-spin inline mr-1" />}
                Add to Ports
              </button>
            )}
          </div>
        </div>
      )}

      {!candidate && error && <p className="text-sm text-red-600">{error}</p>}
    </ModalOverlay>
  );
}

// ---------------------------------------------------------------------------
// Countries Tab
// ---------------------------------------------------------------------------

export function CountriesTab() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editCountry, setEditCountry] = useState<Country | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetchCountriesAction();
    if (r.success) setCountries(r.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = search
    ? countries.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.country_code.toLowerCase().includes(search.toLowerCase())
      )
    : countries;

  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-[300px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            className={`${inputCls} pl-9`}
            placeholder="Search countries..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <TableShell>
        <thead className="bg-[var(--surface)]">
          <tr>
            <th className={thCls}>Code</th>
            <th className={thCls}>Name</th>
            <th className={thCls}>Currency</th>
            <th className={thCls}>Tax</th>
            <th className={thCls}>Rate</th>
            <th className={thCls}></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {loading ? (
            <tr><td colSpan={6} className="py-8 text-center">
              <Loader2 className="w-5 h-5 animate-spin mx-auto text-[var(--text-muted)]" />
            </td></tr>
          ) : filtered.length === 0 ? (
            <EmptyRow cols={6} message="No countries found" />
          ) : (
            filtered.map(c => (
              <tr key={c.country_code} className="hover:bg-[var(--surface)]/50">
                <td className={`${tdCls} font-mono`}>{c.country_code}</td>
                <td className={tdCls}>{c.name}</td>
                <td className={tdCls}>
                  {c.currency_code
                    ? <span className="font-mono text-xs">{c.currency_code}</span>
                    : <span className="text-[var(--text-muted)]">—</span>}
                </td>
                <td className={tdCls}>
                  {c.tax_label
                    ? <span className={`text-xs px-2 py-0.5 rounded-full ${c.tax_applicable ? 'bg-amber-50 text-amber-700' : 'bg-[var(--surface)] text-[var(--text-muted)]'}`}>
                        {c.tax_label}
                      </span>
                    : <span className="text-[var(--text-muted)]">—</span>}
                </td>
                <td className={tdCls}>
                  {c.tax_rate != null
                    ? <span className="text-sm">{c.tax_rate}%</span>
                    : <span className="text-[var(--text-muted)]">—</span>}
                </td>
                <td className={tdCls}>
                  <button onClick={() => setEditCountry(c)} className="text-[var(--text-muted)] hover:text-[var(--text)]">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </TableShell>

      {editCountry && (
        <CountryEditModal
          country={editCountry}
          onClose={() => setEditCountry(null)}
          onSaved={() => { setEditCountry(null); load(); }}
        />
      )}
    </>
  );
}

function CountryEditModal({ country, onClose, onSaved }: {
  country: Country;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [currencyCode, setCurrencyCode] = useState(country.currency_code ?? '');
  const [taxLabel, setTaxLabel] = useState(country.tax_label ?? '');
  const [taxRate, setTaxRate] = useState(country.tax_rate?.toString() ?? '');
  const [taxApplicable, setTaxApplicable] = useState(country.tax_applicable);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setSaving(true);
    setError('');
    const result = await updateCountryAction(country.country_code, {
      currency_code: currencyCode || null,
      tax_label: taxLabel || null,
      tax_rate: taxRate ? parseFloat(taxRate) : null,
      tax_applicable: taxApplicable,
    });
    if (!result.success) { setError(result.error); setSaving(false); return; }
    onSaved();
  };

  return (
    <ModalOverlay onClose={onClose}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[var(--text)]">
          Edit Country — {country.country_code}
        </h3>
        <button onClick={onClose}><X className="w-5 h-5 text-[var(--text-muted)]" /></button>
      </div>
      <p className="text-sm text-[var(--text-muted)] mb-4">{country.name}</p>
      <div className="space-y-3">
        <Field label="Currency Code">
          <input className={inputCls} value={currencyCode} onChange={e => setCurrencyCode(e.target.value.toUpperCase())} placeholder="e.g. MYR" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tax Label">
            <input className={inputCls} value={taxLabel} onChange={e => setTaxLabel(e.target.value.toUpperCase())} placeholder="e.g. GST, VAT, SST" />
          </Field>
          <Field label="Tax Rate (%)">
            <input className={inputCls} value={taxRate} onChange={e => setTaxRate(e.target.value)} placeholder="e.g. 9.00" />
          </Field>
        </div>
        <Field label="Tax Applicable">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={taxApplicable}
              onChange={e => setTaxApplicable(e.target.checked)}
              className="w-4 h-4 rounded border-[var(--border)] text-[var(--sky)]"
            />
            <span className="text-sm text-[var(--text)]">Tax applies to this country</span>
          </label>
        </Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <button onClick={onClose} className={btnSecondary}>Cancel</button>
        <button onClick={handleSave} disabled={saving} className={btnPrimary}>
          {saving && <Loader2 className="w-4 h-4 animate-spin inline mr-1" />}Save
        </button>
      </div>
    </ModalOverlay>
  );
}
