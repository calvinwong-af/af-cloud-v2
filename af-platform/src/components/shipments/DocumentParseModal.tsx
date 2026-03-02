'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { X, Upload, FileText, Loader2, AlertCircle, Check, Plane, Ship, ClipboardList, Search, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  parseDocumentAction,
  type DocType,
  type ParseConfidence,
  type ParsedBCData,
  type ParsedAWBData,
} from '@/app/actions/shipments-files';
import type { ParsedBL } from '@/components/shipments/BLUpdateModal';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sanitiseErrorMessage(raw: string | null | undefined): string {
  if (!raw) return 'Document parsing failed — please try again or enter details manually';
  if (raw.includes('overloaded_error') || raw.includes('529'))
    return 'Service temporarily busy — please try again in a moment';
  if (raw.includes('ANTHROPIC_API_KEY'))
    return 'Document parsing is not available — contact support';
  return 'Document parsing failed — please try again or enter details manually';
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Port {
  un_code: string;
  name: string;
  country: string;
  port_type: string;
  has_terminals: boolean;
  terminals: Array<{ terminal_id: string; name: string; is_default: boolean }>;
}

interface Company {
  company_id: string;
  name: string;
}

interface DocumentParseModalProps {
  shipmentId?: string;
  companyId?: string | null; // If set, shipment already has an owner — hide ownership section (State A)
  ports: Port[];
  onClose: () => void;
  onResult: (docType: DocType, data: ParsedBCData | ParsedAWBData | ParsedBL) => void;
  allowedTypes?: DocType[];
}

type Phase = 'idle' | 'parsing' | 'review' | 'error';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export interface AWBFormState {
  awbType: string;
  mawbNumber: string;
  hawbNumber: string;
  originIata: string;
  destIata: string;
  flightNumber: string;
  flightDate: string;
  shipperName: string;
  shipperAddress: string;
  consigneeName: string;
  consigneeAddress: string;
  cargoDescription: string;
  pieces: string;
  grossWeightKg: string;
  chargeableWeightKg: string;
  hsCode: string;
}

// ---------------------------------------------------------------------------
// Doc type badge config
// ---------------------------------------------------------------------------

const DOC_TYPE_CONFIG: Record<string, { label: string; color: string; icon: typeof Ship }> = {
  BL: { label: 'Bill of Lading', color: 'bg-blue-100 text-blue-700', icon: Ship },
  AWB: { label: 'Air Waybill', color: 'bg-sky-100 text-sky-700', icon: Plane },
  BOOKING_CONFIRMATION: { label: 'Booking Confirmation', color: 'bg-teal-100 text-teal-700', icon: ClipboardList },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const sanitiseAddress = (raw: string | null | undefined): string => {
  if (!raw) return '';
  return raw
    .replace(/\r\n|\r|\n/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

// Pre-filled field styling
const PREFILLED = 'bg-[#f0f7ff] border-[#93c5fd] font-medium';
const INPUT_BASE = 'w-full px-3 py-2 text-sm border rounded-lg text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--sky)] focus:border-transparent';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold text-[var(--text-mid)] mb-2">{children}</p>;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-[var(--text-mid)] mb-1">{children}</label>;
}

// ---------------------------------------------------------------------------
// Company search widget (shared)
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
// Component
// ---------------------------------------------------------------------------

export default function DocumentParseModal({
  ports,
  companyId,
  onClose,
  onResult,
  allowedTypes,
}: DocumentParseModalProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [docType, setDocType] = useState<DocType | null>(null);
  const [confidence, setConfidence] = useState<ParseConfidence | null>(null);
  const [parsedData, setParsedData] = useState<Record<string, unknown> | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // AWB form state (pre-filled from parsed data, user-editable)
  const [awbForm, setAwbForm] = useState<AWBFormState>({
    awbType: '', mawbNumber: '', hawbNumber: '',
    originIata: '', destIata: '', flightNumber: '', flightDate: '',
    shipperName: '', shipperAddress: '', consigneeName: '', consigneeAddress: '',
    cargoDescription: '', pieces: '', grossWeightKg: '', chargeableWeightKg: '', hsCode: '',
  });

  // Company assignment
  const [linkedCompanyId, setLinkedCompanyId] = useState<string | null>(null);
  const [linkedCompanyName, setLinkedCompanyName] = useState<string | null>(null);
  const [showCompanySearch, setShowCompanySearch] = useState(false);
  const [companySearch, setCompanySearch] = useState('');
  const [companyResults, setCompanyResults] = useState<Company[]>([]);

  const updateAwb = (partial: Partial<AWBFormState>) => {
    setAwbForm(prev => ({ ...prev, ...partial }));
  };

  const airPorts = ports.filter(p => p.port_type?.toLowerCase().includes('air') ?? false);
  const airPortOptions = airPorts.map(p => ({ value: p.un_code, label: `${p.un_code} — ${p.name || p.un_code}` }));

  const handleFile = useCallback((f: File) => {
    if (f.type !== 'application/pdf') {
      setError('Only PDF files are accepted.');
      return;
    }
    if (f.size > MAX_FILE_SIZE) {
      setError('File size exceeds 20MB limit.');
      return;
    }
    setFile(f);
    setError(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile],
  );

  const handleAnalyse = useCallback(async () => {
    if (!file) return;

    setPhase('parsing');
    setError(null);

    try {
      const buffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ''),
      );

      const result = await parseDocumentAction(base64, file.name);

      if (!result) {
        setError('No response from server.');
        setPhase('error');
        return;
      }

      if (!result.success) {
        setError(sanitiseErrorMessage(result.error));
        setPhase('error');
        return;
      }

      const dt = result.doc_type ?? 'UNKNOWN';
      const conf = result.confidence ?? 'LOW';

      if (dt === 'UNKNOWN') {
        setError('Could not identify the document type. Please try a different file.');
        setPhase('error');
        return;
      }

      if (allowedTypes && !allowedTypes.includes(dt)) {
        setError(`Detected document type "${dt}" is not accepted for this shipment.`);
        setPhase('error');
        return;
      }

      setDocType(dt);
      setConfidence(conf);
      const data = result.data as Record<string, unknown>;
      setParsedData(data);

      // Pre-fill AWB form if AWB
      if (dt === 'AWB') {
        setAwbForm({
          awbType: (data.awb_type as string) ?? '',
          mawbNumber: (data.mawb_number as string) ?? '',
          hawbNumber: (data.hawb_number as string) ?? '',
          originIata: (data.origin_iata as string) ?? '',
          destIata: (data.dest_iata as string) ?? '',
          flightNumber: (data.flight_number as string) ?? '',
          flightDate: (data.flight_date as string) ?? '',
          shipperName: sanitiseAddress(data.shipper_name as string),
          shipperAddress: sanitiseAddress(data.shipper_address as string),
          consigneeName: sanitiseAddress(data.consignee_name as string),
          consigneeAddress: sanitiseAddress(data.consignee_address as string),
          cargoDescription: sanitiseAddress(data.cargo_description as string),
          pieces: data.pieces != null ? String(data.pieces) : '',
          grossWeightKg: data.gross_weight_kg != null ? String(data.gross_weight_kg) : '',
          chargeableWeightKg: data.chargeable_weight_kg != null ? String(data.chargeable_weight_kg) : '',
          hsCode: (data.hs_code as string) ?? '',
        });
      }

      setPhase('review');
    } catch {
      setError('Failed to analyse document.');
      setPhase('error');
    }
  }, [file, allowedTypes]);

  const handleUseData = useCallback(() => {
    if (!docType || !parsedData) return;

    if (docType === 'AWB') {
      // Pass AWBFormState values (not raw parsed data)
      const awbPayload: ParsedAWBData = {
        awb_type: (awbForm.awbType || 'DIRECT') as 'HOUSE' | 'MASTER' | 'DIRECT',
        hawb_number: awbForm.hawbNumber || null,
        mawb_number: awbForm.mawbNumber || null,
        shipper_name: awbForm.shipperName || null,
        shipper_address: awbForm.shipperAddress || null,
        consignee_name: awbForm.consigneeName || null,
        consignee_address: awbForm.consigneeAddress || null,
        notify_party: null,
        origin_iata: awbForm.originIata || null,
        dest_iata: awbForm.destIata || null,
        flight_number: awbForm.flightNumber || null,
        flight_date: awbForm.flightDate || null,
        pieces: awbForm.pieces ? parseInt(awbForm.pieces, 10) : null,
        gross_weight_kg: awbForm.grossWeightKg ? parseFloat(awbForm.grossWeightKg) : null,
        chargeable_weight_kg: awbForm.chargeableWeightKg ? parseFloat(awbForm.chargeableWeightKg) : null,
        cargo_description: awbForm.cargoDescription || null,
        hs_code: awbForm.hsCode || null,
      };
      onResult(docType, awbPayload);
    } else {
      onResult(docType, parsedData as unknown as ParsedBCData | ParsedBL);
    }
  }, [docType, parsedData, awbForm, onResult]);

  // Company search handler — fetch on demand
  const handleCompanySearch = useCallback(async (query: string) => {
    setCompanySearch(query);
    if (!query.trim()) {
      setCompanyResults([]);
      return;
    }
    try {
      const { fetchCompaniesForShipmentAction } = await import('@/app/actions/shipments');
      const all = await fetchCompaniesForShipmentAction();
      const q = query.toLowerCase();
      setCompanyResults(
        all.filter(c =>
          c.name.toLowerCase().includes(q) || c.company_id.toLowerCase().includes(q)
        ).slice(0, 5)
      );
    } catch {
      setCompanyResults([]);
    }
  }, []);

  const renderField = (label: string, value: unknown) => {
    if (value === null || value === undefined || value === '') return null;
    const display = typeof value === 'object' ? JSON.stringify(value) : String(value);
    return (
      <div key={label} className="flex items-start gap-3 py-1.5">
        <span className="text-xs text-[var(--text-secondary)] w-40 shrink-0">{label}</span>
        <span className="text-xs text-[var(--text-primary)] break-all">{display}</span>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Upload Document</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--surface-hover)]">
            <X className="w-4 h-4 text-[var(--text-secondary)]" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Idle / Upload phase */}
          {phase === 'idle' && (
            <>
              <div
                className={cn(
                  'border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer',
                  dragOver
                    ? 'border-[var(--sky)] bg-[var(--sky-mist)]'
                    : file
                      ? 'border-green-300 bg-green-50'
                      : 'border-[var(--border)] hover:border-[var(--sky)]',
                )}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
              >
                {file ? (
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="w-8 h-8 text-green-600" />
                    <span className="text-xs font-medium text-green-700">{file.name}</span>
                    <span className="text-[10px] text-green-600">{(file.size / 1024).toFixed(0)} KB</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="w-8 h-8 text-[var(--text-secondary)]" />
                    <span className="text-xs text-[var(--text-secondary)]">Drop a PDF here or click to browse</span>
                    <span className="text-[10px] text-[var(--text-tertiary)]">PDF only, max 20MB</span>
                  </div>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
            </>
          )}

          {/* Parsing phase */}
          {phase === 'parsing' && (
            <div className="flex flex-col items-center gap-3 py-12">
              <Loader2 className="w-8 h-8 text-[var(--sky)] animate-spin" />
              <span className="text-sm text-[var(--text-secondary)]">Analysing document...</span>
              <span className="text-[10px] text-[var(--text-tertiary)]">This may take 10-20 seconds</span>
            </div>
          )}

          {/* Review phase */}
          {phase === 'review' && docType && parsedData && (
            <div className="space-y-4">
              {/* Doc type header */}
              <div className="flex items-center gap-2">
                {DOC_TYPE_CONFIG[docType] && (
                  <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full', DOC_TYPE_CONFIG[docType].color)}>
                    {(() => { const Icon = DOC_TYPE_CONFIG[docType].icon; return <Icon className="w-3.5 h-3.5" />; })()}
                    {DOC_TYPE_CONFIG[docType].label}
                  </span>
                )}
                {docType === 'AWB' && awbForm.awbType && (
                  <span className="px-1.5 py-0.5 text-[10px] font-medium bg-sky-50 text-sky-600 rounded">
                    {awbForm.awbType}
                  </span>
                )}
                {confidence && (
                  <span className={cn('px-2 py-0.5 text-[10px] font-medium rounded-full',
                    confidence === 'HIGH' ? 'bg-green-100 text-green-700'
                    : confidence === 'MEDIUM' ? 'bg-amber-100 text-amber-700'
                    : 'bg-red-100 text-red-700'
                  )}>
                    {confidence}
                  </span>
                )}
              </div>

              {/* Company ownership — State A: hidden if shipment already has owner */}
              {!companyId && (
                <div>
                  <SectionLabel>Customer / Shipment Owner</SectionLabel>
                  {linkedCompanyId ? (
                    <div className="flex items-center justify-between border border-emerald-300 bg-emerald-50 rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <div>
                          <p className="text-xs font-medium text-emerald-800">{linkedCompanyName ?? linkedCompanyId}</p>
                          <p className="text-[10px] text-emerald-600">{linkedCompanyId}</p>
                        </div>
                      </div>
                      <button onClick={() => { setLinkedCompanyId(null); setLinkedCompanyName(null); }} className="text-emerald-400 hover:text-emerald-600"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ) : (
                    <div className="border border-amber-300 bg-amber-50 rounded-lg p-3 space-y-2">
                      <div className="flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                        <p className="text-xs text-amber-700">No company match found. Assign an owner to this shipment:</p>
                      </div>
                      {showCompanySearch ? (
                        <div className="space-y-1.5">
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
                            <input
                              autoFocus
                              type="text"
                              value={companySearch}
                              onChange={e => handleCompanySearch(e.target.value)}
                              placeholder="Search by name or company ID..."
                              className={`${INPUT_BASE} pl-8 text-xs`}
                            />
                          </div>
                          {companyResults.length > 0 && (
                            <div className="border border-[var(--border)] rounded-lg overflow-hidden bg-white">
                              {companyResults.map(c => (
                                <button
                                  key={c.company_id}
                                  onClick={() => { setLinkedCompanyId(c.company_id); setLinkedCompanyName(c.name); setShowCompanySearch(false); }}
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
                          {companySearch && companyResults.length === 0 && (
                            <p className="text-xs text-[var(--text-muted)] text-center py-1">No matches found</p>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => { setShowCompanySearch(true); setCompanySearch(''); setCompanyResults([]); }}
                          className={`${INPUT_BASE} text-left text-xs text-[var(--text-muted)] flex items-center gap-2`}
                        >
                          <Search className="w-3.5 h-3.5" />
                          Search companies...
                        </button>
                      )}
                      <button
                        onClick={() => setShowCompanySearch(false)}
                        className="text-xs text-amber-600 hover:text-amber-800 w-full text-center py-0.5"
                      >
                        Skip — assign later
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* AWB — grouped editable sections */}
              {docType === 'AWB' ? (
                <>
                  {/* Route & Dates */}
                  <div>
                    <SectionLabel>Route & Dates</SectionLabel>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <FieldLabel>Origin Airport</FieldLabel>
                        <PortCombobox
                          value={awbForm.originIata}
                          onChange={code => updateAwb({ originIata: code })}
                          options={airPortOptions}
                          placeholder="Search airport..."
                          className={`${INPUT_BASE} ${awbForm.originIata ? PREFILLED : ''}`}
                        />
                      </div>
                      <div>
                        <FieldLabel>Dest Airport</FieldLabel>
                        <PortCombobox
                          value={awbForm.destIata}
                          onChange={code => updateAwb({ destIata: code })}
                          options={airPortOptions}
                          placeholder="Search airport..."
                          className={`${INPUT_BASE} ${awbForm.destIata ? PREFILLED : ''}`}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <div>
                        <FieldLabel>Flight Number</FieldLabel>
                        <input type="text" value={awbForm.flightNumber} onChange={e => updateAwb({ flightNumber: e.target.value })} className={`${INPUT_BASE} font-mono ${awbForm.flightNumber ? PREFILLED : ''}`} />
                      </div>
                      <div>
                        <FieldLabel>Flight Date</FieldLabel>
                        <input type="date" value={awbForm.flightDate} onChange={e => updateAwb({ flightDate: e.target.value })} className={`${INPUT_BASE} ${awbForm.flightDate ? PREFILLED : ''}`} />
                      </div>
                    </div>
                  </div>

                  {/* AWB Numbers */}
                  <div>
                    <SectionLabel>AWB Numbers</SectionLabel>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <FieldLabel>MAWB Number</FieldLabel>
                        <input type="text" value={awbForm.mawbNumber} onChange={e => updateAwb({ mawbNumber: e.target.value })} className={`${INPUT_BASE} font-mono ${awbForm.mawbNumber ? PREFILLED : ''}`} />
                      </div>
                      {(awbForm.awbType === 'HOUSE' || awbForm.hawbNumber) && (
                        <div>
                          <FieldLabel>HAWB Number</FieldLabel>
                          <input type="text" value={awbForm.hawbNumber} onChange={e => updateAwb({ hawbNumber: e.target.value })} className={`${INPUT_BASE} font-mono ${awbForm.hawbNumber ? PREFILLED : ''}`} />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Shipper */}
                  <div>
                    <SectionLabel>Shipper</SectionLabel>
                    <div>
                      <FieldLabel>Name</FieldLabel>
                      <input type="text" value={awbForm.shipperName} onChange={e => updateAwb({ shipperName: e.target.value })} className={`${INPUT_BASE} ${awbForm.shipperName ? PREFILLED : ''}`} />
                    </div>
                    <div className="mt-2">
                      <FieldLabel>Address</FieldLabel>
                      <textarea value={awbForm.shipperAddress} onChange={e => updateAwb({ shipperAddress: e.target.value })} rows={2} className={`${INPUT_BASE} resize-none ${awbForm.shipperAddress ? PREFILLED : ''}`} />
                    </div>
                  </div>

                  {/* Consignee */}
                  <div>
                    <SectionLabel>Consignee</SectionLabel>
                    <div>
                      <FieldLabel>Name</FieldLabel>
                      <input type="text" value={awbForm.consigneeName} onChange={e => updateAwb({ consigneeName: e.target.value })} className={`${INPUT_BASE} ${awbForm.consigneeName ? PREFILLED : ''}`} />
                    </div>
                    <div className="mt-2">
                      <FieldLabel>Address</FieldLabel>
                      <textarea value={awbForm.consigneeAddress} onChange={e => updateAwb({ consigneeAddress: e.target.value })} rows={2} className={`${INPUT_BASE} resize-none ${awbForm.consigneeAddress ? PREFILLED : ''}`} />
                    </div>
                  </div>

                  {/* Cargo */}
                  <div>
                    <SectionLabel>Cargo</SectionLabel>
                    <div>
                      <FieldLabel>Description</FieldLabel>
                      <textarea value={awbForm.cargoDescription} onChange={e => updateAwb({ cargoDescription: e.target.value })} rows={2} className={`${INPUT_BASE} resize-none ${awbForm.cargoDescription ? PREFILLED : ''}`} />
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <div>
                        <FieldLabel>Pieces</FieldLabel>
                        <input type="text" value={awbForm.pieces} onChange={e => updateAwb({ pieces: e.target.value })} className={`${INPUT_BASE} ${awbForm.pieces ? PREFILLED : ''}`} />
                      </div>
                      <div>
                        <FieldLabel>Gross Weight (kg)</FieldLabel>
                        <input type="text" value={awbForm.grossWeightKg} onChange={e => updateAwb({ grossWeightKg: e.target.value })} className={`${INPUT_BASE} ${awbForm.grossWeightKg ? PREFILLED : ''}`} />
                      </div>
                      <div>
                        <FieldLabel>Chargeable Weight (kg)</FieldLabel>
                        <input type="text" value={awbForm.chargeableWeightKg} onChange={e => updateAwb({ chargeableWeightKg: e.target.value })} className={`${INPUT_BASE} ${awbForm.chargeableWeightKg ? PREFILLED : ''}`} />
                      </div>
                    </div>
                  </div>

                </>
              ) : (
                <>
                  {/* BL / BC — existing flat field view */}
                  <div className="border border-[var(--border)] rounded-lg p-4 divide-y divide-[var(--border)]">
                    {Object.entries(parsedData).map(([key, value]) => {
                      if (key === 'containers' || key === 'cargo_items') return null;
                      const label = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
                      return renderField(label, value);
                    })}
                  </div>

                  {/* Containers table */}
                  {Array.isArray(parsedData.containers) && parsedData.containers.length > 0 && (
                    <div>
                      <h3 className="text-xs font-medium text-[var(--text-primary)] mb-2">Containers</h3>
                      <div className="border border-[var(--border)] rounded-lg overflow-hidden">
                        <table className="w-full text-xs">
                          <thead className="bg-[var(--surface)]">
                            <tr>
                              {Object.keys(parsedData.containers[0] as Record<string, unknown>).map((k) => (
                                <th key={k} className="px-3 py-2 text-left font-medium text-[var(--text-secondary)]">
                                  {k.replace(/_/g, ' ')}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {(parsedData.containers as Record<string, unknown>[]).map((c, i) => (
                              <tr key={i} className="border-t border-[var(--border)]">
                                {Object.values(c).map((v, j) => (
                                  <td key={j} className="px-3 py-2 text-[var(--text-primary)]">{v != null ? String(v) : '-'}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Cargo items table */}
                  {Array.isArray(parsedData.cargo_items) && parsedData.cargo_items.length > 0 && (
                    <div>
                      <h3 className="text-xs font-medium text-[var(--text-primary)] mb-2">Cargo Items</h3>
                      <div className="border border-[var(--border)] rounded-lg overflow-hidden">
                        <table className="w-full text-xs">
                          <thead className="bg-[var(--surface)]">
                            <tr>
                              {Object.keys(parsedData.cargo_items[0] as Record<string, unknown>).map((k) => (
                                <th key={k} className="px-3 py-2 text-left font-medium text-[var(--text-secondary)]">
                                  {k.replace(/_/g, ' ')}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {(parsedData.cargo_items as Record<string, unknown>[]).map((c, i) => (
                              <tr key={i} className="border-t border-[var(--border)]">
                                {Object.values(c).map((v, j) => (
                                  <td key={j} className="px-3 py-2 text-[var(--text-primary)]">{v != null ? String(v) : '-'}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                </>
              )}
            </div>
          )}

          {/* Error phase */}
          {phase === 'error' && (
            <div className="flex flex-col items-center gap-3 py-12">
              <AlertCircle className="w-8 h-8 text-red-500" />
              <span className="text-sm text-red-600">{error}</span>
              <button
                onClick={() => { setPhase('idle'); setError(null); }}
                className="text-xs text-[var(--sky)] hover:underline"
              >
                Try again
              </button>
            </div>
          )}

          {/* Inline error for idle phase */}
          {phase === 'idle' && error && (
            <p className="mt-2 text-xs text-red-500">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--border)]">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface)]"
          >
            Cancel
          </button>

          {phase === 'idle' && file && (
            <button
              onClick={handleAnalyse}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[var(--sky)] rounded-lg hover:bg-[var(--sky-deep)]"
            >
              <FileText className="w-3.5 h-3.5" />
              Analyse Document
            </button>
          )}

          {phase === 'review' && (
            <button
              onClick={handleUseData}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[var(--sky)] rounded-lg hover:bg-[var(--sky-deep)]"
            >
              <Check className="w-3.5 h-3.5" />
              Use This Data
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
