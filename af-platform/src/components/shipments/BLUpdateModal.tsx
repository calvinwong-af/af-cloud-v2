'use client';

import { useState, useCallback, useRef } from 'react';
import {
  Upload, CheckCircle, AlertTriangle, X, Loader2, Ship, Plus,
} from 'lucide-react';
import { parseBLAction, updateShipmentFromBLAction } from '@/app/actions/shipments-write';
import { DateTimeInput } from '@/components/shared/DateInput';

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Coerce a date string from BL parser to YYYY-MM-DD for <input type="date">.
 * Handles: YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY, "DD Mon YYYY", "Month DD YYYY"
 * Returns empty string if unparseable.
 */
function normaliseDateToISO(raw: string | null | undefined): string {
  if (!raw) return '';
  const s = raw.trim();

  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // Try native Date parse first (handles "Feb 7 2026", "February 7, 2026", etc.)
  const native = new Date(s);
  if (!isNaN(native.getTime())) {
    return native.toISOString().slice(0, 10);
  }

  // DD/MM/YYYY — dominant format in MY/SG/HK shipping docs
  const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, a, b, year] = slashMatch;
    const month = b.padStart(2, '0');
    const day = a.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // DD-MM-YYYY
  const dashMatch = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dashMatch) {
    const [, day, month, year] = dashMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  return ''; // unparseable — let user fill manually
}

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
      setEtd(normaliseDateToISO(p.on_board_date));
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
      const formData = new FormData();
      if (waybillNumber)   formData.append('waybill_number',  waybillNumber);
      if (carrierAgent)    formData.append('carrier_agent',   carrierAgent);
      if (vesselName)      formData.append('vessel_name',     vesselName);
      if (voyageNumber)    formData.append('voyage_number',   voyageNumber);
      if (etd)             formData.append('etd',             etd);
      if (shipperName)     formData.append('shipper_name',    shipperName);
      if (shipperAddress)  formData.append('shipper_address', shipperAddress);
      if (containers.length > 0) {
        formData.append('containers', JSON.stringify(
          containers.map(c => ({
            container_number: c.container_number ?? '',
            container_type:   c.container_type ?? '',
            seal_number:      c.seal_number ?? '',
          }))
        ));
      }
      if (cargoItems.length > 0) {
        formData.append('cargo_items', JSON.stringify(
          cargoItems.map(c => ({
            description:  c.description  ?? '',
            quantity:     c.quantity     ?? '',
            gross_weight: c.gross_weight ?? '',
            measurement:  c.measurement  ?? '',
          }))
        ));
      }
      if (blFile) formData.append('file', blFile);

      const result = await updateShipmentFromBLAction(shipmentId, formData);

      if (!result?.success) {
        setError(result?.error ?? 'Failed to update shipment');
        setPhase('preview');
        return;
      }

      onSuccess();
    } catch (err) {
      console.error('[BLUpdateModal] update error:', err);
      setError('Failed to update shipment');
      setPhase('preview');
    }
  }, [shipmentId, waybillNumber, carrierAgent, vesselName, voyageNumber, etd,
    shipperName, shipperAddress, containers, cargoItems, blFile, onSuccess]);

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
              <DateTimeInput value={etd} onChange={setEtd} className={`${inputBase} w-56 ${etd ? prefilled : ''}`} />
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

            {/* Containers — editable (FCL) */}
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
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {containers.map((c, i) => (
                        <tr key={i} className="border-t border-[var(--border)]">
                          <td className="px-3 py-1.5">
                            <input type="text" value={c.container_number ?? ''} onChange={e => { const u = [...containers]; u[i] = { ...u[i], container_number: e.target.value }; setContainers(u); }}
                              className="w-full text-xs font-mono bg-transparent border-b border-transparent focus:border-[var(--sky)] focus:outline-none py-0.5 transition-colors" />
                          </td>
                          <td className="px-3 py-1.5">
                            <input type="text" value={c.container_type ?? ''} onChange={e => { const u = [...containers]; u[i] = { ...u[i], container_type: e.target.value }; setContainers(u); }}
                              className="w-full text-xs bg-transparent border-b border-transparent focus:border-[var(--sky)] focus:outline-none py-0.5 transition-colors" />
                          </td>
                          <td className="px-3 py-1.5">
                            <input type="text" value={c.seal_number ?? ''} onChange={e => { const u = [...containers]; u[i] = { ...u[i], seal_number: e.target.value }; setContainers(u); }}
                              className="w-full text-xs bg-transparent border-b border-transparent focus:border-[var(--sky)] focus:outline-none py-0.5 transition-colors" />
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            <button onClick={() => setContainers(containers.filter((_, idx) => idx !== i))} className="text-[var(--text-muted)] hover:text-red-500 transition-colors">
                              <X className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="px-3 py-2 border-t border-[var(--border)]">
                    <button onClick={() => setContainers([...containers, { container_number: '', container_type: '', seal_number: '', packages: null, weight_kg: null }])}
                      className="flex items-center gap-1 text-xs text-[var(--sky)] hover:underline">
                      <Plus className="w-3 h-3" /> Add row
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Cargo Items — editable (LCL) */}
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
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {cargoItems.map((c, i) => (
                        <tr key={i} className="border-t border-[var(--border)]">
                          <td className="px-3 py-1.5">
                            <input type="text" value={c.description ?? ''} onChange={e => { const u = [...cargoItems]; u[i] = { ...u[i], description: e.target.value }; setCargoItems(u); }}
                              className="w-full text-xs bg-transparent border-b border-transparent focus:border-[var(--sky)] focus:outline-none py-0.5 transition-colors" />
                          </td>
                          <td className="px-3 py-1.5">
                            <input type="text" value={c.quantity ?? ''} onChange={e => { const u = [...cargoItems]; u[i] = { ...u[i], quantity: e.target.value }; setCargoItems(u); }}
                              className="w-full text-xs bg-transparent border-b border-transparent focus:border-[var(--sky)] focus:outline-none py-0.5 transition-colors" />
                          </td>
                          <td className="px-3 py-1.5">
                            <input type="text" value={c.gross_weight ?? ''} onChange={e => { const u = [...cargoItems]; u[i] = { ...u[i], gross_weight: e.target.value }; setCargoItems(u); }}
                              className="w-full text-xs bg-transparent border-b border-transparent focus:border-[var(--sky)] focus:outline-none py-0.5 transition-colors" />
                          </td>
                          <td className="px-3 py-1.5">
                            <input type="text" value={c.measurement ?? ''} onChange={e => { const u = [...cargoItems]; u[i] = { ...u[i], measurement: e.target.value }; setCargoItems(u); }}
                              className="w-full text-xs bg-transparent border-b border-transparent focus:border-[var(--sky)] focus:outline-none py-0.5 transition-colors" />
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            <button onClick={() => setCargoItems(cargoItems.filter((_, idx) => idx !== i))} className="text-[var(--text-muted)] hover:text-red-500 transition-colors">
                              <X className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="px-3 py-2 border-t border-[var(--border)]">
                    <button onClick={() => setCargoItems([...cargoItems, { description: '', quantity: '', gross_weight: '', measurement: '' }])}
                      className="flex items-center gap-1 text-xs text-[var(--sky)] hover:underline">
                      <Plus className="w-3 h-3" /> Add row
                    </button>
                  </div>
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
