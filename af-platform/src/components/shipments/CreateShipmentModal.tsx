'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createShipmentOrderAction, CreateShipmentOrderPayload, createShipmentFromBLAction, type CreateFromBLPayload } from '@/app/actions/shipments-write';
import BLUploadTab, { type BLFormState, getDefaultBLFormState } from './BLUploadTab';
import TerminalSelector from '@/components/shared/TerminalSelector';

// ─── Constants ────────────────────────────────────────────────────────────────

const CONTAINER_SIZES = ['20GP', '40GP', '40HC', '45HC', '20RF', '40RF'];
const CONTAINER_TYPES = ['DRY', 'REEFER', 'OPEN_TOP', 'FLAT_RACK'];
const INCOTERMS = ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CNF', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'];

const ORDER_TYPES = [
  { value: 'SEA_FCL', label: 'Sea Freight — FCL', sublabel: 'Full Container Load' },
  { value: 'SEA_LCL', label: 'Sea Freight — LCL', sublabel: 'Less than Container Load' },
  { value: 'AIR',     label: 'Air Freight',        sublabel: 'Airport to Airport' },
] as const;

type OrderType = 'SEA_FCL' | 'SEA_LCL' | 'AIR';

const PACKAGING_TYPES = [
  { value: 'CARTON', label: 'Carton' },
  { value: 'PALLET', label: 'Pallet' },
  { value: 'CRATE',  label: 'Crate' },
  { value: 'DRUM',   label: 'Drum' },
  { value: 'BAG',    label: 'Bag' },
  { value: 'BUNDLE', label: 'Bundle' },
  { value: 'OTHER',  label: 'Other' },
];

const BASE_STEPS = [
  { id: 1, label: 'Order' },
  { id: 2, label: 'Route' },
  { id: 3, label: 'Cargo' },
  { id: 4, label: 'Containers' },
  { id: 5, label: 'Review' },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface ContainerRow {
  container_size: string;
  container_type: string;
  quantity: number;
}

interface PackageRow {
  packaging_type: string;
  quantity: number;
  gross_weight_kg: number | null;
  volume_cbm: number | null;
}

interface Company {
  company_id: string;
  name: string;
}

interface Port {
  un_code: string;
  name: string;
  country: string;
  port_type: string;
  has_terminals: boolean;
  terminals: Array<{ terminal_id: string; name: string; is_default: boolean }>;
}

interface Props {
  companies: Company[];
  ports: Port[];
  onClose: () => void;
  onCreated: (shipmentOrderId: string) => void;
}

// ─── Port filtering ───────────────────────────────────────────────────────────

function isAirport(port: Port): boolean {
  // Matches port_type values like 'AIR', 'airport', 'AIRPORT', 'air_port' etc.
  return port.port_type?.toLowerCase().includes('air') ?? false;
}

function getSeaPorts(ports: Port[]): Port[] {
  return ports.filter(p => !isAirport(p));
}

function getAirports(ports: Port[]): Port[] {
  return ports.filter(p => isAirport(p));
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-medium text-[var(--text-mid)] mb-1">
      {children}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center gap-1 mb-6">
      {BASE_STEPS.map((step, i) => (
        <div key={step.id} className="flex items-center gap-1">
          <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold transition-colors ${
            step.id < currentStep ? 'bg-[var(--sky)] text-white'
              : step.id === currentStep ? 'bg-[var(--slate)] text-white'
              : 'bg-[var(--border)] text-[var(--text-muted)]'
          }`}>
            {step.id < currentStep ? '✓' : step.id}
          </div>
          <span className={`text-xs hidden sm:inline ${step.id === currentStep ? 'text-[var(--text)] font-medium' : 'text-[var(--text-muted)]'}`}>
            {step.label}
          </span>
          {i < BASE_STEPS.length - 1 && <div className="w-4 h-px bg-[var(--border)] mx-1" />}
        </div>
      ))}
    </div>
  );
}

// ─── Date Input (DD / MMM / YYYY) ────────────────────────────────────────────

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function DateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  // value = 'YYYY-MM-DD' or ''
  const parts = value ? value.split('-') : ['', '', ''];
  const year  = parts[0] ?? '';
  const month = parts[1] ?? '';
  const day   = parts[2] ?? '';

  function emit(d: string, m: string, y: string) {
    if (d && m && y && y.length === 4) {
      onChange(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`);
    } else if (!d && !m && !y) {
      onChange('');
    }
  }

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => currentYear + i);
  const days  = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));

  const sel = "px-2 py-2 text-sm border border-[var(--border)] rounded-lg bg-white text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--sky)] focus:border-transparent";

  return (
    <div className="flex items-center gap-2">
      {/* Day */}
      <select value={day} onChange={e => emit(e.target.value, month, year)} className={`${sel} w-[72px]`}>
        <option value="">DD</option>
        {days.map(d => <option key={d} value={d}>{d}</option>)}
      </select>
      {/* Month */}
      <select value={month ? String(parseInt(month)) : ''} onChange={e => { const m = e.target.value ? String(parseInt(e.target.value)).padStart(2,'0') : ''; emit(day, m, year); }} className={`${sel} w-[88px]`}>
        <option value="">MMM</option>
        {MONTHS.map((label, i) => <option key={label} value={String(i+1)}>{label}</option>)}
      </select>
      {/* Year */}
      <select value={year} onChange={e => emit(day, month, e.target.value)} className={`${sel} w-[88px]`}>
        <option value="">YYYY</option>
        {years.map(y => <option key={y} value={String(y)}>{y}</option>)}
      </select>
    </div>
  );
}

