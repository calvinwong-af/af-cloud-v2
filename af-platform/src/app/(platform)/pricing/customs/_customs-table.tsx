'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import {
  fetchCustomsRatesAction,
  createCustomsRateAction,
  updateCustomsRateAction,
  deleteCustomsRateAction,
  fetchPricingCountriesAction,
} from '@/app/actions/pricing';
import type { CustomsRate, PricingCountry } from '@/app/actions/pricing';
import { fetchPortsAction } from '@/app/actions/shipments';
import { PortCombobox } from '@/components/shared/PortCombobox';
import { ToggleSwitch } from '../_components';
import { CustomsModal } from './_customs-modal';

const DIRECTION_OPTIONS = [
  { value: '', label: 'All Directions' },
  { value: 'IMPORT', label: 'Import' },
  { value: 'EXPORT', label: 'Export' },
];

export function CustomsTable() {
  const [rates, setRates] = useState<CustomsRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [countries, setCountries] = useState<PricingCountry[]>([]);
  const [countryFilter, setCountryFilter] = useState('');
  const [portFilter, setPortFilter] = useState('');
  const [directionFilter, setDirectionFilter] = useState('');
  const [textFilter, setTextFilter] = useState('');
  const [showInactive, setShowInactive] = useState(false);
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

  const prevCountry = useRef(countryFilter);
  useEffect(() => {
    if (prevCountry.current !== countryFilter) {
      setPortFilter('');
      setTextFilter('');
      prevCountry.current = countryFilter;
    }
  }, [countryFilter]);

  const fetchRates = useCallback(() => {
    setLoading(true);
    fetchCustomsRatesAction({
      portCode: portFilter || undefined,
      tradeDirection: directionFilter || undefined,
      isActive: showInactive ? undefined : true,
    }).then(r => {
      if (r?.success) setRates(r.data);
      setLoading(false);
    });
  }, [portFilter, directionFilter, showInactive]);

  useEffect(() => { fetchRates(); }, [fetchRates]);

  // Derive port options from rates, filtered by country
  const portComboOptions = useMemo(() => {
    const portCodes = Array.from(new Set(rates.map(r => r.port_code)))
      .filter(code => !countryFilter || code.startsWith(countryFilter))
      .sort();
    return [
      { value: '', label: 'All Ports' },
      ...portCodes.map(code => ({
        value: code,
        label: code,
        sublabel: portsMap[code]?.name ?? '',
      })),
    ];
  }, [rates, countryFilter, portsMap]);

  const filteredRates = useMemo(() => {
    let result = rates;
    if (countryFilter) {
      result = result.filter(r => r.port_code.startsWith(countryFilter));
    }
    if (!textFilter.trim()) return result;
    const q = textFilter.trim().toLowerCase();
    return result.filter(r =>
      r.port_code.toLowerCase().includes(q) ||
      (portsMap[r.port_code]?.name ?? '').toLowerCase().includes(q) ||
      r.charge_code.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q)
    );
  }, [rates, countryFilter, textFilter, portsMap]);

  const handleSave = async (data: Omit<CustomsRate, 'id' | 'created_at' | 'updated_at'>) => {
    if (editRate) {
      await updateCustomsRateAction(editRate.id, data);
    } else {
      await createCustomsRateAction(data);
    }
    fetchRates();
  };

  const handleDelete = async (id: number) => {
    await deleteCustomsRateAction(id);
    fetchRates();
  };

  const directionBadge = (d: string) => {
    const cls = d === 'IMPORT'
      ? 'bg-blue-50 text-blue-700'
      : 'bg-emerald-50 text-emerald-700';
    return <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${cls}`}>{d}</span>;
  };

  const typeBadge = (t: string) => {
    const colors: Record<string, string> = {
      FCL: 'bg-sky-50 text-sky-700',
      LCL: 'bg-violet-50 text-violet-700',
      AIR: 'bg-orange-50 text-orange-700',
      CB: 'bg-slate-100 text-slate-600',
    };
    return <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${colors[t] ?? 'bg-slate-100 text-slate-600'}`}>{t}</span>;
  };

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
          <PortCombobox value={countryFilter} onChange={setCountryFilter} options={countryOptions} placeholder="All Countries" />
        </div>
        <div className="w-44">
          <PortCombobox value={portFilter} onChange={setPortFilter} options={portComboOptions} placeholder="All Ports" />
        </div>
        <div className="w-44">
          <PortCombobox value={directionFilter} onChange={setDirectionFilter} options={DIRECTION_OPTIONS} placeholder="All Directions" />
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
          placeholder="Filter by port, charge code, description..."
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

      <div className="bg-white rounded-xl border border-[var(--border)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface)]">
                <th className="text-left px-3 py-2 text-xs font-medium text-[var(--text-muted)]">Port</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-[var(--text-muted)]">Direction</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-[var(--text-muted)]">Type</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-[var(--text-muted)]">Charge</th>
                <th className="text-right px-3 py-2 text-xs font-medium text-[var(--text-muted)]">Amount</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-[var(--text-muted)]">UOM</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-[var(--text-muted)]">Effective</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-[var(--text-muted)]">Status</th>
                <th className="text-right px-3 py-2 text-xs font-medium text-[var(--text-muted)]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="px-3 py-8 text-center text-[var(--text-muted)]">Loading...</td></tr>
              ) : filteredRates.length === 0 ? (
                <tr><td colSpan={9} className="px-3 py-8 text-center text-[var(--text-muted)]">No rates found</td></tr>
              ) : filteredRates.map(rate => (
                <tr key={rate.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface)]/50">
                  <td className="px-3 py-2 font-mono text-xs">{rate.port_code}</td>
                  <td className="px-3 py-2">{directionBadge(rate.trade_direction)}</td>
                  <td className="px-3 py-2">{typeBadge(rate.shipment_type)}</td>
                  <td className="px-3 py-2">
                    <span className="text-xs font-medium">{rate.charge_code}</span>
                    <span className="text-xs text-[var(--text-muted)] ml-1.5">{rate.description}</span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs">
                    {rate.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} {rate.currency}
                  </td>
                  <td className="px-3 py-2 text-xs text-[var(--text-muted)]">{rate.uom}</td>
                  <td className="px-3 py-2 text-xs text-[var(--text-muted)]">
                    {rate.effective_from} &rarr; {rate.effective_to ?? 'Open'}
                  </td>
                  <td className="px-3 py-2">
                    {rate.is_active
                      ? <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600">Active</span>
                      : <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">Inactive</span>
                    }
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => { setEditRate(rate); setModalOpen(true); }}
                        className="p-1 rounded hover:bg-[var(--surface)] transition-colors" title="Edit">
                        <Pencil size={13} className="text-[var(--text-muted)]" />
                      </button>
                      <button onClick={() => handleDelete(rate.id)}
                        className="p-1 rounded hover:bg-red-50 transition-colors" title="Delete">
                        <Trash2 size={13} className="text-[var(--text-muted)] hover:text-red-500" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-xs text-[var(--text-muted)]">
        {filteredRates.length}{filteredRates.length !== rates.length ? ` of ${rates.length}` : ''} rate{filteredRates.length !== 1 ? 's' : ''}
      </div>

      <CustomsModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditRate(null); }}
        onSave={handleSave}
        editRate={editRate}
      />
    </div>
  );
}
