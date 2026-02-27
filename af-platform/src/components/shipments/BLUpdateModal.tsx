'use client';

import { useState, useCallback, useRef } from 'react';
import {
  Upload, CheckCircle, AlertTriangle, X, Loader2, Ship,
} from 'lucide-react';
import { parseBLAction, updateShipmentFromBLAction } from '@/app/actions/shipments-write';

// ─── Types ───────────────────────────────────────────────────────────────────

interface BLContainer {
  container_number: string | null;
  container_type: string | null;
  seal_number: string | null;
  packages: string | null;
  weight_kg: number | null;
}

interface BLCargoItem {
  description: string | null;
  quantity: string | null;
  gross_weight: string | null;
  measurement: string | null;
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
  cargo_items: BLCargoItem[] | null;
}

interface Props {
  shipmentId: string;
  onClose: () => void;
  onSuccess: () => void;
}

type Phase = 'upload' | 'parsing' | 'preview' | 'updating';

// ─── Styles ──────────────────────────────────────────────────────────────────

const inputBase = 'w-full px-3 py-2 text-sm border rounded-lg text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--sky)] focus:border-transparent';
const prefilled = 'bg-[#f0f7ff] border-[#93c5fd] font-medium';

// ─── Component ───────────────────────────────────────────────────────────────

