'use client';

import { Plus, Trash2 } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BCFormState = Record<string, unknown>;

interface BCContainer {
  size: string;
  quantity: number;
}

interface Port {
  un_code: string;
  name: string;
  country: string;
  port_type: string;
  has_terminals: boolean;
  terminals: Array<{ terminal_id: string; name: string; is_default: boolean }>;
}

export interface BCReviewProps {
  formState: BCFormState;
  setFormState: (s: BCFormState) => void;
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
// BCReview component
// ---------------------------------------------------------------------------

export function BCReview({
  formState,
  setFormState,
}: BCReviewProps) {
  const update = (key: string, value: unknown) => {
    setFormState({ ...formState, [key]: value });
  };

  const containers = (Array.isArray(formState.containers) ? formState.containers : []) as BCContainer[];

  const updateContainer = (idx: number, field: keyof BCContainer, value: string) => {
    const updated = containers.map((c, i) => i === idx ? { ...c, [field]: field === 'quantity' ? (parseInt(value, 10) || 0) : value } : c);
    update('containers', updated);
  };

  const addContainer = () => {
    update('containers', [...containers, { size: '', quantity: 1 }]);
  };

  const removeContainer = (idx: number) => {
    update('containers', containers.filter((_, i) => i !== idx));
  };

  const hasParties = str(formState.booking_party) || str(formState.shipper);

  return (
    <>
      {/* Booking */}
      <div>
        <SectionLabel>Booking</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Booking Reference</FieldLabel>
            <input type="text" value={str(formState.booking_reference)} onChange={e => update('booking_reference', e.target.value)} className={`${INPUT_BASE} font-mono ${str(formState.booking_reference) ? PREFILLED : ''}`} />
          </div>
          <div>
            <FieldLabel>Carrier</FieldLabel>
            <input type="text" value={str(formState.carrier)} onChange={e => update('carrier', e.target.value)} className={`${INPUT_BASE} ${str(formState.carrier) ? PREFILLED : ''}`} />
          </div>
        </div>
      </div>

      {/* Vessel & Voyage */}
      <div>
        <SectionLabel>Vessel &amp; Voyage</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Vessel Name</FieldLabel>
            <input type="text" value={str(formState.vessel_name)} onChange={e => update('vessel_name', e.target.value)} className={`${INPUT_BASE} ${str(formState.vessel_name) ? PREFILLED : ''}`} />
          </div>
          <div>
            <FieldLabel>Voyage Number</FieldLabel>
            <input type="text" value={str(formState.voyage_number)} onChange={e => update('voyage_number', e.target.value)} className={`${INPUT_BASE} font-mono ${str(formState.voyage_number) ? PREFILLED : ''}`} />
          </div>
        </div>
      </div>

      {/* Ports & Dates */}
      <div>
        <SectionLabel>Ports &amp; Dates</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>POL</FieldLabel>
            <input type="text" value={str(formState.pol_code) + (str(formState.pol_name) ? ` — ${str(formState.pol_name)}` : '')} readOnly className={`${INPUT_BASE} bg-[var(--surface)] ${str(formState.pol_code) ? PREFILLED : ''}`} />
          </div>
          <div>
            <FieldLabel>POD</FieldLabel>
            <input type="text" value={str(formState.pod_code) + (str(formState.pod_name) ? ` — ${str(formState.pod_name)}` : '')} readOnly className={`${INPUT_BASE} bg-[var(--surface)] ${str(formState.pod_code) ? PREFILLED : ''}`} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-2">
          <div>
            <FieldLabel>ETD</FieldLabel>
            <input type="date" value={str(formState.etd)} onChange={e => update('etd', e.target.value)} className={`${INPUT_BASE} ${str(formState.etd) ? PREFILLED : ''}`} />
          </div>
          <div>
            <FieldLabel>ETA POD</FieldLabel>
            <input type="date" value={str(formState.eta_pod)} onChange={e => update('eta_pod', e.target.value)} className={`${INPUT_BASE} ${str(formState.eta_pod) ? PREFILLED : ''}`} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-2">
          <div>
            <FieldLabel>ETA POL</FieldLabel>
            <input type="date" value={str(formState.eta_pol)} onChange={e => update('eta_pol', e.target.value)} className={`${INPUT_BASE} ${str(formState.eta_pol) ? PREFILLED : ''}`} />
          </div>
          <div>
            <FieldLabel>Cut Off Date</FieldLabel>
            <input type="date" value={str(formState.cut_off_date)} onChange={e => update('cut_off_date', e.target.value)} className={`${INPUT_BASE} ${str(formState.cut_off_date) ? PREFILLED : ''}`} />
          </div>
        </div>
      </div>

      {/* Cargo */}
      <div>
        <SectionLabel>Cargo</SectionLabel>
        <div>
          <FieldLabel>Description</FieldLabel>
          <textarea value={str(formState.cargo_description)} onChange={e => update('cargo_description', e.target.value)} rows={2} className={`${INPUT_BASE} resize-none ${str(formState.cargo_description) ? PREFILLED : ''}`} />
        </div>
        <div className="grid grid-cols-2 gap-3 mt-2">
          <div>
            <FieldLabel>HS Code</FieldLabel>
            <input type="text" value={str(formState.hs_code)} onChange={e => update('hs_code', e.target.value)} className={`${INPUT_BASE} font-mono ${str(formState.hs_code) ? PREFILLED : ''}`} />
          </div>
          <div>
            <FieldLabel>Weight (kg)</FieldLabel>
            <input type="number" step="0.01" value={str(formState.cargo_weight_kg)} onChange={e => update('cargo_weight_kg', e.target.value ? parseFloat(e.target.value) : null)} className={`${INPUT_BASE} ${str(formState.cargo_weight_kg) ? PREFILLED : ''}`} />
          </div>
        </div>
      </div>

      {/* Containers */}
      {containers.length > 0 && (
        <div>
          <SectionLabel>Containers</SectionLabel>
          <div className="border border-[var(--border)] rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-[var(--surface)]">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-[var(--text-mid)]">Size</th>
                  <th className="px-3 py-2 text-left font-medium text-[var(--text-mid)]">Quantity</th>
                  <th className="px-3 py-2 w-8" />
                </tr>
              </thead>
              <tbody>
                {containers.map((c, i) => (
                  <tr key={i} className="border-t border-[var(--border)]">
                    <td className="px-2 py-1.5">
                      <input type="text" value={str(c.size)} onChange={e => updateContainer(i, 'size', e.target.value)} className={`${INPUT_BASE} text-xs ${str(c.size) ? PREFILLED : ''}`} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" value={str(c.quantity)} onChange={e => updateContainer(i, 'quantity', e.target.value)} className={`${INPUT_BASE} text-xs ${str(c.quantity) ? PREFILLED : ''}`} />
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

      {/* Other Parties */}
      {hasParties && (
        <div>
          <SectionLabel>Other Parties</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            {str(formState.booking_party) && (
              <div>
                <FieldLabel>Booking Party</FieldLabel>
                <input type="text" value={str(formState.booking_party)} onChange={e => update('booking_party', e.target.value)} className={`${INPUT_BASE} ${PREFILLED}`} />
              </div>
            )}
            {str(formState.shipper) && (
              <div>
                <FieldLabel>Shipper</FieldLabel>
                <input type="text" value={str(formState.shipper)} onChange={e => update('shipper', e.target.value)} className={`${INPUT_BASE} ${PREFILLED}`} />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
