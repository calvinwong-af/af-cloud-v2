'use client';

import { useState, useCallback, useRef } from 'react';
import { Upload, CheckCircle, AlertTriangle, Link2, X, Loader2, Search } from 'lucide-react';
import { DateTimeInput } from '@/components/shared/DateInput';
import TerminalSelector from '@/components/shared/TerminalSelector';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Port {
  un_code: string;
  name: string;
  country: string;
  port_type: string;
  has_terminals: boolean;
  terminals: Array<{ terminal_id: string; name: string; is_default: boolean }>;
}

interface CompanyMatch {
  company_id: string;
  name: string;
  score: number;
}

interface Company {
  company_id: string;
  name: string;
}

interface BLContainer {
  container_number: string | null;
  container_type: string | null;
  seal_number: string | null;
  packages: string | null;
  weight_kg: number | null;
}

interface ParsedBL {
  waybill_number: string | null;
  booking_number: string | null;
  carrier_agent: string | null;
  carrier: string | null;
  vessel_name: string | null;
  voyage_number: string | null;
  port_of_loading: string | null;
  port_of_discharge: string | null;
  on_board_date: string | null;
  freight_terms: string | null;
  shipper_name: string | null;
  shipper_address: string | null;
  consignee_name: string | null;
  consignee_address: string | null;
  notify_party_name: string | null;
  cargo_description: string | null;
  total_weight_kg: number | null;
  total_packages: string | null;
  delivery_status: string | null;
  containers: BLContainer[];
  // AWB fields (present when doc_type === 'AWB')
  awb_type?: string | null;
  hawb_number?: string | null;
  mawb_number?: string | null;
  origin_iata?: string | null;
  dest_iata?: string | null;
  flight_number?: string | null;
  flight_date?: string | null;
  pieces?: number | null;
  gross_weight_kg?: number | null;
  chargeable_weight_kg?: number | null;
  notify_party?: string | null;
}

interface ParseBLResult {
  parsed: ParsedBL;
  order_type: string;
  doc_type?: string; // 'BL' | 'AWB' | 'BOOKING_CONFIRMATION' | 'UNKNOWN'
  origin_un_code: string | null;
  origin_parsed_label: string | null;
  destination_un_code: string | null;
  destination_parsed_label: string | null;
  initial_status: number;
  company_matches: CompanyMatch[];
}