export default function BLUpdateModal({ shipmentId, onClose, onSuccess }: Props) {
  const [phase, setPhase] = useState<Phase>('upload');
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Parsed data
  const [parsed, setParsed] = useState<ParsedBL | null>(null);
  const [blFile, setBlFile] = useState<File | null>(null);

  // Editable form state
  const [waybillNumber, setWaybillNumber] = useState('');
  const [carrierAgent, setCarrierAgent] = useState('');
  const [vesselName, setVesselName] = useState('');
  const [voyageNumber, setVoyageNumber] = useState('');
  const [etd, setEtd] = useState('');
  const [shipperName, setShipperName] = useState('');
  const [shipperAddress, setShipperAddress] = useState('');
  const [containers, setContainers] = useState<BLContainer[]>([]);
  const [cargoItems, setCargoItems] = useState<BLCargoItem[]>([]);

  const handleFile = useCallback(async (file: File) => {
    setPhase('parsing');
    setError(null);
    setBlFile(file);

    try {
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

      const data = result.data as { parsed: ParsedBL };
      const p = data.parsed;
      setParsed(p);

      // Pre-fill form — carrier_agent falls back to carrier for backward compat
      setWaybillNumber(p.waybill_number ?? '');
      setCarrierAgent(p.carrier_agent ?? p.carrier ?? '');
      setVesselName(p.vessel_name ?? '');
      setVoyageNumber(p.voyage_number ?? '');
      setEtd(p.on_board_date ?? '');
      setShipperName(p.shipper_name ?? '');
      setShipperAddress(p.shipper_address ?? '');
      setContainers(p.containers ?? []);
      setCargoItems(p.cargo_items ?? []);

      setPhase('preview');
    } catch (err) {
      console.error('[BLUpdateModal] parse error:', err);
      setError('Failed to parse BL');
      setPhase('upload');
    }
  }, []);

  const handleUpdate = useCallback(async () => {
    setPhase('updating');
    setError(null);

    try {
      const result = await updateShipmentFromBLAction(shipmentId, {
        waybill_number: waybillNumber || undefined,
        carrier_agent: carrierAgent || undefined,
        vessel_name: vesselName || undefined,
        voyage_number: voyageNumber || undefined,
        etd: etd || undefined,
        shipper_name: shipperName || undefined,
        shipper_address: shipperAddress || undefined,
        containers: containers.length > 0 ? containers.map(c => ({
          container_number: c.container_number ?? '',
          container_type: c.container_type ?? '',
          seal_number: c.seal_number ?? undefined,
        })) : undefined,
        cargo_items: cargoItems.length > 0 ? cargoItems.map(c => ({
          description: c.description ?? undefined,
          quantity: c.quantity ?? undefined,
          gross_weight: c.gross_weight ?? undefined,
          measurement: c.measurement ?? undefined,
        })) : undefined,
        file: blFile ?? undefined,
      });

      if (!result) {
        setError('No response from server');
        setPhase('preview');
        return;
      }
      if (!result.success) {
        setError(result.error);
        setPhase('preview');
        return;
      }

      onSuccess();
    } catch (err) {
      console.error('[BLUpdateModal] update error:', err);
      setError('Failed to update shipment');
      setPhase('preview');
    }
  }, [shipmentId, waybillNumber, carrierAgent, vesselName, voyageNumber, etd, shipperName, shipperAddress, containers, cargoItems, blFile, onSuccess]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto p-5 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ship className="w-4 h-4 text-[var(--sky)]" />
            <h3 className="text-sm font-semibold text-[var(--text)]">Upload BL — {shipmentId}</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--surface)] text-[var(--text-muted)]">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Phase: Upload */}
        {phase === 'upload' && (
          <div className="space-y-3">
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files[0];
                if (f) handleFile(f);
              }}
              onClick={() => fileRef.current?.click()}
              className={`flex flex-col items-center justify-center gap-3 p-10 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                dragOver
                  ? 'border-[var(--sky)] bg-[var(--sky-mist)]'
                  : 'border-[var(--border)] hover:border-[var(--sky)] hover:bg-[var(--sky-mist)]'
              }`}
            >
              <Upload className="w-8 h-8 text-[var(--text-muted)]" />
              <p className="text-sm text-[var(--text-mid)] text-center">
                Drop your Bill of Lading here or <span className="text-[var(--sky)] font-medium">browse</span>
              </p>
              <p className="text-xs text-[var(--text-muted)]">PDF, PNG, JPG, WEBP</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
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
        )}

        {/* Phase: Parsing */}
        {phase === 'parsing' && (
          <div className="flex flex-col items-center justify-center gap-4 py-12">
            <Loader2 className="w-8 h-8 text-[var(--sky)] animate-spin" />
            <p className="text-sm text-[var(--text-mid)]">Parsing Bill of Lading...</p>
          </div>
        )}

        {/* Phase: Preview / Updating */}
        {(phase === 'preview' || phase === 'updating') && parsed && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <span>BL parsed — review and update fields below</span>
            </div>

            {/* Carrier / Agent & Vessel */}
            <div>
              <SectionLabel>Carrier / Agent & Vessel</SectionLabel>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel>Carrier / Agent</FieldLabel>
                  <input type="text" value={carrierAgent} onChange={e => setCarrierAgent(e.target.value)} className={`${inputBase} ${carrierAgent ? prefilled : ''}`} />
                </div>
                <div>
                  <FieldLabel>Waybill / BL No.</FieldLabel>
                  <input type="text" value={waybillNumber} onChange={e => setWaybillNumber(e.target.value)} className={`${inputBase} font-mono ${waybillNumber ? prefilled : ''}`} />
                </div>
                <div>
                  <FieldLabel>Vessel</FieldLabel>
                  <input type="text" value={vesselName} onChange={e => setVesselName(e.target.value)} className={`${inputBase} ${vesselName ? prefilled : ''}`} />
                </div>
                <div>
                  <FieldLabel>Voyage</FieldLabel>
                  <input type="text" value={voyageNumber} onChange={e => setVoyageNumber(e.target.value)} className={`${inputBase} font-mono ${voyageNumber ? prefilled : ''}`} />
                </div>
              </div>
            </div>

            {/* ETD */}
            <div>
              <FieldLabel>ETD (On Board Date)</FieldLabel>
              <input type="date" value={etd} onChange={e => setEtd(e.target.value)} className={`${inputBase} w-48 ${etd ? prefilled : ''}`} />
            </div>

            {/* Shipper */}
            <div>
              <SectionLabel>Shipper</SectionLabel>
              <div className="space-y-2">
                <div>
                  <FieldLabel>Name</FieldLabel>
                  <input type="text" value={shipperName} onChange={e => setShipperName(e.target.value)} className={`${inputBase} ${shipperName ? prefilled : ''}`} />
                </div>
                <div>
                  <FieldLabel>Address</FieldLabel>
                  <textarea value={shipperAddress} onChange={e => setShipperAddress(e.target.value)} rows={2} className={`${inputBase} resize-none ${shipperAddress ? prefilled : ''}`} />
                </div>
              </div>
            </div>

            {/* Containers — only shown if non-empty (FCL) */}
            {containers.length > 0 && (
              <div>
                <SectionLabel>Containers</SectionLabel>
                <div className="border border-[var(--border)] rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-[var(--surface)]">
                      <tr>
                        <th className="text-left px-3 py-2 text-[var(--text-muted)] font-medium">Container No.</th>
                        <th className="text-left px-3 py-2 text-[var(--text-muted)] font-medium">Type</th>
                        <th className="text-left px-3 py-2 text-[var(--text-muted)] font-medium">Seal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {containers.map((c, i) => (
                        <tr key={i} className="border-t border-[var(--border)]">
                          <td className="px-3 py-2 font-mono text-[var(--text)]">{c.container_number ?? '—'}</td>
                          <td className="px-3 py-2 text-[var(--text)]">{c.container_type ?? '—'}</td>
                          <td className="px-3 py-2 text-[var(--text)]">{c.seal_number ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Cargo Items — shown for LCL when containers empty */}
            {cargoItems.length > 0 && (
              <div>
                <SectionLabel>Cargo Summary</SectionLabel>
                <div className="border border-[var(--border)] rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-[var(--surface)]">
                      <tr>
                        <th className="text-left px-3 py-2 text-[var(--text-muted)] font-medium">Description</th>
                        <th className="text-left px-3 py-2 text-[var(--text-muted)] font-medium">Qty</th>
                        <th className="text-left px-3 py-2 text-[var(--text-muted)] font-medium">Weight</th>
                        <th className="text-left px-3 py-2 text-[var(--text-muted)] font-medium">CBM</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cargoItems.map((c, i) => (
                        <tr key={i} className="border-t border-[var(--border)]">
                          <td className="px-3 py-2 text-[var(--text)]">{c.description ?? '—'}</td>
                          <td className="px-3 py-2 text-[var(--text)]">{c.quantity ?? '—'}</td>
                          <td className="px-3 py-2 text-[var(--text)]">{c.gross_weight ?? '—'}</td>
                          <td className="px-3 py-2 text-[var(--text)]">{c.measurement ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={onClose}
                disabled={phase === 'updating'}
                className="px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdate}
                disabled={phase === 'updating'}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-[var(--sky)] rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {phase === 'updating' ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update Shipment'
                )}
              </button>
            </div>
          </div>
        )}
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