// ─── Searchable Combobox ──────────────────────────────────────────────────────

function Combobox({ value, onChange, options, placeholder }: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; sublabel?: string }[];
  placeholder?: string;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState<number>(-1);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!value) setQuery('');
  }, [value]);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setHighlighted(-1);
        const selected = options.find(o => o.value === value);
        setQuery(selected?.label ?? '');
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [value, options]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlighted >= 0 && listRef.current) {
      const item = listRef.current.children[highlighted] as HTMLElement;
      item?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlighted]);

  const filtered = query.trim().length === 0
    ? options.slice(0, 80)
    : options.filter(o =>
        o.label.toLowerCase().includes(query.toLowerCase()) ||
        o.value.toLowerCase().includes(query.toLowerCase()) ||
        (o.sublabel ?? '').toLowerCase().includes(query.toLowerCase())
      ).slice(0, 80);

  const selectedLabel = options.find(o => o.value === value)?.label ?? '';
  const inputValue = open ? query : selectedLabel;

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setQuery('');
        setOpen(true);
        setHighlighted(0);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlighted(h => Math.min(h + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlighted(h => Math.max(h - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlighted >= 0 && filtered[highlighted]) {
          const chosen = filtered[highlighted];
          onChange(chosen.value);
          setQuery(chosen.label);
          setOpen(false);
          setHighlighted(-1);
        }
        break;
      case 'Escape':
        setOpen(false);
        setHighlighted(-1);
        {
          const selected = options.find(o => o.value === value);
          setQuery(selected?.label ?? '');
        }
        break;
      case 'Tab':
        setOpen(false);
        setHighlighted(-1);
        break;
    }
  }

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={inputValue}
        onChange={e => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlighted(0);
          if (e.target.value === '') onChange('');
        }}
        onFocus={() => {
          setQuery('');
          setOpen(true);
          setHighlighted(-1);
        }}
        onMouseDown={() => {
          if (!open) {
            setQuery('');
            setOpen(true);
            setHighlighted(-1);
          }
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--sky)] focus:border-transparent"
      />
      {open && filtered.length > 0 && (
        <div
          ref={listRef}
          className="absolute z-50 w-full mt-1 bg-white border border-[var(--border)] rounded-lg shadow-lg max-h-56 overflow-y-auto"
        >
          {filtered.map((o, i) => (
            <div
              key={o.value}
              onMouseDown={e => {
                e.preventDefault();
                onChange(o.value);
                setQuery(o.label);
                setOpen(false);
                setHighlighted(-1);
              }}
              onMouseEnter={() => setHighlighted(i)}
              className={`px-3 py-2 text-sm cursor-pointer ${
                i === highlighted
                  ? 'bg-[var(--sky-mist)]'
                  : o.value === value
                  ? 'bg-[var(--sky-pale)]'
                  : 'hover:bg-[var(--sky-mist)]'
              }`}
            >
              <div className="text-[var(--text)]">{o.label}</div>
              {o.sublabel && <div className="text-xs text-[var(--text-muted)]">{o.sublabel}</div>}
            </div>
          ))}
        </div>
      )}
      {open && filtered.length === 0 && query.trim().length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-[var(--border)] rounded-lg shadow-lg px-3 py-2 text-sm text-[var(--text-muted)]">
          No results for &quot;{query}&quot;
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CreateShipmentModal({ companies, ports, onClose, onCreated }: Props) {
  const [activeTab, setActiveTab] = useState<'manual' | 'bl'>('manual');

  // ── BL Upload state ──
  const [blParsedResult, setBLParsedResult] = useState<Record<string, unknown> | null>(null);
  const [blFormState, setBLFormState] = useState<BLFormState>(getDefaultBLFormState());
  const [blConfirmReady, setBLConfirmReady] = useState(false);
  const [blSubmitting, setBLSubmitting] = useState(false);
  const [blError, setBLError] = useState<string | null>(null);

  const handleBLConfirmCreate = useCallback(async () => {
    if (!blParsedResult || !blConfirmReady) return;
    setBLSubmitting(true);
    setBLError(null);

    const parsed = (blParsedResult as Record<string, unknown>).parsed as Record<string, unknown> | undefined;

    try {
      const originPort = ports.find(p => p.un_code === blFormState.originCode);
      const destPort = ports.find(p => p.un_code === blFormState.destCode);

      const payload: CreateFromBLPayload = {
        order_type: (blParsedResult as Record<string, unknown>).order_type as string ?? 'SEA_FCL',
        transaction_type: 'IMPORT',
        incoterm_code: 'CNF',
        company_id: blFormState.linkedCompanyId,
        origin_port_un_code: blFormState.originCode || null,
        origin_terminal_id: blFormState.originTerminalId || null,
        origin_label: originPort?.name ?? (blFormState.originCode || null),
        destination_port_un_code: blFormState.destCode || null,
        destination_terminal_id: blFormState.destTerminalId || null,
        destination_label: destPort?.name ?? (blFormState.destCode || null),
        cargo_description: blFormState.cargoDescription || null,
        cargo_weight_kg: blFormState.cargoWeight ? parseFloat(blFormState.cargoWeight) : null,
        etd: blFormState.etd || null,
        initial_status: (blParsedResult as Record<string, unknown>).initial_status as number ?? 3001,
        carrier: blFormState.carrier || null,
        waybill_number: blFormState.waybillNumber || null,
        vessel_name: blFormState.vesselName || null,
        voyage_number: blFormState.voyageNumber || null,
        shipper_name: blFormState.shipperName || null,
        shipper_address: blFormState.shipperAddress || null,
        consignee_name: blFormState.consigneeName || null,
        consignee_address: blFormState.consigneeAddress || null,
        notify_party_name: blFormState.notifyPartyName || null,
        containers: (parsed?.containers as CreateFromBLPayload['containers']) ?? null,
        customer_reference: blFormState.customerReference || null,
      };

      const result = await createShipmentFromBLAction(payload);
      setBLSubmitting(false);

      if (!result) {
        setBLError('No response from server');
        return;
      }
      if (!result.success) {
        setBLError(result.error ?? 'Failed to create shipment');
        return;
      }

      onCreated(result.shipment_id);
    } catch (err) {
      console.error('[CreateShipmentModal] BL create error:', err);
      setBLSubmitting(false);
      setBLError('Failed to create shipment');
    }
  }, [blParsedResult, blConfirmReady, blFormState, ports, onCreated]);

  // ── Manual Entry state ──
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Order
  const [orderType, setOrderType] = useState<OrderType>('SEA_FCL');
  const [transactionType, setTransactionType] = useState<'IMPORT' | 'EXPORT'>('IMPORT');
  const [companyId, setCompanyId] = useState('');
  const [cargoReadyDate, setCargoReadyDate] = useState<string>(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  });

  // Step 2: Route
  const [originCode, setOriginCode] = useState('');
  const [destCode, setDestCode] = useState('');
  const [originTerminalId, setOriginTerminalId] = useState('');
  const [destTerminalId, setDestTerminalId] = useState('');
  const [incoterm, setIncoterm] = useState('');

  // Step 3: Cargo
  const [cargoDesc, setCargoDesc] = useState('');
  const [cargoHsCode, setCargoHsCode] = useState('');
  const [cargoDg, setCargoDg] = useState(false);

  // Step 4: Containers (SEA_FCL)
  const [containers, setContainers] = useState<ContainerRow[]>([
    { container_size: '20GP', container_type: 'DRY', quantity: 1 },
  ]);

  // Step 4: Packages (SEA_LCL / AIR)
  const [packages, setPackages] = useState<PackageRow[]>([
    { packaging_type: 'CARTON', quantity: 1, gross_weight_kg: null, volume_cbm: null },
  ]);

  // ── Derived data ──
  const seaPorts = getSeaPorts(ports);
  const airports = getAirports(ports);
  const activePorts = orderType === 'AIR' ? airports : seaPorts;
  const portOptions = activePorts.map(p => ({
    value: p.un_code,
    label: p.name || p.un_code,
    sublabel: `${p.un_code}${p.country ? ' · ' + p.country : ''}`,
  }));

  const incotermOptions = INCOTERMS.map(i => ({ value: i, label: i }));

  const companyOptions = companies.map(c => ({
    value: c.company_id,
    label: c.name,
    sublabel: c.company_id,
  }));

  const originPort = activePorts.find(p => p.un_code === originCode);
  const destPort = activePorts.find(p => p.un_code === destCode);
  const selectedCompany = companies.find(c => c.company_id === companyId);

  // ── Container helpers ──
  function addContainer() {
    setContainers([...containers, { container_size: '20GP', container_type: 'DRY', quantity: 1 }]);
  }
  function removeContainer(i: number) {
    if (containers.length > 1) setContainers(containers.filter((_, idx) => idx !== i));
  }
  function updateContainer(i: number, field: keyof ContainerRow, value: string | number) {
    setContainers(containers.map((c, idx) => idx === i ? { ...c, [field]: value } : c));
  }

  // ── Package helpers ──
  function addPackage() {
    setPackages([...packages, { packaging_type: 'CARTON', quantity: 1, gross_weight_kg: null, volume_cbm: null }]);
  }
  function removePackage(i: number) {
    if (packages.length > 1) setPackages(packages.filter((_, idx) => idx !== i));
  }
  function updatePackage(i: number, field: keyof PackageRow, value: string | number | null) {
    setPackages(packages.map((p, idx) => idx === i ? { ...p, [field]: value } : p));
  }

  // Reset route and cargo state when order type changes
  useEffect(() => {
    setOriginCode('');
    setDestCode('');
    setOriginTerminalId('');
    setDestTerminalId('');
    setContainers([{ container_size: '20GP', container_type: 'DRY', quantity: 1 }]);
    setPackages([{ packaging_type: 'CARTON', quantity: 1, gross_weight_kg: null, volume_cbm: null }]);
  }, [orderType]);

  // Auto-select default terminal when port changes
  useEffect(() => {
    const port = activePorts.find(p => p.un_code === originCode);
    if (port?.has_terminals) {
      const def = port.terminals.find(t => t.is_default);
      setOriginTerminalId(def?.terminal_id ?? '');
    } else {
      setOriginTerminalId('');
    }
  }, [originCode, activePorts]);

  useEffect(() => {
    const port = activePorts.find(p => p.un_code === destCode);
    if (port?.has_terminals) {
      const def = port.terminals.find(t => t.is_default);
      setDestTerminalId(def?.terminal_id ?? '');
    } else {
      setDestTerminalId('');
    }
  }, [destCode, activePorts]);

  // ── Validation ──
  function validateStep(): string | null {
    if (step === 1) {
      if (!companyId) return 'Customer company is required';
    }
    if (step === 2) {
      if (!originCode) return 'Origin port is required';
      if (!destCode) return 'Destination port is required';
      if (originCode === destCode) return 'Origin and destination cannot be the same port';
      if (!incoterm) return 'Incoterm is required';
    }
    if (step === 4) {
      if (orderType === 'SEA_FCL') {
        if (containers.length === 0) return 'At least one container is required';
        for (const c of containers) {
          if (!c.container_size || !c.container_type) return 'All container fields are required';
          if (!c.quantity || c.quantity < 1) return 'Container quantity must be at least 1';
        }
      } else {
        if (packages.length === 0) return 'At least one package is required';
        for (const p of packages) {
          if (!p.quantity || p.quantity < 1) return 'Package quantity must be at least 1';
        }
      }
    }
    return null;
  }

  function next() {
    const err = validateStep();
    if (err) { setError(err); return; }
    setError(null);
    setStep(s => s + 1);
  }
  function back() { setError(null); setStep(s => s - 1); }

  // ── Submit ──
  async function handleSubmit() {
    setSubmitting(true);
    setError(null);

    const payload: CreateShipmentOrderPayload = {
      order_type: orderType,
      transaction_type: transactionType,
      company_id: companyId,
      origin_port_un_code: originCode,
      origin_terminal_id: originTerminalId || null,
      origin_label: originPort?.name || originCode,
      destination_port_un_code: destCode,
      destination_terminal_id: destTerminalId || null,
      destination_label: destPort?.name || destCode,
      incoterm_code: incoterm || null,
      cargo_description: cargoDesc.trim() || '',
      cargo_hs_code: cargoHsCode.trim() || null,
      cargo_is_dg: cargoDg,
      containers: orderType === 'SEA_FCL' ? containers.map(c => ({
        container_size: c.container_size,
        container_type: c.container_type,
        quantity: Number(c.quantity),
      })) : [],
      packages: orderType !== 'SEA_FCL' ? packages.map(p => ({
        packaging_type: p.packaging_type,
        quantity: Number(p.quantity),
        gross_weight_kg: p.gross_weight_kg,
        volume_cbm: p.volume_cbm,
      })) : [],
      shipper: null,
      consignee: null,
      notify_party: null,
      cargo_ready_date: cargoReadyDate || null,
      etd: null,
      eta: null,
    };

    const result = await createShipmentOrderAction(payload);
    setSubmitting(false);

    if (!result.success) {
      setError(result.error ?? 'Failed to create shipment order');
      return;
    }

    onCreated(result.shipment_id);
  }

  // ── Step content ──
  function renderStep() {
    switch (step) {

      case 1:
        return (
          <div className="space-y-5">
            <div>
              <FieldLabel required>Order Type</FieldLabel>
              <div className="grid grid-cols-3 gap-2">
                {ORDER_TYPES.map(t => (
                  <button
                    key={t.value}
                    onClick={() => setOrderType(t.value as OrderType)}
                    className={`flex flex-col items-center justify-center px-2 py-2.5 rounded-lg border text-center transition-colors ${
                      orderType === t.value
                        ? 'bg-[var(--slate)] text-white border-[var(--slate)]'
                        : 'bg-white text-[var(--text)] border-[var(--border)] hover:border-[var(--sky)]'
                    }`}
                  >
                    <span className="text-xs font-semibold leading-tight">{t.label}</span>
                    <span className={`text-[10px] mt-0.5 leading-tight ${orderType === t.value ? 'text-white/60' : 'text-[var(--text-muted)]'}`}>{t.sublabel}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <FieldLabel required>Transaction Type</FieldLabel>
              <div className="flex gap-2">
                {(['IMPORT', 'EXPORT'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setTransactionType(t)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      transactionType === t
                        ? 'bg-[var(--slate)] text-white border-[var(--slate)]'
                        : 'bg-white text-[var(--text-mid)] border-[var(--border)] hover:border-[var(--sky)]'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <FieldLabel required>Customer Company</FieldLabel>
              <Combobox
                value={companyId}
                onChange={setCompanyId}
                options={companyOptions}
                placeholder="Search by company name or ID…"
              />
              {selectedCompany && (
                <p className="text-xs text-[var(--text-muted)] mt-1">{selectedCompany.company_id}</p>
              )}
            </div>
            <div>
              <FieldLabel>Cargo Ready Date</FieldLabel>
              <DateInput value={cargoReadyDate} onChange={setCargoReadyDate} />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-5">
            <div>
              <FieldLabel required>Origin Port</FieldLabel>
              <Combobox
                value={originCode}
                onChange={setOriginCode}
                options={portOptions}
                placeholder="Search by port name or UN code…"
              />
              {originPort && (
                <p className="text-xs text-[var(--text-muted)] mt-1">{originPort.un_code} · {originPort.country}</p>
              )}
              {originPort?.has_terminals && (
                <TerminalSelector
                  terminals={originPort.terminals}
                  value={originTerminalId}
                  onChange={setOriginTerminalId}
                />
              )}
            </div>
            <div>
              <FieldLabel required>Destination Port</FieldLabel>
              <Combobox
                value={destCode}
                onChange={setDestCode}
                options={portOptions}
                placeholder="Search by port name or UN code…"
              />
              {destPort && (
                <p className="text-xs text-[var(--text-muted)] mt-1">{destPort.un_code} · {destPort.country}</p>
              )}
              {destPort?.has_terminals && (
                <TerminalSelector
                  terminals={destPort.terminals}
                  value={destTerminalId}
                  onChange={setDestTerminalId}
                />
              )}
            </div>
            <div>
              <FieldLabel required>Incoterm</FieldLabel>
              <Combobox
                value={incoterm}
                onChange={setIncoterm}
                options={incotermOptions}
                placeholder="Select or type incoterm…"
              />
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-5">
            <div>
              <FieldLabel>Cargo Description</FieldLabel>
              <textarea
                value={cargoDesc}
                onChange={e => setCargoDesc(e.target.value)}
                placeholder="e.g. Electronic components, automotive parts"
                rows={3}
                className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--sky)] focus:border-transparent resize-none"
              />
            </div>
            <div>
              <FieldLabel>HS Code</FieldLabel>
              <input
                type="text"
                value={cargoHsCode}
                onChange={e => setCargoHsCode(e.target.value)}
                placeholder="e.g. 8471.30"
                className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--sky)] focus:border-transparent"
              />
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="dg-check"
                checked={cargoDg}
                onChange={e => setCargoDg(e.target.checked)}
                className="w-4 h-4 accent-[var(--sky)]"
              />
              <label htmlFor="dg-check" className="text-sm text-[var(--text)]">
                This shipment contains Dangerous Goods (DG)
              </label>
            </div>
            {cargoDg && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
                DG classification details can be added after the shipment order is created.
              </div>
            )}
          </div>
        );

      case 4:
          if (orderType === 'SEA_FCL') {
            return (
              <div className="space-y-4">
                <p className="text-xs text-[var(--text-muted)]">Container numbers and seal numbers are assigned later.</p>
                {containers.map((c, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-end border border-[var(--border)] rounded-lg p-3">
                    <div className="col-span-4">
                      <FieldLabel required>Size</FieldLabel>
                      <select value={c.container_size} onChange={e => updateContainer(i, 'container_size', e.target.value)} className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--sky)]">
                        {CONTAINER_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="col-span-4">
                      <FieldLabel required>Type</FieldLabel>
                      <select value={c.container_type} onChange={e => updateContainer(i, 'container_type', e.target.value)} className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--sky)]">
                        {CONTAINER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="col-span-3">
                      <FieldLabel required>Qty</FieldLabel>
                      <input type="number" min={1} value={c.quantity} onChange={e => updateContainer(i, 'quantity', parseInt(e.target.value) || 1)} className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--sky)]" />
                    </div>
                    <div className="col-span-1 flex justify-center pb-0.5">
                      {containers.length > 1 && (
                        <button onClick={() => removeContainer(i)} className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
                      )}
                    </div>
                  </div>
                ))}
                <button onClick={addContainer} className="w-full py-2 border border-dashed border-[var(--border)] rounded-lg text-sm text-[var(--sky)] hover:bg-[var(--sky-mist)] transition-colors">
                  + Add Container
                </button>
              </div>
            );
          }
          return (
            <div className="space-y-4">
              <p className="text-xs text-[var(--text-muted)]">Enter the total gross weight and volume for each package row.</p>
              {packages.map((p, i) => (
                <div key={i} className="border border-[var(--border)] rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="grid grid-cols-3 gap-2 flex-1 items-end">
                      <div className="col-span-1">
                        <FieldLabel required>Packaging</FieldLabel>
                        <select value={p.packaging_type} onChange={e => updatePackage(i, 'packaging_type', e.target.value)} className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--sky)] h-[38px] align-middle">
                          {PACKAGING_TYPES.map(pt => <option key={pt.value} value={pt.value}>{pt.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <FieldLabel required>Qty</FieldLabel>
                        <input type="number" min={1} value={p.quantity} onChange={e => updatePackage(i, 'quantity', parseInt(e.target.value) || 1)} className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--sky)] h-[38px]" />
                      </div>
                      <div>
                        <FieldLabel>Total Weight (kg)</FieldLabel>
                        <input type="number" min={0} step="0.01" value={p.gross_weight_kg ?? ''} placeholder="—" onChange={e => updatePackage(i, 'gross_weight_kg', e.target.value ? parseFloat(e.target.value) : null)} className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--sky)] h-[38px]" />
                      </div>
                    </div>
                    {packages.length > 1 && (
                      <button onClick={() => removePackage(i)} className="mt-5 text-red-400 hover:text-red-600 text-lg leading-none flex-shrink-0">×</button>
                    )}
                  </div>
                  <div className="w-1/3 pr-2">
                    <FieldLabel>Total Volume (CBM)</FieldLabel>
                    <input type="number" min={0} step="0.001" value={p.volume_cbm ?? ''} placeholder="—" onChange={e => updatePackage(i, 'volume_cbm', e.target.value ? parseFloat(e.target.value) : null)} className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--sky)]" />
                  </div>
                </div>
              ))}
              <button onClick={addPackage} className="w-full py-2 border border-dashed border-[var(--border)] rounded-lg text-sm text-[var(--sky)] hover:bg-[var(--sky-mist)] transition-colors">
                + Add Package
              </button>
            </div>
          );

      case 5:
        return (
          <div className="space-y-4 text-sm">
            <div className="bg-[var(--surface)] rounded-lg p-4 space-y-3">
              <ReviewRow label="Order Type" value={ORDER_TYPES.find(t => t.value === orderType)?.label ?? orderType} />
              <ReviewRow label="Transaction" value={transactionType} />
              <ReviewRow label="Customer" value={selectedCompany ? `${selectedCompany.name} (${selectedCompany.company_id})` : companyId} />
              {cargoReadyDate && (
                <ReviewRow
                  label="Cargo Ready Date"
                  value={(() => {
                    const d = new Date(cargoReadyDate);
                    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                  })()}
                />
              )}
            </div>
            <div className="bg-[var(--surface)] rounded-lg p-4 space-y-3">
              <ReviewRow label="Origin" value={`${originPort ? `${originPort.name} (${originPort.un_code})` : originCode}${originTerminalId ? ' · ' + (originPort?.terminals.find(t => t.terminal_id === originTerminalId)?.name ?? originTerminalId) : ''}`} />
              <ReviewRow label="Destination" value={`${destPort ? `${destPort.name} (${destPort.un_code})` : destCode}${destTerminalId ? ' · ' + (destPort?.terminals.find(t => t.terminal_id === destTerminalId)?.name ?? destTerminalId) : ''}`} />
              {incoterm && <ReviewRow label="Incoterm" value={incoterm} />}
            </div>
            {(cargoDesc || cargoHsCode || cargoDg) && (
              <div className="bg-[var(--surface)] rounded-lg p-4 space-y-3">
                {cargoDesc && <ReviewRow label="Cargo" value={cargoDesc} />}
                {cargoHsCode && <ReviewRow label="HS Code" value={cargoHsCode} />}
                {cargoDg && <ReviewRow label="DG" value="Yes — Dangerous Goods" />}
              </div>
            )}
            {orderType === 'SEA_FCL' ? (
              <div className="bg-[var(--surface)] rounded-lg p-4 space-y-2">
                <p className="text-xs font-semibold text-[var(--text-mid)] mb-2">Containers</p>
                {containers.map((c, i) => (
                  <ReviewRow key={i} label={`Container ${i + 1}`} value={`${c.quantity} × ${c.container_size} ${c.container_type}`} />
                ))}
              </div>
            ) : (
              <div className="bg-[var(--surface)] rounded-lg p-4 space-y-2">
                <p className="text-xs font-semibold text-[var(--text-mid)] mb-2">Packages</p>
                {packages.map((p, i) => (
                  <ReviewRow key={i} label={`Package ${i + 1}`} value={`${p.quantity} × ${PACKAGING_TYPES.find(pt => pt.value === p.packaging_type)?.label ?? p.packaging_type}${p.gross_weight_kg ? ` · ${p.gross_weight_kg} kg` : ''}${p.volume_cbm ? ` · ${p.volume_cbm} CBM` : ''}`} />
                ))}
              </div>
            )}
            <div className="bg-[var(--sky-pale)] border border-[var(--sky)] rounded-lg px-3 py-2 text-xs text-[var(--sky)]">
              The shipment will be created with status <strong>Draft</strong>.
            </div>
          </div>
        );
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header with tabs */}
        <div className="px-6 pt-6 pb-0 border-b border-[var(--border)]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[var(--text)]">New Shipment Order</h2>
            <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text)] text-xl leading-none">×</button>
          </div>
          <div className="flex gap-0">
            <button
              onClick={() => setActiveTab('manual')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'manual'
                  ? 'text-[var(--text)] border-[var(--sky)]'
                  : 'text-[var(--text-muted)] border-transparent hover:text-[var(--text)] hover:border-[var(--border)]'
              }`}
            >
              Manual Entry
            </button>
            <button
              onClick={() => setActiveTab('bl')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'bl'
                  ? 'text-[var(--text)] border-[var(--sky)]'
                  : 'text-[var(--text-muted)] border-transparent hover:text-[var(--text)] hover:border-[var(--border)]'
              }`}
            >
              Upload BL
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {activeTab === 'manual' ? (
            <>
              <p className="text-xs text-[var(--text-muted)] mb-3">Step {step} of {BASE_STEPS.length} — {step === 4 ? (orderType === 'SEA_FCL' ? 'Containers' : 'Packages') : BASE_STEPS[step - 1]?.label}</p>
              <StepIndicator currentStep={step} />
              {renderStep()}
              {error && (
                <div className="mt-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
                  {error}
                </div>
              )}
            </>
          ) : (
            <>
              <BLUploadTab
                ports={ports}
                onParsed={(result) => setBLParsedResult(result as unknown as Record<string, unknown>)}
                parsedResult={blParsedResult as never}
                onConfirmReady={setBLConfirmReady}
                formState={blFormState}
                onFormChange={setBLFormState}
              />
              {blError && (
                <div className="mt-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
                  {blError}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border)]">
          {activeTab === 'manual' ? (
            <>
              <button
                onClick={step === 1 ? onClose : back}
                className="px-4 py-2 text-sm text-[var(--text-mid)] hover:text-[var(--text)] transition-colors"
              >
                {step === 1 ? 'Cancel' : '← Back'}
              </button>
              <div className="flex items-center gap-3">
                <span className="text-xs text-[var(--text-muted)]">{step} / {BASE_STEPS.length}</span>
                {step < BASE_STEPS.length ? (
                  <button
                    onClick={next}
                    className="px-5 py-2 bg-[var(--slate)] text-white rounded-lg text-sm font-medium hover:bg-[var(--slate-mid)] transition-colors"
                  >
                    Next →
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="px-5 py-2 bg-[var(--sky)] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {submitting ? 'Creating…' : 'Create Shipment Order'}
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-[var(--text-mid)] hover:text-[var(--text)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBLConfirmCreate}
                disabled={!blParsedResult || !blConfirmReady || blSubmitting}
                className="px-5 py-2 bg-[var(--sky)] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {blSubmitting ? 'Creating…' : 'Confirm & Create'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-[var(--text-muted)] flex-shrink-0">{label}</span>
      <span className="text-[var(--text)] font-medium text-right">{value}</span>
    </div>
  );
}
