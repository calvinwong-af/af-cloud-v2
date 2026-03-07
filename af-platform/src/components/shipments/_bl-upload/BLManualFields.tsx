'use client';

import { useState, useRef, useEffect } from 'react';
import { DateTimeInput } from '@/components/shared/DateInput';
import TerminalSelector from '@/components/shared/TerminalSelector';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Port {
  un_code: string;
  name: string;
  country_name: string;
  port_type: string;
  has_terminals: boolean;
  terminals: Array<{ terminal_id: string; name: string; is_default: boolean }>;
}

export interface BLFormState {
  originCode: string;
  originTerminalId: string;
  destCode: string;
  destTerminalId: string;
  etd: string;
  carrier: string;
  waybillNumber: string;
  vesselName: string;
  voyageNumber: string;
  consigneeName: string;
  shipperName: string;
  shipperAddress: string;
  consigneeAddress: string;
  notifyPartyName: string;
  cargoDescription: string;
  cargoWeight: string;
  customerReference: string;
  linkedCompanyId: string | null;
  companyMatchDismissed: boolean;
  originParsedLabel: string | null;
  destParsedLabel: string | null;
  orderType: string;
  transactionType: string;
  incotermCode: string;
  // AWB-specific fields
  awbType: string;
  mawbNumber: string;
  hawbNumber: string;
  flightNumber: string;
  flightDate: string;
  pieces: string;
  chargeableWeightKg: string;
}

interface BLManualFieldsProps {
  formState: BLFormState;
  onChange: (updates: Partial<BLFormState>) => void;
  ports: Port[];
  notifyPartyNameFromParsed?: string | null;
}

// ─── Port combobox ───────────────────────────────────────────────────────────

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

// ─── Small helpers ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold text-[var(--text-mid)] mb-2">{children}</p>;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-[var(--text-mid)] mb-1">{children}</label>;
}

// Pre-filled field styling
const prefilled = 'bg-[#f0f7ff] border-[#93c5fd] font-medium';
const inputBase = 'w-full px-3 py-2 text-sm border rounded-lg text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--sky)] focus:border-transparent';

// ─── Component ───────────────────────────────────────────────────────────────

