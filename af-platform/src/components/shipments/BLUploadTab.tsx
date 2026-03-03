'use client';

import { useState, useCallback, useRef } from 'react';
import { Upload, AlertTriangle, Loader2 } from 'lucide-react';
import { BLParseResult } from './_bl-upload/BLParseResult';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sanitiseErrorMessage(raw: string | null | undefined): string {
  if (!raw) return 'Document parsing failed — please try again or enter details manually';
  if (raw.includes('overloaded_error') || raw.includes('529'))
    return 'Service temporarily busy — please try again in a moment';
  if (raw.includes('ANTHROPIC_API_KEY'))
    return 'Document parsing is not available — contact support';
  return 'Document parsing failed — please try again or enter details manually';
}

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
  onFileSelected?: (file: File | null) => void;
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

// Address sanitiser
const sanitiseAddress = (raw: string | null | undefined): string => {
  if (!raw) return '';
  return raw
    .replace(/\r\n|\r|\n/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function BLUploadTab({ ports, companies = [], onParsed, parsedResult, onConfirmReady, formState, onFormChange, onFileSelected }: Props) {
  const [phase, setPhase] = useState<'upload' | 'parsing' | 'preview'>(parsedResult ? 'preview' : 'upload');
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const checkReady = useCallback((state: BLFormState) => {
    const hasOrigin = !!state.originCode;
    const hasDest = !!state.destCode;
    onConfirmReady(hasOrigin && hasDest);
  }, [onConfirmReady]);

  const handleFile = useCallback(async (file: File) => {
    setPhase('parsing');
    setError(null);
    onFileSelected?.(file);

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
        setError(sanitiseErrorMessage(result.error));
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
  }, [onParsed, onFormChange, checkReady, ports, onFileSelected]);

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
  return (
    <BLParseResult
      formState={formState}
      setFormState={onFormChange}
      companyMatches={parsedResult?.company_matches ?? []}
      ports={ports}
      isSubmitting={false}
      submitError={null}
      parsedResult={parsedResult}
      companies={companies}
      onConfirmReady={onConfirmReady}
    />
  );
}
