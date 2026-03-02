'use client';

import { useState, useCallback, useRef } from 'react';
import { X, Upload, FileText, Loader2, AlertCircle, Check, Plane, Ship, ClipboardList } from 'lucide-react';
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

interface DocumentParseModalProps {
  shipmentId?: string;
  ports: Port[];
  onClose: () => void;
  onResult: (docType: DocType, data: ParsedBCData | ParsedAWBData | ParsedBL) => void;
  allowedTypes?: DocType[];
}

type Phase = 'idle' | 'parsing' | 'review' | 'error';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

// ---------------------------------------------------------------------------
// Doc type badge config
// ---------------------------------------------------------------------------

const DOC_TYPE_CONFIG: Record<string, { label: string; color: string; icon: typeof Ship }> = {
  BL: { label: 'Bill of Lading', color: 'bg-blue-100 text-blue-700', icon: Ship },
  AWB: { label: 'Air Waybill', color: 'bg-sky-100 text-sky-700', icon: Plane },
  BOOKING_CONFIRMATION: { label: 'Booking Confirmation', color: 'bg-teal-100 text-teal-700', icon: ClipboardList },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DocumentParseModal({
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
      // Read file as base64
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
        setError(result.error ?? 'Parse failed');
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
      setParsedData(result.data as Record<string, unknown>);
      setPhase('review');
    } catch {
      setError('Failed to analyse document.');
      setPhase('error');
    }
  }, [file, allowedTypes]);

  const handleUseData = useCallback(() => {
    if (!docType || !parsedData) return;
    onResult(docType, parsedData as unknown as ParsedBCData | ParsedAWBData | ParsedBL);
  }, [docType, parsedData, onResult]);

  // Helper to render parsed field rows
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

  // Render AWB sub-badge
  const renderAwbSubBadge = () => {
    if (docType !== 'AWB' || !parsedData) return null;
    const awbType = parsedData.awb_type as string;
    if (!awbType) return null;
    return (
      <span className="px-1.5 py-0.5 text-[10px] font-medium bg-sky-50 text-sky-600 rounded">
        {awbType}
      </span>
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
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
              >
                {file ? (
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="w-8 h-8 text-green-600" />
                    <span className="text-xs font-medium text-green-700">{file.name}</span>
                    <span className="text-[10px] text-green-600">
                      {(file.size / 1024).toFixed(0)} KB
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="w-8 h-8 text-[var(--text-secondary)]" />
                    <span className="text-xs text-[var(--text-secondary)]">
                      Drop a PDF here or click to browse
                    </span>
                    <span className="text-[10px] text-[var(--text-tertiary)]">PDF only, max 20MB</span>
                  </div>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </>
          )}

          {/* Parsing phase */}
          {phase === 'parsing' && (
            <div className="flex flex-col items-center gap-3 py-12">
              <Loader2 className="w-8 h-8 text-[var(--sky)] animate-spin" />
              <span className="text-sm text-[var(--text-secondary)]">Analysing document...</span>
              <span className="text-[10px] text-[var(--text-tertiary)]">
                This may take 10-20 seconds
              </span>
            </div>
          )}

          {/* Review phase */}
          {phase === 'review' && docType && parsedData && (
            <div className="space-y-4">
              {/* Doc type badge */}
              <div className="flex items-center gap-2">
                {DOC_TYPE_CONFIG[docType] && (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full',
                      DOC_TYPE_CONFIG[docType].color,
                    )}
                  >
                    {(() => {
                      const Icon = DOC_TYPE_CONFIG[docType].icon;
                      return <Icon className="w-3.5 h-3.5" />;
                    })()}
                    {DOC_TYPE_CONFIG[docType].label}
                  </span>
                )}
                {renderAwbSubBadge()}
                {confidence && (
                  <span
                    className={cn(
                      'px-2 py-0.5 text-[10px] font-medium rounded-full',
                      confidence === 'HIGH'
                        ? 'bg-green-100 text-green-700'
                        : confidence === 'MEDIUM'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-red-100 text-red-700',
                    )}
                  >
                    {confidence}
                  </span>
                )}
              </div>

              {/* Parsed fields */}
              <div className="border border-[var(--border)] rounded-lg p-4 divide-y divide-[var(--border)]">
                {Object.entries(parsedData).map(([key, value]) => {
                  if (key === 'containers' || key === 'cargo_items') return null;
                  const label = key
                    .replace(/_/g, ' ')
                    .replace(/\b\w/g, (c) => c.toUpperCase());
                  return renderField(label, value);
                })}
              </div>

              {/* Containers table (if present) */}
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
                              <td key={j} className="px-3 py-2 text-[var(--text-primary)]">
                                {v != null ? String(v) : '-'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Cargo items table (BL only) */}
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
                              <td key={j} className="px-3 py-2 text-[var(--text-primary)]">
                                {v != null ? String(v) : '-'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error phase */}
          {phase === 'error' && (
            <div className="flex flex-col items-center gap-3 py-12">
              <AlertCircle className="w-8 h-8 text-red-500" />
              <span className="text-sm text-red-600">{error}</span>
              <button
                onClick={() => {
                  setPhase('idle');
                  setError(null);
                }}
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
