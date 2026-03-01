'use client';

import { useState, useCallback, useRef } from 'react';
import { Upload, CheckCircle, AlertTriangle, Link2, X, Loader2 } from 'lucide-react';
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
}

interface ParseBLResult {
  parsed: ParsedBL;
  order_type: string;
  origin_un_code: string | null;
  origin_parsed_label: string | null;
  destination_un_code: string | null;
  destination_parsed_label: string | null;
  initial_status: number;
  company_matches: CompanyMatch[];
}

interface Props {
  ports: Port[];
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
  };
}

const STATUS_LABELS: Record<number, string> = {
  3001: 'Booking Pending',
  3002: 'Booking Confirmed',
  4001: 'Departed',
  4002: 'Arrived',
};

// Pre-filled field styling
const prefilled = 'bg-[#f0f7ff] border-[#93c5fd] font-medium';
const inputBase = 'w-full px-3 py-2 text-sm border rounded-lg text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--sky)] focus:border-transparent';

// ─── Component ───────────────────────────────────────────────────────────────

export default function BLUploadTab({ ports, onParsed, parsedResult, onConfirmReady, formState, onFormChange }: Props) {
  const [phase, setPhase] = useState<'upload' | 'parsing' | 'preview'>(parsedResult ? 'preview' : 'upload');
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const update = useCallback((partial: Partial<BLFormState>) => {
    onFormChange({ ...formState, ...partial });
  }, [formState, onFormChange]);

  // Notify parent about confirm readiness
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
        setError(result.error ?? 'Failed to parse BL');
        setPhase('upload');
        return;
      }

      const data = result.data as unknown as ParseBLResult;
      onParsed(data);

      // Pre-fill form state
      const originPort = ports.find(p => p.un_code === data.origin_un_code);
      const destPort = ports.find(p => p.un_code === data.destination_un_code);
      const newState: BLFormState = {
        originCode: data.origin_un_code ?? '',
        originTerminalId: originPort?.terminals?.find(t => t.is_default)?.terminal_id ?? '',
        destCode: data.destination_un_code ?? '',
        destTerminalId: destPort?.terminals?.find(t => t.is_default)?.terminal_id ?? '',
        etd: data.parsed.on_board_date ?? '',
        carrier: data.parsed.carrier_agent ?? data.parsed.carrier ?? '',
        waybillNumber: data.parsed.waybill_number ?? '',
        vesselName: data.parsed.vessel_name ?? '',
        voyageNumber: data.parsed.voyage_number ?? '',
        consigneeName: data.parsed.consignee_name ?? '',
        shipperName: data.parsed.shipper_name ?? '',
        shipperAddress: data.parsed.shipper_address ?? '',
        consigneeAddress: data.parsed.consignee_address ?? '',
        notifyPartyName: data.parsed.notify_party_name ?? '',
        cargoDescription: data.parsed.cargo_description ?? '',
        cargoWeight: data.parsed.total_weight_kg != null ? String(data.parsed.total_weight_kg) : '',
        customerReference: '',
        linkedCompanyId: null,
        companyMatchDismissed: false,
        originParsedLabel: data.origin_parsed_label ?? null,
        destParsedLabel: data.destination_parsed_label ?? null,
      };
      onFormChange(newState);
      checkReady(newState);
      setPhase('preview');
    } catch (err) {
      console.error('[BLUploadTab] parse error:', err);
      setError('Failed to parse BL');
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

  // Port options for combobox-like selects
  const seaPorts = ports.filter(p => !(p.port_type?.toLowerCase().includes('air') ?? false));
  const portOptions = seaPorts.map(p => ({ value: p.un_code, label: `${p.name || p.un_code} (${p.un_code})` }));

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
            Drop your Bill of Lading here — PDF or image — or <span className="text-[var(--sky)] font-medium">browse to upload</span>
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
        <p className="text-sm text-[var(--text-mid)]">Parsing Bill of Lading...</p>
        <p className="text-xs text-[var(--text-muted)]">This may take a few seconds</p>
      </div>
    );
  }

  // ── State 3: Preview ──
  const parsed = parsedResult?.parsed;
  const matches = parsedResult?.company_matches ?? [];
  const isPrepaid = (parsed?.freight_terms ?? '').toUpperCase().includes('PREPAID');
  const initialStatus = parsedResult?.initial_status ?? 3001;
  const orderType = parsedResult?.order_type ?? 'SEA_FCL';
  const containers = parsed?.containers ?? [];

  return (
    <div className="space-y-4">
      {/* Success banner */}
      <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700">
        <CheckCircle className="w-4 h-4 flex-shrink-0" />
        <span>BL parsed successfully — review extracted details below</span>
      </div>

      {/* Prepaid hint */}
      {isPrepaid && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>Freight marked as Prepaid — incoterm defaulted to CNF (IMPORT). Adjustable after creation.</span>
        </div>
      )}

      {/* Shipment Type badges */}
      <div>
        <SectionLabel>Shipment Type</SectionLabel>
        <div className="flex gap-2">
          <Badge>{orderType === 'SEA_FCL' ? 'Sea FCL' : orderType === 'SEA_LCL' ? 'Sea LCL' : orderType}</Badge>
          <Badge>IMPORT</Badge>
          <Badge>CNF</Badge>
          <span className="text-[10px] text-[var(--text-muted)] self-center ml-1">adjustable after creation</span>
        </div>
      </div>

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
              {portOptions.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
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
              {portOptions.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
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
            <input
              type="text"
              value={formState.carrier}
              onChange={e => update({ carrier: e.target.value })}
              className={`${inputBase} ${formState.carrier ? prefilled : ''}`}
            />
          </div>
          <div>
            <FieldLabel>Waybill / BL No.</FieldLabel>
            <input
              type="text"
              value={formState.waybillNumber}
              onChange={e => update({ waybillNumber: e.target.value })}
              className={`${inputBase} font-mono ${formState.waybillNumber ? prefilled : ''}`}
            />
          </div>
          <div>
            <FieldLabel>Vessel</FieldLabel>
            <input
              type="text"
              value={formState.vesselName}
              onChange={e => update({ vesselName: e.target.value })}
              className={`${inputBase} ${formState.vesselName ? prefilled : ''}`}
            />
          </div>
          <div>
            <FieldLabel>Voyage</FieldLabel>
            <input
              type="text"
              value={formState.voyageNumber}
              onChange={e => update({ voyageNumber: e.target.value })}
              className={`${inputBase} font-mono ${formState.voyageNumber ? prefilled : ''}`}
            />
          </div>
        </div>
      </div>

      {/* Shipper */}
      <div>
        <SectionLabel>Shipper</SectionLabel>
        <div>
          <FieldLabel>Name</FieldLabel>
          <input
            type="text"
            value={formState.shipperName}
            onChange={e => update({ shipperName: e.target.value })}
            className={`${inputBase} ${formState.shipperName ? prefilled : ''}`}
          />
        </div>
        <div className="mt-2">
          <FieldLabel>Address</FieldLabel>
          <textarea
            value={formState.shipperAddress}
            onChange={e => update({ shipperAddress: e.target.value })}
            rows={2}
            className={`${inputBase} resize-none ${formState.shipperAddress ? prefilled : ''}`}
          />
        </div>
      </div>

      {/* Customer (Consignee) */}
      <div>
        <SectionLabel>Customer (Consignee)</SectionLabel>
        <div>
          <FieldLabel>Consignee Name</FieldLabel>
          <input
            type="text"
            value={formState.consigneeName}
            onChange={e => update({ consigneeName: e.target.value })}
            className={`${inputBase} ${formState.consigneeName ? prefilled : ''}`}
          />
        </div>
        <div className="mt-2">
          <FieldLabel>Address</FieldLabel>
          <textarea
            value={formState.consigneeAddress}
            onChange={e => update({ consigneeAddress: e.target.value })}
            rows={2}
            className={`${inputBase} resize-none ${formState.consigneeAddress ? prefilled : ''}`}
          />
        </div>

        {/* Company match card */}
        {matches.length > 0 && !formState.companyMatchDismissed && !formState.linkedCompanyId && (
          <div className="mt-2 border border-[var(--border)] rounded-lg p-3 bg-[var(--surface)]">
            <p className="text-xs text-[var(--text-muted)] mb-2">Possible match found:</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--text)]">{matches[0].name}</p>
                <p className="text-xs text-[var(--text-muted)]">{matches[0].company_id}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const s = { ...formState, linkedCompanyId: matches[0].company_id };
                    onFormChange(s);
                    checkReady(s);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[var(--sky)] border border-[var(--sky)] rounded-lg hover:bg-[var(--sky-mist)] transition-colors"
                >
                  <Link2 className="w-3 h-3" />
                  Link to {matches[0].company_id}
                </button>
                <button
                  onClick={() => update({ companyMatchDismissed: true })}
                  className="px-2 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                >
                  Not this company
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Linked company card */}
        {formState.linkedCompanyId && (
          <div className="mt-2 flex items-center justify-between border border-emerald-300 bg-emerald-50 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <div>
                <p className="text-sm font-medium text-emerald-800">
                  {matches.find(m => m.company_id === formState.linkedCompanyId)?.name ?? formState.linkedCompanyId}
                </p>
                <p className="text-xs text-emerald-600">{formState.linkedCompanyId}</p>
              </div>
            </div>
            <button
              onClick={() => update({ linkedCompanyId: null })}
              className="text-emerald-400 hover:text-emerald-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Notify Party (conditional) */}
      {(formState.notifyPartyName || parsedResult?.parsed.notify_party_name) && (
        <div>
          <SectionLabel>Notify Party</SectionLabel>
          <div>
            <FieldLabel>Name</FieldLabel>
            <input
              type="text"
              value={formState.notifyPartyName}
              onChange={e => update({ notifyPartyName: e.target.value })}
              className={`${inputBase} ${formState.notifyPartyName ? prefilled : ''}`}
            />
          </div>
        </div>
      )}

      {/* Cargo */}
      <div>
        <SectionLabel>Cargo</SectionLabel>
        <div>
          <FieldLabel>Description</FieldLabel>
          <textarea
            value={formState.cargoDescription}
            onChange={e => update({ cargoDescription: e.target.value })}
            rows={2}
            className={`${inputBase} resize-none ${formState.cargoDescription ? prefilled : ''}`}
          />
        </div>
        <div className="mt-2">
          <FieldLabel>Total Weight (kg)</FieldLabel>
          <input
            type="text"
            value={formState.cargoWeight}
            onChange={e => update({ cargoWeight: e.target.value })}
            className={`${inputBase} w-40 ${formState.cargoWeight ? prefilled : ''}`}
          />
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
          <Badge>{initialStatus} {STATUS_LABELS[initialStatus] ?? 'Unknown'}</Badge>
          {formState.etd && (
            <span className="text-xs text-[var(--text-muted)]">
              — vessel {initialStatus >= 4001 ? 'departed' : 'departs'} {new Date(formState.etd).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
            </span>
          )}
        </div>
      </div>

      {/* Customer Reference */}
      <div>
        <FieldLabel>Customer Reference (optional)</FieldLabel>
        <input
          type="text"
          value={formState.customerReference}
          onChange={e => update({ customerReference: e.target.value })}
          placeholder="e.g. PO number, booking ref"
          className={`${inputBase}`}
        />
      </div>
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

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--sky-pale)] text-[var(--sky)]">
      {children}
    </span>
  );
}