export function BLManualFields({ formState, onChange, ports, notifyPartyNameFromParsed }: BLManualFieldsProps) {
  const isAWB = formState.orderType === 'AIR';

  const seaPorts = ports.filter(p => !(p.port_type?.toLowerCase().includes('air') ?? false));
  const airPorts = ports.filter(p => p.port_type?.toLowerCase().includes('air') ?? false);
  const seaPortOptions = seaPorts.map(p => ({ value: p.un_code, label: `${p.un_code} — ${p.name || p.un_code}` }));
  const airPortOptions = airPorts.map(p => ({ value: p.un_code, label: `${p.un_code} — ${p.name || p.un_code}` }));

  return (
    <div className="space-y-4">
      {/* Shipment Type */}
      <div>
        <SectionLabel>Shipment Type</SectionLabel>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <FieldLabel>Order Type</FieldLabel>
            <select
              value={formState.orderType}
              onChange={e => onChange({ orderType: e.target.value })}
              className={inputBase}
            >
              <option value="SEA_FCL">Sea FCL</option>
              <option value="SEA_LCL">Sea LCL</option>
              <option value="AIR">Air</option>
            </select>
          </div>
          <div>
            <FieldLabel>Transaction</FieldLabel>
            <select
              value={formState.transactionType}
              onChange={e => {
                const newTxn = e.target.value;
                const updates: Partial<BLFormState> = { transactionType: newTxn };
                if (newTxn === 'EXPORT' && formState.incotermCode === 'EXW') {
                  updates.incotermCode = 'FOB';
                }
                onChange(updates);
              }}
              className={inputBase}
            >
              <option value="IMPORT">IMPORT</option>
              <option value="EXPORT">EXPORT</option>
            </select>
          </div>
          <div>
            <FieldLabel>Incoterm</FieldLabel>
            <select
              value={formState.incotermCode}
              onChange={e => onChange({ incotermCode: e.target.value })}
              className={inputBase}
            >
              {['EXW','FCA','FAS','FOB','CFR','CNF','CIF','CPT','CIP','DAP','DPU','DDP']
                .filter(i => !(formState.transactionType === 'EXPORT' && i === 'EXW'))
                .map(i => (
                  <option key={i} value={i}>{i}</option>
                ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── AWB-specific form ── */}
      {isAWB ? (
        <>
          {/* Route & Dates — AWB */}
          <div>
            <SectionLabel>Route & Dates</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Origin Airport</FieldLabel>
                <PortCombobox
                  value={formState.originCode}
                  onChange={code => onChange({ originCode: code })}
                  options={airPortOptions}
                  placeholder="Search airport..."
                  className={`${inputBase} ${formState.originCode ? prefilled : ''}`}
                />
                {formState.originParsedLabel && (
                  formState.originCode ? (
                    <p className="text-[11px] text-[var(--text-muted)] italic mt-0.5">Parsed: &ldquo;{formState.originParsedLabel}&rdquo;</p>
                  ) : (
                    <p className="text-[11px] text-amber-600 italic mt-0.5">Parsed: &ldquo;{formState.originParsedLabel}&rdquo; — not matched, select manually</p>
                  )
                )}
              </div>
              <div>
                <FieldLabel>Destination Airport</FieldLabel>
                <PortCombobox
                  value={formState.destCode}
                  onChange={code => onChange({ destCode: code })}
                  options={airPortOptions}
                  placeholder="Search airport..."
                  className={`${inputBase} ${formState.destCode ? prefilled : ''}`}
                />
                {formState.destParsedLabel && (
                  formState.destCode ? (
                    <p className="text-[11px] text-[var(--text-muted)] italic mt-0.5">Parsed: &ldquo;{formState.destParsedLabel}&rdquo;</p>
                  ) : (
                    <p className="text-[11px] text-amber-600 italic mt-0.5">Parsed: &ldquo;{formState.destParsedLabel}&rdquo; — not matched, select manually</p>
                  )
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <FieldLabel>Flight Number</FieldLabel>
                <input
                  type="text"
                  value={formState.flightNumber}
                  onChange={e => onChange({ flightNumber: e.target.value })}
                  className={`${inputBase} font-mono ${formState.flightNumber ? prefilled : ''}`}
                  placeholder="e.g. MH370"
                />
              </div>
              <div>
                <FieldLabel>Flight Date</FieldLabel>
                <DateTimeInput
                  value={formState.flightDate}
                  onChange={v => onChange({ flightDate: v })}
                  className={`${inputBase} ${formState.flightDate ? prefilled : ''}`}
                />
              </div>
            </div>
          </div>

          {/* AWB Numbers */}
          <div>
            <SectionLabel>AWB Numbers</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>MAWB Number</FieldLabel>
                <input
                  type="text"
                  value={formState.mawbNumber}
                  onChange={e => onChange({ mawbNumber: e.target.value })}
                  className={`${inputBase} font-mono ${formState.mawbNumber ? prefilled : ''}`}
                />
              </div>
              {(formState.awbType === 'HOUSE' || formState.hawbNumber) && (
                <div>
                  <FieldLabel>HAWB Number</FieldLabel>
                  <input
                    type="text"
                    value={formState.hawbNumber}
                    onChange={e => onChange({ hawbNumber: e.target.value })}
                    className={`${inputBase} font-mono ${formState.hawbNumber ? prefilled : ''}`}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Shipper */}
          <div>
            <SectionLabel>Shipper</SectionLabel>
            <div>
              <FieldLabel>Name</FieldLabel>
              <input type="text" value={formState.shipperName} onChange={e => onChange({ shipperName: e.target.value })} className={`${inputBase} ${formState.shipperName ? prefilled : ''}`} />
            </div>
            <div className="mt-2">
              <FieldLabel>Address</FieldLabel>
              <textarea value={formState.shipperAddress} onChange={e => onChange({ shipperAddress: e.target.value })} rows={2} className={`${inputBase} resize-none ${formState.shipperAddress ? prefilled : ''}`} />
            </div>
          </div>

          {/* Consignee */}
          <div>
            <SectionLabel>Consignee</SectionLabel>
            <div>
              <FieldLabel>Name</FieldLabel>
              <input type="text" value={formState.consigneeName} onChange={e => onChange({ consigneeName: e.target.value })} className={`${inputBase} ${formState.consigneeName ? prefilled : ''}`} />
            </div>
            <div className="mt-2">
              <FieldLabel>Address</FieldLabel>
              <textarea value={formState.consigneeAddress} onChange={e => onChange({ consigneeAddress: e.target.value })} rows={2} className={`${inputBase} resize-none ${formState.consigneeAddress ? prefilled : ''}`} />
            </div>
          </div>

          {/* Cargo */}
          <div>
            <SectionLabel>Cargo</SectionLabel>
            <div>
              <FieldLabel>Description</FieldLabel>
              <textarea value={formState.cargoDescription} onChange={e => onChange({ cargoDescription: e.target.value })} rows={2} className={`${inputBase} resize-none ${formState.cargoDescription ? prefilled : ''}`} />
            </div>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <FieldLabel>Pieces</FieldLabel>
                <input type="text" value={formState.pieces} onChange={e => onChange({ pieces: e.target.value })} className={`${inputBase} w-full ${formState.pieces ? prefilled : ''}`} />
              </div>
              <div>
                <FieldLabel>Chargeable Weight (kg)</FieldLabel>
                <input type="text" value={formState.chargeableWeightKg} onChange={e => onChange({ chargeableWeightKg: e.target.value })} className={`${inputBase} w-full ${formState.chargeableWeightKg ? prefilled : ''}`} />
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* ── Sea/BC form ── */}

          {/* Route & Dates */}
          <div>
            <SectionLabel>Route & Dates</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Origin Port</FieldLabel>
                <PortCombobox
                  value={formState.originCode}
                  onChange={code => onChange({ originCode: code })}
                  options={seaPortOptions}
                  placeholder="Search port..."
                  className={`${inputBase} ${formState.originCode ? prefilled : ''}`}
                />
                {formState.originParsedLabel && (
                  formState.originCode ? (
                    <p className="text-[11px] text-[var(--text-muted)] italic mt-0.5">Parsed from BL: &ldquo;{formState.originParsedLabel}&rdquo;</p>
                  ) : (
                    <p className="text-[11px] text-amber-600 italic mt-0.5">Parsed from BL: &ldquo;{formState.originParsedLabel}&rdquo; — not matched, please select manually</p>
                  )
                )}
                {(() => {
                  const port = ports.find(p => p.un_code === formState.originCode);
                  return port?.has_terminals ? (
                    <TerminalSelector
                      terminals={port.terminals}
                      value={formState.originTerminalId}
                      onChange={v => onChange({ originTerminalId: v })}
                    />
                  ) : null;
                })()}
              </div>
              <div>
                <FieldLabel>Destination Port</FieldLabel>
                <PortCombobox
                  value={formState.destCode}
                  onChange={code => onChange({ destCode: code })}
                  options={seaPortOptions}
                  placeholder="Search port..."
                  className={`${inputBase} ${formState.destCode ? prefilled : ''}`}
                />
                {formState.destParsedLabel && (
                  formState.destCode ? (
                    <p className="text-[11px] text-[var(--text-muted)] italic mt-0.5">Parsed from BL: &ldquo;{formState.destParsedLabel}&rdquo;</p>
                  ) : (
                    <p className="text-[11px] text-amber-600 italic mt-0.5">Parsed from BL: &ldquo;{formState.destParsedLabel}&rdquo; — not matched, please select manually</p>
                  )
                )}
                {(() => {
                  const port = ports.find(p => p.un_code === formState.destCode);
                  return port?.has_terminals ? (
                    <TerminalSelector
                      terminals={port.terminals}
                      value={formState.destTerminalId}
                      onChange={v => onChange({ destTerminalId: v })}
                    />
                  ) : null;
                })()}
              </div>
            </div>
            <div className="mt-3">
              <FieldLabel>ETD (On Board Date)</FieldLabel>
              <DateTimeInput
                value={formState.etd}
                onChange={v => onChange({ etd: v })}
                className={`${inputBase} w-56 ${formState.etd ? prefilled : ''}`}
              />
            </div>
          </div>

          {/* Carrier & Vessel */}
          <div>
            <SectionLabel>Carrier / Agent & Vessel</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Carrier / Agent</FieldLabel>
                <input type="text" value={formState.carrier} onChange={e => onChange({ carrier: e.target.value })} className={`${inputBase} ${formState.carrier ? prefilled : ''}`} />
              </div>
              <div>
                <FieldLabel>Booking Ref / BL No.</FieldLabel>
                <input type="text" value={formState.waybillNumber} onChange={e => onChange({ waybillNumber: e.target.value })} className={`${inputBase} font-mono ${formState.waybillNumber ? prefilled : ''}`} />
              </div>
              <div>
                <FieldLabel>Vessel</FieldLabel>
                <input type="text" value={formState.vesselName} onChange={e => onChange({ vesselName: e.target.value })} className={`${inputBase} ${formState.vesselName ? prefilled : ''}`} />
              </div>
              <div>
                <FieldLabel>Voyage</FieldLabel>
                <input type="text" value={formState.voyageNumber} onChange={e => onChange({ voyageNumber: e.target.value })} className={`${inputBase} font-mono ${formState.voyageNumber ? prefilled : ''}`} />
              </div>
            </div>
          </div>

          {/* Shipper */}
          <div>
            <SectionLabel>Shipper</SectionLabel>
            <div>
              <FieldLabel>Name</FieldLabel>
              <input type="text" value={formState.shipperName} onChange={e => onChange({ shipperName: e.target.value })} className={`${inputBase} ${formState.shipperName ? prefilled : ''}`} />
            </div>
            <div className="mt-2">
              <FieldLabel>Address</FieldLabel>
              <textarea value={formState.shipperAddress} onChange={e => onChange({ shipperAddress: e.target.value })} rows={2} className={`${inputBase} resize-none ${formState.shipperAddress ? prefilled : ''}`} />
            </div>
          </div>

          {/* Customer (Consignee) */}
          <div>
            <SectionLabel>Customer (Consignee)</SectionLabel>
            <div>
              <FieldLabel>Consignee Name</FieldLabel>
              <input type="text" value={formState.consigneeName} onChange={e => onChange({ consigneeName: e.target.value })} className={`${inputBase} ${formState.consigneeName ? prefilled : ''}`} />
            </div>
            <div className="mt-2">
              <FieldLabel>Address</FieldLabel>
              <textarea value={formState.consigneeAddress} onChange={e => onChange({ consigneeAddress: e.target.value })} rows={2} className={`${inputBase} resize-none ${formState.consigneeAddress ? prefilled : ''}`} />
            </div>
          </div>

          {/* Notify Party (conditional) */}
          {(formState.notifyPartyName || notifyPartyNameFromParsed) && (
            <div>
              <SectionLabel>Notify Party</SectionLabel>
              <div>
                <FieldLabel>Name</FieldLabel>
                <input type="text" value={formState.notifyPartyName} onChange={e => onChange({ notifyPartyName: e.target.value })} className={`${inputBase} ${formState.notifyPartyName ? prefilled : ''}`} />
              </div>
            </div>
          )}

          {/* Cargo */}
          <div>
            <SectionLabel>Cargo</SectionLabel>
            <div>
              <FieldLabel>Description</FieldLabel>
              <textarea value={formState.cargoDescription} onChange={e => onChange({ cargoDescription: e.target.value })} rows={2} className={`${inputBase} resize-none ${formState.cargoDescription ? prefilled : ''}`} />
            </div>
            <div className="mt-2">
              <FieldLabel>Total Weight (kg)</FieldLabel>
              <input type="text" value={formState.cargoWeight} onChange={e => onChange({ cargoWeight: e.target.value })} className={`${inputBase} w-40 ${formState.cargoWeight ? prefilled : ''}`} />
            </div>
          </div>
        </>
      )}

      {/* Customer Reference */}
      <div>
        <FieldLabel>Customer Reference (optional)</FieldLabel>
        <input
          type="text"
          value={formState.customerReference}
          onChange={e => onChange({ customerReference: e.target.value })}
          placeholder="e.g. PO number, booking ref"
          className={inputBase}
        />
      </div>
    </div>
  );
}
