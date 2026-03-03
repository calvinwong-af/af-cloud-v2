'use client';

import { useState, useRef, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BLFormState = Record<string, unknown>;

interface BLContainer {
  container_number: string | null;
  container_type: string | null;
  seal_number: string | null;
}

interface BLCargoItem {
  description: string | null;
  quantity: string | null;
  gross_weight: string | null;
  measurement: string | null;
}

interface Port {
  un_code: string;
  name: string;
  country: string;
  port_type: string;
  has_terminals: boolean;
  terminals: Array<{ terminal_id: string; name: string; is_default: boolean }>;
}

export interface BLReviewProps {
  formState: BLFormState;
  setFormState: (s: BLFormState) => void;
  ports: Port[];
  isApplying: boolean;
  applyError: string | null;
  onConfirm: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PREFILLED = 'bg-[#f0f7ff] border-[#93c5fd] font-medium';
const INPUT_BASE = 'w-full px-3 py-2 text-sm border rounded-lg text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--sky)] focus:border-transparent';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold text-[var(--text-mid)] mb-2">{children}</p>;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-[var(--text-mid)] mb-1">{children}</label>;
}

function str(v: unknown): string {
  if (v == null) return '';
  return String(v);
}

// ---------------------------------------------------------------------------
// PortCombobox widget
// ---------------------------------------------------------------------------

function PortCombobox({
  value, onChange, options, placeholder, className,
}: {
  value: string;
  onChange: (code: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selectedLabel = options.find(o => o.value === value)?.label ?? '';
  const displayText = open ? query : selectedLabel;
  const filtered = open
    ? options.filter(o =>
        o.label.toLowerCase().includes(query.toLowerCase()) ||
        o.value.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 30)
    : [];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false); setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={displayText}
        placeholder={placeholder ?? 'Search...'}
        className={className}
        onFocus={() => { setOpen(true); setQuery(''); }}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={e => { if (e.key === 'Escape') { setOpen(false); setQuery(''); } }}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-[var(--border)] rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.map(o => (
            <button
              key={o.value}
              type="button"
              onMouseDown={e => { e.preventDefault(); onChange(o.value); setOpen(false); setQuery(''); }}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-[var(--sky-mist)] ${o.value === value ? 'bg-[var(--sky-mist)] font-medium' : ''}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// BLReview component
// ---------------------------------------------------------------------------

export function BLReview({
  formState,
  setFormState,
  ports,
}: BLReviewProps) {
  const update = (key: string, value: unknown) => {
    setFormState({ ...formState, [key]: value });
  };

  const seaPorts = ports.filter(p => !p.port_type?.toLowerCase().includes('air'));
  const seaPortOptions = seaPorts.map(p => ({ value: p.un_code, label: `${p.un_code} — ${p.name || p.un_code}` }));

  const containers = (Array.isArray(formState.containers) ? formState.containers : []) as BLContainer[];
  const cargoItems = (Array.isArray(formState.cargo_items) ? formState.cargo_items : []) as BLCargoItem[];

  const updateContainer = (idx: number, field: keyof BLContainer, value: string) => {
    const updated = containers.map((c, i) => i === idx ? { ...c, [field]: value } : c);
    update('containers', updated);
  };

  const addContainer = () => {
    update('containers', [...containers, { container_number: '', container_type: '', seal_number: '' }]);
  };

  const removeContainer = (idx: number) => {
    update('containers', containers.filter((_, i) => i !== idx));
  };

  const updateCargoItem = (idx: number, field: keyof BLCargoItem, value: string) => {
    const updated = cargoItems.map((c, i) => i === idx ? { ...c, [field]: value } : c);
    update('cargo_items', updated);
  };

  const addCargoItem = () => {
    update('cargo_items', [...cargoItems, { description: '', quantity: '', gross_weight: '', measurement: '' }]);
  };

  const removeCargoItem = (idx: number) => {
    update('cargo_items', cargoItems.filter((_, i) => i !== idx));
  };

  return (
    <>
      {/* Carrier & Vessel */}
      <div>
        <SectionLabel>Carrier &amp; Vessel</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Carrier / Agent</FieldLabel>
            <input type="text" value={str(formState.carrier_agent ?? formState.carrier)} onChange={e => { update('carrier_agent', e.target.value); update('carrier', e.target.value); }} className={`${INPUT_BASE} ${str(formState.carrier_agent ?? formState.carrier) ? PREFILLED : ''}`} />
          </div>
          <div>
            <FieldLabel>Waybill / BL No.</FieldLabel>
            <input type="text" value={str(formState.waybill_number)} onChange={e => update('waybill_number', e.target.value)} className={`${INPUT_BASE} font-mono ${str(formState.waybill_number) ? PREFILLED : ''}`} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-2">
          <div>
            <FieldLabel>Vessel</FieldLabel>
            <input type="text" value={str(formState.vessel_name)} onChange={e => update('vessel_name', e.target.value)} className={`${INPUT_BASE} ${str(formState.vessel_name) ? PREFILLED : ''}`} />
          </div>
          <div>
            <FieldLabel>Voyage</FieldLabel>
            <input type="text" value={str(formState.voyage_number)} onChange={e => update('voyage_number', e.target.value)} className={`${INPUT_BASE} font-mono ${str(formState.voyage_number) ? PREFILLED : ''}`} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-2">
          <div>
            <FieldLabel>On Board Date</FieldLabel>
            <input type="date" value={str(formState.on_board_date)} onChange={e => update('on_board_date', e.target.value)} className={`${INPUT_BASE} ${str(formState.on_board_date) ? PREFILLED : ''}`} />
          </div>
        </div>
      </div>

      {/* Ports */}
      <div>
        <SectionLabel>Ports</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Port of Loading</FieldLabel>
            <PortCombobox
              value={str(formState.pol_code)}
              onChange={code => {
                const newPort = seaPorts.find(p => p.un_code === code);
                update('pol_code', code);
                if (!newPort?.has_terminals) update('pol_terminal', '');
              }}
              options={seaPortOptions}
              placeholder="Search port..."
              className={`${INPUT_BASE} ${str(formState.pol_code) ? PREFILLED : ''}`}
            />
            {str(formState.port_of_loading) && (
              <p className={`text-[11px] mt-0.5 italic ${str(formState.pol_code) ? 'text-[var(--text-muted)]' : 'text-amber-600'}`}>
                Parsed: &ldquo;{str(formState.port_of_loading)}&rdquo;{!str(formState.pol_code) && ' — not matched, select manually'}
              </p>
            )}
            {(() => {
              const selectedPort = seaPorts.find(p => p.un_code === str(formState.pol_code));
              if (!selectedPort?.has_terminals || !selectedPort.terminals.length) return null;
              return (
                <div className="mt-1.5">
                  <select
                    value={str(formState.pol_terminal)}
                    onChange={e => update('pol_terminal', e.target.value)}
                    className={`${INPUT_BASE} ${str(formState.pol_terminal) ? PREFILLED : ''}`}
                  >
                    <option value="">Select terminal...</option>
                    {selectedPort.terminals.map(t => (
                      <option key={t.terminal_id} value={t.terminal_id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              );
            })()}
          </div>
          <div>
            <FieldLabel>Port of Discharge</FieldLabel>
            <PortCombobox
              value={str(formState.pod_code)}
              onChange={code => {
                const newPort = seaPorts.find(p => p.un_code === code);
                update('pod_code', code);
                if (!newPort?.has_terminals) update('pod_terminal', '');
              }}
              options={seaPortOptions}
              placeholder="Search port..."
              className={`${INPUT_BASE} ${str(formState.pod_code) ? PREFILLED : ''}`}
            />
            {str(formState.port_of_discharge) && (
              <p className={`text-[11px] mt-0.5 italic ${str(formState.pod_code) ? 'text-[var(--text-muted)]' : 'text-amber-600'}`}>
                Parsed: &ldquo;{str(formState.port_of_discharge)}&rdquo;{!str(formState.pod_code) && ' — not matched, select manually'}
              </p>
            )}
            {(() => {
              const selectedPort = seaPorts.find(p => p.un_code === str(formState.pod_code));
              if (!selectedPort?.has_terminals || !selectedPort.terminals.length) return null;
              return (
                <div className="mt-1.5">
                  <select
                    value={str(formState.pod_terminal)}
                    onChange={e => update('pod_terminal', e.target.value)}
                    className={`${INPUT_BASE} ${str(formState.pod_terminal) ? PREFILLED : ''}`}
                  >
                    <option value="">Select terminal...</option>
                    {selectedPort.terminals.map(t => (
                      <option key={t.terminal_id} value={t.terminal_id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Shipper */}
      <div>
        <SectionLabel>Shipper</SectionLabel>
        <div>
          <FieldLabel>Name</FieldLabel>
          <input type="text" value={str(formState.shipper_name)} onChange={e => update('shipper_name', e.target.value)} className={`${INPUT_BASE} ${str(formState.shipper_name) ? PREFILLED : ''}`} />
        </div>
        <div className="mt-2">
          <FieldLabel>Address</FieldLabel>
          <textarea value={str(formState.shipper_address)} onChange={e => update('shipper_address', e.target.value)} rows={2} className={`${INPUT_BASE} resize-none ${str(formState.shipper_address) ? PREFILLED : ''}`} />
        </div>
      </div>

      {/* Consignee */}
      <div>
        <SectionLabel>Consignee</SectionLabel>
        <div>
          <FieldLabel>Name</FieldLabel>
          <input type="text" value={str(formState.consignee_name)} onChange={e => update('consignee_name', e.target.value)} className={`${INPUT_BASE} ${str(formState.consignee_name) ? PREFILLED : ''}`} />
        </div>
        <div className="mt-2">
          <FieldLabel>Address</FieldLabel>
          <textarea value={str(formState.consignee_address)} onChange={e => update('consignee_address', e.target.value)} rows={2} className={`${INPUT_BASE} resize-none ${str(formState.consignee_address) ? PREFILLED : ''}`} />
        </div>
      </div>

      {/* Notify Party */}
      {str(formState.notify_party_name) && (
        <div>
          <SectionLabel>Notify Party</SectionLabel>
          <div>
            <FieldLabel>Name</FieldLabel>
            <input type="text" value={str(formState.notify_party_name)} onChange={e => update('notify_party_name', e.target.value)} className={`${INPUT_BASE} ${PREFILLED}`} />
          </div>
        </div>
      )}

      {/* Containers */}
      {containers.length > 0 && (
        <div>
          <SectionLabel>Containers</SectionLabel>
          <div className="border border-[var(--border)] rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-[var(--surface)]">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-[var(--text-mid)]">Container No.</th>
                  <th className="px-3 py-2 text-left font-medium text-[var(--text-mid)]">Type</th>
                  <th className="px-3 py-2 text-left font-medium text-[var(--text-mid)]">Seal</th>
                  <th className="px-3 py-2 w-8" />
                </tr>
              </thead>
              <tbody>
                {containers.map((c, i) => (
                  <tr key={i} className="border-t border-[var(--border)]">
                    <td className="px-2 py-1.5">
                      <input type="text" value={str(c.container_number)} onChange={e => updateContainer(i, 'container_number', e.target.value)} className={`${INPUT_BASE} text-xs font-mono ${str(c.container_number) ? PREFILLED : ''}`} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="text" value={str(c.container_type)} onChange={e => updateContainer(i, 'container_type', e.target.value)} className={`${INPUT_BASE} text-xs ${str(c.container_type) ? PREFILLED : ''}`} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="text" value={str(c.seal_number)} onChange={e => updateContainer(i, 'seal_number', e.target.value)} className={`${INPUT_BASE} text-xs ${str(c.seal_number) ? PREFILLED : ''}`} />
                    </td>
                    <td className="px-2 py-1.5">
                      <button onClick={() => removeContainer(i)} className="p-1 rounded text-[var(--text-muted)] hover:text-red-500 hover:bg-red-50 transition-colors">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={addContainer} className="mt-1.5 flex items-center gap-1 text-xs text-[var(--sky)] hover:underline">
            <Plus className="w-3 h-3" /> Add row
          </button>
        </div>
      )}

      {/* Cargo Summary */}
      {cargoItems.length > 0 && (
        <div>
          <SectionLabel>Cargo Summary</SectionLabel>
          <div className="border border-[var(--border)] rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-[var(--surface)]">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-[var(--text-mid)]">Description</th>
                  <th className="px-3 py-2 text-left font-medium text-[var(--text-mid)]">Qty</th>
                  <th className="px-3 py-2 text-left font-medium text-[var(--text-mid)]">Weight</th>
                  <th className="px-3 py-2 text-left font-medium text-[var(--text-mid)]">CBM</th>
                  <th className="px-3 py-2 w-8" />
                </tr>
              </thead>
              <tbody>
                {cargoItems.map((c, i) => (
                  <tr key={i} className="border-t border-[var(--border)]">
                    <td className="px-2 py-1.5">
                      <input type="text" value={str(c.description)} onChange={e => updateCargoItem(i, 'description', e.target.value)} className={`${INPUT_BASE} text-xs ${str(c.description) ? PREFILLED : ''}`} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="text" value={str(c.quantity)} onChange={e => updateCargoItem(i, 'quantity', e.target.value)} className={`${INPUT_BASE} text-xs ${str(c.quantity) ? PREFILLED : ''}`} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="text" value={str(c.gross_weight)} onChange={e => updateCargoItem(i, 'gross_weight', e.target.value)} className={`${INPUT_BASE} text-xs ${str(c.gross_weight) ? PREFILLED : ''}`} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="text" value={str(c.measurement)} onChange={e => updateCargoItem(i, 'measurement', e.target.value)} className={`${INPUT_BASE} text-xs ${str(c.measurement) ? PREFILLED : ''}`} />
                    </td>
                    <td className="px-2 py-1.5">
                      <button onClick={() => removeCargoItem(i)} className="p-1 rounded text-[var(--text-muted)] hover:text-red-500 hover:bg-red-50 transition-colors">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={addCargoItem} className="mt-1.5 flex items-center gap-1 text-xs text-[var(--sky)] hover:underline">
            <Plus className="w-3 h-3" /> Add row
          </button>
        </div>
      )}
    </>
  );
}