interface Props {
  ports: Port[];
  companies?: Company[];
  onParsed: (result: ParseBLResult) => void;
  parsedResult: ParseBLResult | null;
  onConfirmReady: (ready: boolean) => void;
  formState: BLFormState;
  onFormChange: (state: BLFormState) => void;
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

export function getDefaultBLFormState(): BLFormState {
  return {
    originCode: '',
    originTerminalId: '',
    destCode: '',
    destTerminalId: '',
    etd: '',
    carrier: '',
    waybillNumber: '',
    vesselName: '',
    voyageNumber: '',
    consigneeName: '',
    shipperName: '',
    shipperAddress: '',
    consigneeAddress: '',
    notifyPartyName: '',
    cargoDescription: '',
    cargoWeight: '',
    customerReference: '',
    linkedCompanyId: null,
    companyMatchDismissed: false,
    originParsedLabel: null,
    destParsedLabel: null,
    orderType: 'SEA_FCL',
    transactionType: 'IMPORT',
    incotermCode: 'CNF',
    awbType: '',
    mawbNumber: '',
    hawbNumber: '',
    flightNumber: '',
    flightDate: '',
    pieces: '',
    chargeableWeightKg: '',
  };
}

const DOC_TYPE_LABELS: Record<string, string> = {
  BL: 'Bill of Lading',
  BOOKING_CONFIRMATION: 'Booking Confirmation',
  AWB: 'Air Waybill',
  UNKNOWN: 'Unknown Document',
};

const STATUS_LABELS: Record<number, string> = {
  3001: 'Booking Pending',
  3002: 'Booking Confirmed',
  4001: 'Departed',
  4002: 'Arrived',
};

// Address sanitiser
const sanitiseAddress = (raw: string | null | undefined): string => {
  if (!raw) return '';
  return raw
    .replace(/\r\n|\r|\n/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

// Pre-filled field styling
const prefilled = 'bg-[#f0f7ff] border-[#93c5fd] font-medium';
const inputBase = 'w-full px-3 py-2 text-sm border rounded-lg text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--sky)] focus:border-transparent';

// ─── Component ───────────────────────────────────────────────────────────────

export default function BLUploadTab({ ports, companies = [], onParsed, parsedResult, onConfirmReady, formState, onFormChange }: Props) {
  const [phase, setPhase] = useState<'upload' | 'parsing' | 'preview'>(parsedResult ? 'preview' : 'upload');
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [companySearch, setCompanySearch] = useState('');
  const [showCompanySearch, setShowCompanySearch] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const update = useCallback((partial: Partial<BLFormState>) => {
    onFormChange({ ...formState, ...partial });
  }, [formState, onFormChange]);

  const checkReady = useCallback((state: BLFormState) => {
    const hasOrigin = !!state.originCode;
    const hasDest = !!state.destCode;
    onConfirmReady(hasOrigin && hasDest);
  }, [onConfirmReady]);

  const handleFile = useCallback(async (file: File) => {
    setPhase('parsing');
    setError(null);

    try {
      const { parseBLAction } = await import('@/app/actions/shipments-write');
      const formData = new FormData();
      formData.append('file', file);

      const result = await parseBLAction(formData);
      if (!result) {
        setError('No response from server');
        setPhase('upload');
        return;
      }
      if (!result.success) {
        setError(result.error ?? 'Failed to parse document');
        setPhase('upload');
        return;
      }

      const data = result.data as unknown as ParseBLResult;
      onParsed(data);

      const isBC = data.doc_type === 'BOOKING_CONFIRMATION';
      const isAWB = data.doc_type === 'AWB';

      let newState: BLFormState;

      if (isAWB) {
        const originPort = ports.find(p => p.un_code === data.origin_un_code);
        const destPort = ports.find(p => p.un_code === data.destination_un_code);
        newState = {
          ...getDefaultBLFormState(),
          orderType: 'AIR',
          transactionType: 'IMPORT',
          originCode: data.origin_un_code ?? '',
          originTerminalId: originPort?.terminals?.find(t => t.is_default)?.terminal_id ?? '',
          destCode: data.destination_un_code ?? '',
          destTerminalId: destPort?.terminals?.find(t => t.is_default)?.terminal_id ?? '',
          originParsedLabel: data.origin_parsed_label ?? null,
          destParsedLabel: data.destination_parsed_label ?? null,
          awbType: data.parsed.awb_type ?? '',
          mawbNumber: data.parsed.mawb_number ?? '',
          hawbNumber: data.parsed.hawb_number ?? '',
          flightNumber: data.parsed.flight_number ?? '',
          flightDate: data.parsed.flight_date ?? '',
          pieces: data.parsed.pieces != null ? String(data.parsed.pieces) : '',
          chargeableWeightKg: data.parsed.chargeable_weight_kg != null ? String(data.parsed.chargeable_weight_kg) : '',
          shipperName: sanitiseAddress(data.parsed.shipper_name),
          shipperAddress: sanitiseAddress(data.parsed.shipper_address),
          consigneeName: sanitiseAddress(data.parsed.consignee_name),
          consigneeAddress: sanitiseAddress(data.parsed.consignee_address),
          notifyPartyName: sanitiseAddress(data.parsed.notify_party ?? data.parsed.notify_party_name),
          cargoDescription: sanitiseAddress(data.parsed.cargo_description),
          cargoWeight: data.parsed.gross_weight_kg != null ? String(data.parsed.gross_weight_kg) : '',
          linkedCompanyId: null,
          companyMatchDismissed: false,
        };
      } else {
        const originPort = ports.find(p => p.un_code === data.origin_un_code);
        const destPort = ports.find(p => p.un_code === data.destination_un_code);
        newState = {
          ...getDefaultBLFormState(),
          originCode: data.origin_un_code ?? '',
          originTerminalId: originPort?.terminals?.find(t => t.is_default)?.terminal_id ?? '',
          destCode: data.destination_un_code ?? '',
          destTerminalId: destPort?.terminals?.find(t => t.is_default)?.terminal_id ?? '',
          etd: data.parsed.on_board_date ?? '',
          carrier: data.parsed.carrier_agent ?? data.parsed.carrier ?? '',
          waybillNumber: data.parsed.waybill_number ?? '',
          vesselName: data.parsed.vessel_name ?? '',
          voyageNumber: data.parsed.voyage_number ?? '',
          consigneeName: sanitiseAddress(data.parsed.consignee_name),
          shipperName: sanitiseAddress(data.parsed.shipper_name),
          shipperAddress: sanitiseAddress(data.parsed.shipper_address),
          consigneeAddress: sanitiseAddress(data.parsed.consignee_address),
          notifyPartyName: sanitiseAddress(data.parsed.notify_party_name),
          cargoDescription: sanitiseAddress(data.parsed.cargo_description),
          cargoWeight: data.parsed.total_weight_kg != null ? String(data.parsed.total_weight_kg) : '',
          customerReference: '',
          linkedCompanyId: null,
          companyMatchDismissed: false,
          originParsedLabel: data.origin_parsed_label ?? null,
          destParsedLabel: data.destination_parsed_label ?? null,
          orderType: data.order_type ?? 'SEA_FCL',
          transactionType: isBC ? 'EXPORT' : 'IMPORT',
          incotermCode: 'CNF',
        };
      }

      onFormChange(newState);
      checkReady(newState);
      setPhase('preview');
    } catch (err) {
      console.error('[BLUploadTab] parse error:', err);
      setError('Failed to parse document');
      setPhase('upload');
    }
  }, [onParsed, onFormChange, checkReady, ports]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const seaPorts = ports.filter(p => !(p.port_type?.toLowerCase().includes('air') ?? false));
  const airPorts = ports.filter(p => p.port_type?.toLowerCase().includes('air') ?? false);
  const seaPortOptions = seaPorts.map(p => ({ value: p.un_code, label: `${p.name || p.un_code} (${p.un_code})` }));
  const airPortOptions = airPorts.map(p => ({ value: p.un_code, label: `${p.name || p.un_code} (${p.un_code})` }));

  // Company search candidates: prioritise matches from parse, then fall back to companies prop
  const matches = parsedResult?.company_matches ?? [];
  const companySearchResults = companySearch.trim().length > 0
    ? (companies.length > 0
        ? companies.filter(c =>
            c.name.toLowerCase().includes(companySearch.toLowerCase()) ||
            c.company_id.toLowerCase().includes(companySearch.toLowerCase())
          ).slice(0, 5)
        : matches.filter(m =>
            m.name.toLowerCase().includes(companySearch.toLowerCase()) ||
            m.company_id.toLowerCase().includes(companySearch.toLowerCase())
          )
      )
    : matches.slice(0, 5);

  // ── State 1: Upload Zone ──
  if (phase === 'upload') {
    return (
      <div className="space-y-4">
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-3 p-12 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
            dragOver
              ? 'border-[var(--sky)] bg-[var(--sky-mist)]'
              : 'border-[var(--border)] hover:border-[var(--sky)] hover:bg-[var(--sky-mist)]'
          }`}
        >
          <Upload className="w-10 h-10 text-[var(--text-muted)]" />
          <p className="text-sm text-[var(--text-mid)] text-center">
            Drop your shipping document here — PDF or image — or <span className="text-[var(--sky)] font-medium">browse to upload</span>
          </p>
          <p className="text-xs text-[var(--text-muted)]">PDF, PNG, JPG, WEBP</p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp"
          className="hidden"
          onChange={onFileChange}
        />
        {error && (
          <div className="flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <p>{error}</p>
              <button
                onClick={() => { setError(null); fileRef.current?.click(); }}
                className="mt-1 text-red-700 font-medium hover:underline"
              >
                Try again
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── State 2: Parsing ──
  if (phase === 'parsing') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <Loader2 className="w-8 h-8 text-[var(--sky)] animate-spin" />
        <p className="text-sm text-[var(--text-mid)]">Analysing document...</p>
        <p className="text-xs text-[var(--text-muted)]">This may take a few seconds</p>
      </div>
    );
  }

  // ── State 3: Preview ──
  const parsed = parsedResult?.parsed;
  const isPrepaid = (parsed?.freight_terms ?? '').toUpperCase().includes('PREPAID');
  const initialStatus = parsedResult?.initial_status ?? 3001;
  const isBookingConfirmation = parsedResult?.doc_type === 'BOOKING_CONFIRMATION';
  const isAWB = parsedResult?.doc_type === 'AWB';
  const effectiveStatus = (initialStatus >= 4001 && isBookingConfirmation)
    ? 3002
    : initialStatus;
  const orderType = parsedResult?.order_type ?? 'SEA_FCL';
  const containers = parsed?.containers ?? [];

  const docTypeBadge = parsedResult?.doc_type && parsedResult.doc_type !== 'UNKNOWN' ? (
    <span className={`ml-auto inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide ${
      parsedResult.doc_type === 'BOOKING_CONFIRMATION'
        ? 'bg-teal-100 text-teal-700'
        : parsedResult.doc_type === 'AWB'
        ? 'bg-sky-100 text-sky-700'
        : 'bg-blue-100 text-blue-700'
    }`}>
      {DOC_TYPE_LABELS[parsedResult.doc_type] ?? parsedResult.doc_type}
    </span>
  ) : null;

  return (
    <div className="space-y-4">
      {/* Success banner */}
      <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700">
        <CheckCircle className="w-4 h-4 flex-shrink-0" />
        <span>Document parsed successfully — review extracted details below</span>
        {docTypeBadge}
      </div>

      {/* Prepaid hint (sea only) */}
      {!isAWB && isPrepaid && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>Freight marked as Prepaid — incoterm defaulted to CNF (IMPORT). Adjustable after creation.</span>
        </div>
      )}

      {/* Shipment Type */}
      <div>
        <SectionLabel>Shipment Type</SectionLabel>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <FieldLabel>Order Type</FieldLabel>
            <select
              value={formState.orderType}
              onChange={e => update({ orderType: e.target.value })}
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
              onChange={e => update({ transactionType: e.target.value })}
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
              onChange={e => update({ incotermCode: e.target.value })}
              className={inputBase}
            >
              {['EXW','FCA','FAS','FOB','CFR','CNF','CIF','CPT','CIP','DAP','DPU','DDP'].map(i => (
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
                <select
                  value={formState.originCode}
                  onChange={e => {
                    const s = { ...formState, originCode: e.target.value };
                    onFormChange(s);
                    checkReady(s);
                  }}
                  className={`${inputBase} ${formState.originCode ? prefilled : ''}`}
                >
                  <option value="">Select airport...</option>
                  {airPortOptions.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
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
                <select
                  value={formState.destCode}
                  onChange={e => {
                    const s = { ...formState, destCode: e.target.value };
                    onFormChange(s);
                    checkReady(s);
                  }}
                  className={`${inputBase} ${formState.destCode ? prefilled : ''}`}
                >
                  <option value="">Select airport...</option>
                  {airPortOptions.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
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
                  onChange={e => update({ flightNumber: e.target.value })}
                  className={`${inputBase} font-mono ${formState.flightNumber ? prefilled : ''}`}
                  placeholder="e.g. MH370"
                />
              </div>
              <div>
                <FieldLabel>Flight Date</FieldLabel>
                <DateTimeInput
                  value={formState.flightDate}
                  onChange={v => update({ flightDate: v })}
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
                  onChange={e => update({ mawbNumber: e.target.value })}
                  className={`${inputBase} font-mono ${formState.mawbNumber ? prefilled : ''}`}
                />
              </div>
              {(formState.awbType === 'HOUSE' || formState.hawbNumber) && (
                <div>
                  <FieldLabel>HAWB Number</FieldLabel>
                  <input
                    type="text"
                    value={formState.hawbNumber}
                    onChange={e => update({ hawbNumber: e.target.value })}
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
              <input type="text" value={formState.shipperName} onChange={e => update({ shipperName: e.target.value })} className={`${inputBase} ${formState.shipperName ? prefilled : ''}`} />
            </div>
            <div className="mt-2">
              <FieldLabel>Address</FieldLabel>
              <textarea value={formState.shipperAddress} onChange={e => update({ shipperAddress: e.target.value })} rows={2} className={`${inputBase} resize-none ${formState.shipperAddress ? prefilled : ''}`} />
            </div>
          </div>

          {/* Consignee */}
          <div>
            <SectionLabel>Consignee</SectionLabel>
            <div>
              <FieldLabel>Name</FieldLabel>
              <input type="text" value={formState.consigneeName} onChange={e => update({ consigneeName: e.target.value })} className={`${inputBase} ${formState.consigneeName ? prefilled : ''}`} />
            </div>
            <div className="mt-2">
              <FieldLabel>Address</FieldLabel>
              <textarea value={formState.consigneeAddress} onChange={e => update({ consigneeAddress: e.target.value })} rows={2} className={`${inputBase} resize-none ${formState.consigneeAddress ? prefilled : ''}`} />
            </div>
            {/* Company match / search */}
            <CompanyMatchSection
              matches={matches}
              formState={formState}
              showCompanySearch={showCompanySearch}
              companySearch={companySearch}
              companySearchResults={companySearchResults}
              onShowSearch={() => { setShowCompanySearch(true); setCompanySearch(''); }}
              onHideSearch={() => setShowCompanySearch(false)}
              onSearchChange={setCompanySearch}
              onLink={(id) => { const s = { ...formState, linkedCompanyId: id, companyMatchDismissed: false }; onFormChange(s); checkReady(s); setShowCompanySearch(false); }}
              onUnlink={() => update({ linkedCompanyId: null })}
              update={update}
            />
          </div>

          {/* Cargo */}
          <div>
            <SectionLabel>Cargo</SectionLabel>
            <div>
              <FieldLabel>Description</FieldLabel>
              <textarea value={formState.cargoDescription} onChange={e => update({ cargoDescription: e.target.value })} rows={2} className={`${inputBase} resize-none ${formState.cargoDescription ? prefilled : ''}`} />
            </div>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <FieldLabel>Pieces</FieldLabel>
                <input type="text" value={formState.pieces} onChange={e => update({ pieces: e.target.value })} className={`${inputBase} w-full ${formState.pieces ? prefilled : ''}`} />
              </div>
              <div>
                <FieldLabel>Chargeable Weight (kg)</FieldLabel>
                <input type="text" value={formState.chargeableWeightKg} onChange={e => update({ chargeableWeightKg: e.target.value })} className={`${inputBase} w-full ${formState.chargeableWeightKg ? prefilled : ''}`} />
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
                <select
                  value={formState.originCode}
                  onChange={e => {
                    const s = { ...formState, originCode: e.target.value };
                    onFormChange(s);
                    checkReady(s);
                  }}
                  className={`${inputBase} ${formState.originCode ? prefilled : ''}`}
                >
                  <option value="">Select port...</option>
                  {seaPortOptions.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
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
                      onChange={v => update({ originTerminalId: v })}
                    />
                  ) : null;
                })()}
              </div>
              <div>
                <FieldLabel>Destination Port</FieldLabel>
                <select
                  value={formState.destCode}
                  onChange={e => {
                    const s = { ...formState, destCode: e.target.value };
                    onFormChange(s);
                    checkReady(s);
                  }}
                  className={`${inputBase} ${formState.destCode ? prefilled : ''}`}
                >
                  <option value="">Select port...</option>
                  {seaPortOptions.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
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
                      onChange={v => update({ destTerminalId: v })}
                    />
                  ) : null;
                })()}
              </div>
            </div>
            <div className="mt-3">
              <FieldLabel>ETD (On Board Date)</FieldLabel>
              <DateTimeInput
                value={formState.etd}
                onChange={v => update({ etd: v })}
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
                <input type="text" value={formState.carrier} onChange={e => update({ carrier: e.target.value })} className={`${inputBase} ${formState.carrier ? prefilled : ''}`} />
              </div>
              <div>
                <FieldLabel>Booking Ref / BL No.</FieldLabel>
                <input type="text" value={formState.waybillNumber} onChange={e => update({ waybillNumber: e.target.value })} className={`${inputBase} font-mono ${formState.waybillNumber ? prefilled : ''}`} />
              </div>
              <div>
                <FieldLabel>Vessel</FieldLabel>
                <input type="text" value={formState.vesselName} onChange={e => update({ vesselName: e.target.value })} className={`${inputBase} ${formState.vesselName ? prefilled : ''}`} />
              </div>
              <div>
                <FieldLabel>Voyage</FieldLabel>
                <input type="text" value={formState.voyageNumber} onChange={e => update({ voyageNumber: e.target.value })} className={`${inputBase} font-mono ${formState.voyageNumber ? prefilled : ''}`} />
              </div>
            </div>
          </div>

          {/* Shipper */}
          <div>
            <SectionLabel>Shipper</SectionLabel>
            <div>
              <FieldLabel>Name</FieldLabel>
              <input type="text" value={formState.shipperName} onChange={e => update({ shipperName: e.target.value })} className={`${inputBase} ${formState.shipperName ? prefilled : ''}`} />
            </div>
            <div className="mt-2">
              <FieldLabel>Address</FieldLabel>
              <textarea value={formState.shipperAddress} onChange={e => update({ shipperAddress: e.target.value })} rows={2} className={`${inputBase} resize-none ${formState.shipperAddress ? prefilled : ''}`} />
            </div>
          </div>

          {/* Customer (Consignee) */}
          <div>
            <SectionLabel>Customer (Consignee)</SectionLabel>
            <div>
              <FieldLabel>Consignee Name</FieldLabel>
              <input type="text" value={formState.consigneeName} onChange={e => update({ consigneeName: e.target.value })} className={`${inputBase} ${formState.consigneeName ? prefilled : ''}`} />
            </div>
            <div className="mt-2">
              <FieldLabel>Address</FieldLabel>
              <textarea value={formState.consigneeAddress} onChange={e => update({ consigneeAddress: e.target.value })} rows={2} className={`${inputBase} resize-none ${formState.consigneeAddress ? prefilled : ''}`} />
            </div>

            {/* Company match / search */}
            <CompanyMatchSection
              matches={matches}
              formState={formState}
              showCompanySearch={showCompanySearch}
              companySearch={companySearch}
              companySearchResults={companySearchResults}
              onShowSearch={() => { setShowCompanySearch(true); setCompanySearch(''); }}
              onHideSearch={() => setShowCompanySearch(false)}
              onSearchChange={setCompanySearch}
              onLink={(id) => { const s = { ...formState, linkedCompanyId: id, companyMatchDismissed: false }; onFormChange(s); checkReady(s); setShowCompanySearch(false); }}
              onUnlink={() => update({ linkedCompanyId: null })}
              update={update}
            />
          </div>

          {/* Notify Party (conditional) */}
          {(formState.notifyPartyName || parsedResult?.parsed.notify_party_name) && (
            <div>
              <SectionLabel>Notify Party</SectionLabel>
              <div>
                <FieldLabel>Name</FieldLabel>
                <input type="text" value={formState.notifyPartyName} onChange={e => update({ notifyPartyName: e.target.value })} className={`${inputBase} ${formState.notifyPartyName ? prefilled : ''}`} />
              </div>
            </div>
          )}

          {/* Cargo */}
          <div>
            <SectionLabel>Cargo</SectionLabel>
            <div>
              <FieldLabel>Description</FieldLabel>
              <textarea value={formState.cargoDescription} onChange={e => update({ cargoDescription: e.target.value })} rows={2} className={`${inputBase} resize-none ${formState.cargoDescription ? prefilled : ''}`} />
            </div>
            <div className="mt-2">
              <FieldLabel>Total Weight (kg)</FieldLabel>
              <input type="text" value={formState.cargoWeight} onChange={e => update({ cargoWeight: e.target.value })} className={`${inputBase} w-40 ${formState.cargoWeight ? prefilled : ''}`} />
            </div>
          </div>

          {/* Containers (SEA_FCL) */}
          {orderType === 'SEA_FCL' && containers.length > 0 && (
            <div>
              <SectionLabel>Containers</SectionLabel>
              <div className="border border-[var(--border)] rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-[var(--surface)]">
                    <tr>
                      <th className="text-left px-3 py-2 text-[var(--text-muted)] font-medium">Container No.</th>
                      <th className="text-left px-3 py-2 text-[var(--text-muted)] font-medium">Type</th>
                      <th className="text-left px-3 py-2 text-[var(--text-muted)] font-medium">Seal</th>
                      <th className="text-left px-3 py-2 text-[var(--text-muted)] font-medium">Packages</th>
                      <th className="text-right px-3 py-2 text-[var(--text-muted)] font-medium">Weight (kg)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {containers.map((c, i) => (
                      <tr key={i} className="border-t border-[var(--border)]">
                        <td className="px-3 py-2 font-mono text-[var(--text)]">{c.container_number ?? '—'}</td>
                        <td className="px-3 py-2 text-[var(--text)]">{c.container_type ?? '—'}</td>
                        <td className="px-3 py-2 text-[var(--text)]">{c.seal_number ?? '—'}</td>
                        <td className="px-3 py-2 text-[var(--text)]">{c.packages ?? '—'}</td>
                        <td className="px-3 py-2 text-right text-[var(--text)]">{c.weight_kg != null ? c.weight_kg.toLocaleString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Initial Status */}
          <div>
            <SectionLabel>Initial Status</SectionLabel>
            <div className="flex items-center gap-2">
              <Badge>{effectiveStatus} {STATUS_LABELS[effectiveStatus] ?? 'Unknown'}</Badge>
              {formState.etd && (
                <span className="text-xs text-[var(--text-muted)]">
                  — vessel {effectiveStatus >= 4001 ? 'departed' : 'departs'} {new Date(formState.etd).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </span>
              )}
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
          onChange={e => update({ customerReference: e.target.value })}
          placeholder="e.g. PO number, booking ref"
          className={inputBase}
        />
      </div>
    </div>
  );
}

// ─── Company match / search section ──────────────────────────────────────────

interface CompanyMatchSectionProps {
  matches: CompanyMatch[];
  formState: BLFormState;
  showCompanySearch: boolean;
  companySearch: string;
  companySearchResults: Array<{ company_id: string; name: string }>;
  onShowSearch: () => void;
  onHideSearch: () => void;
  onSearchChange: (v: string) => void;
  onLink: (id: string) => void;
  onUnlink: () => void;
  update: (partial: Partial<BLFormState>) => void;
}

function CompanyMatchSection({
  matches, formState, showCompanySearch, companySearch, companySearchResults,
  onShowSearch, onHideSearch, onSearchChange, onLink, onUnlink, update,
}: CompanyMatchSectionProps) {
  const inputBase = 'w-full px-3 py-2 text-sm border rounded-lg text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--sky)] focus:border-transparent';

  if (formState.linkedCompanyId) {
    const linkedName = matches.find(m => m.company_id === formState.linkedCompanyId)?.name;
    return (
      <div className="mt-2 flex items-center justify-between border border-emerald-300 bg-emerald-50 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <div>
            <p className="text-sm font-medium text-emerald-800">{linkedName ?? formState.linkedCompanyId}</p>
            <p className="text-xs text-emerald-600">{formState.linkedCompanyId}</p>
          </div>
        </div>
        <button onClick={onUnlink} className="text-emerald-400 hover:text-emerald-600"><X className="w-4 h-4" /></button>
      </div>
    );
  }

  if (showCompanySearch) {
    return (
      <div className="mt-2 border border-[var(--border)] rounded-lg p-3 bg-[var(--surface)] space-y-2">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-medium text-[var(--text-mid)]">Customer / Shipment Owner</p>
          <button onClick={onHideSearch} className="text-[var(--text-muted)] hover:text-[var(--text)]"><X className="w-3.5 h-3.5" /></button>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
          <input
            autoFocus
            type="text"
            value={companySearch}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Search by name or company ID..."
            className={`${inputBase} pl-8 text-xs`}
          />
        </div>
        {companySearchResults.length > 0 && (
          <div className="border border-[var(--border)] rounded-lg overflow-hidden">
            {companySearchResults.map(c => (
              <button
                key={c.company_id}
                onClick={() => onLink(c.company_id)}
                className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-[var(--sky-mist)] border-b border-[var(--border)] last:border-0"
              >
                <div>
                  <p className="text-xs font-medium text-[var(--text)]">{c.name}</p>
                  <p className="text-[10px] text-[var(--text-muted)]">{c.company_id}</p>
                </div>
                <Link2 className="w-3 h-3 text-[var(--sky)] flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
        {companySearch && companySearchResults.length === 0 && (
          <p className="text-xs text-[var(--text-muted)] text-center py-1">No matches found</p>
        )}
        <button
          onClick={() => { update({ linkedCompanyId: null, companyMatchDismissed: true }); onHideSearch(); }}
          className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] w-full text-center py-1"
        >
          Skip — assign company later
        </button>
      </div>
    );
  }

  if (matches.length > 0 && !formState.companyMatchDismissed) {
    return (
      <div className="mt-2 border border-[var(--border)] rounded-lg p-3 bg-[var(--surface)]">
        <p className="text-xs text-[var(--text-muted)] mb-2">Possible match found:</p>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--text)]">{matches[0].name}</p>
            <p className="text-xs text-[var(--text-muted)]">{matches[0].company_id}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onLink(matches[0].company_id)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[var(--sky)] border border-[var(--sky)] rounded-lg hover:bg-[var(--sky-mist)] transition-colors"
            >
              <Link2 className="w-3 h-3" />
              Link to {matches[0].company_id}
            </button>
            <button
              onClick={onShowSearch}
              className="px-2 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
            >
              Not this company
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// ─── Small helpers ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold text-[var(--text-mid)] mb-2">{children}</p>;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-[var(--text-mid)] mb-1">{children}</label>;
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--sky-pale)] text-[var(--sky)]">
      {children}
    </span>
  );
}
