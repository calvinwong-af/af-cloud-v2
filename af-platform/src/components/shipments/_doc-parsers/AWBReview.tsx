'use client';

import { PortCombobox } from '@/components/shared/PortCombobox';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

interface Port {
  un_code: string;
  name: string;
  country_name: string;
  port_type: string;
  has_terminals: boolean;
  terminals: Array<{ terminal_id: string; name: string; is_default: boolean }>;
}

interface CurrentParties {
  shipper?: { name?: string; address?: string };
  consignee?: { name?: string; address?: string };
}

export interface AWBReviewProps {
  formState: AWBFormState;
  setFormState: (s: AWBFormState) => void;
  currentParties?: CurrentParties;
  ports: Port[];
  isApplying: boolean;
  applyError: string | null;
  onConfirm: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
// AWBReview component
// ---------------------------------------------------------------------------

export function AWBReview({
  formState,
  setFormState,
  currentParties,
  ports,
}: AWBReviewProps) {
  const updateAwb = (partial: Partial<AWBFormState>) => {
    setFormState({ ...formState, ...partial });
  };

  const airPorts = ports.filter(p => p.port_type?.toLowerCase().includes('air') ?? false);
  const airPortOptions = airPorts.map(p => ({
    value: p.un_code,
    label: `${p.un_code} — ${p.name || p.un_code}`,
    sublabel: p.country_name,
    has_terminals: p.has_terminals,
    terminals: p.terminals ?? [],
  }));

  return (
    <>
      {/* Route & Dates */}
      <div>
        <SectionLabel>Route &amp; Dates</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Origin Airport</FieldLabel>
            <PortCombobox
              value={formState.originIata}
              onChange={code => updateAwb({ originIata: code })}
              options={airPortOptions}
              placeholder="Search airport..."
              className={`${INPUT_BASE} ${formState.originIata ? PREFILLED : ''}`}
            />
          </div>
          <div>
            <FieldLabel>Dest Airport</FieldLabel>
            <PortCombobox
              value={formState.destIata}
              onChange={code => updateAwb({ destIata: code })}
              options={airPortOptions}
              placeholder="Search airport..."
              className={`${INPUT_BASE} ${formState.destIata ? PREFILLED : ''}`}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-2">
          <div>
            <FieldLabel>Flight Number</FieldLabel>
            <input type="text" value={formState.flightNumber} onChange={e => updateAwb({ flightNumber: e.target.value })} className={`${INPUT_BASE} font-mono ${formState.flightNumber ? PREFILLED : ''}`} />
          </div>
          <div>
            <FieldLabel>Flight Date</FieldLabel>
            <input type="date" value={formState.flightDate} onChange={e => updateAwb({ flightDate: e.target.value })} className={`${INPUT_BASE} ${formState.flightDate ? PREFILLED : ''}`} />
          </div>
        </div>
      </div>

      {/* AWB Numbers */}
      <div>
        <SectionLabel>AWB Numbers</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>MAWB Number</FieldLabel>
            <input type="text" value={formState.mawbNumber} onChange={e => updateAwb({ mawbNumber: e.target.value })} className={`${INPUT_BASE} font-mono ${formState.mawbNumber ? PREFILLED : ''}`} />
          </div>
          {(formState.awbType === 'HOUSE' || formState.hawbNumber) && (
            <div>
              <FieldLabel>HAWB Number</FieldLabel>
              <input type="text" value={formState.hawbNumber} onChange={e => updateAwb({ hawbNumber: e.target.value })} className={`${INPUT_BASE} font-mono ${formState.hawbNumber ? PREFILLED : ''}`} />
            </div>
          )}
        </div>
      </div>

      {/* Shipper */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <SectionLabel>Shipper</SectionLabel>
          {currentParties?.shipper?.name && formState.shipperName && formState.shipperName !== currentParties.shipper.name && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 rounded">Differs from current</span>
          )}
        </div>
        <div>
          <FieldLabel>Name</FieldLabel>
          <input type="text" value={formState.shipperName} onChange={e => updateAwb({ shipperName: e.target.value })} className={`${INPUT_BASE} ${formState.shipperName ? PREFILLED : ''}`} />
        </div>
        <div className="mt-2">
          <FieldLabel>Address</FieldLabel>
          <textarea value={formState.shipperAddress} onChange={e => updateAwb({ shipperAddress: e.target.value })} rows={2} className={`${INPUT_BASE} resize-none ${formState.shipperAddress ? PREFILLED : ''}`} />
        </div>
      </div>

      {/* Consignee */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <SectionLabel>Consignee</SectionLabel>
          {currentParties?.consignee?.name && formState.consigneeName && formState.consigneeName !== currentParties.consignee.name && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 rounded">Differs from current</span>
          )}
        </div>
        <div>
          <FieldLabel>Name</FieldLabel>
          <input type="text" value={formState.consigneeName} onChange={e => updateAwb({ consigneeName: e.target.value })} className={`${INPUT_BASE} ${formState.consigneeName ? PREFILLED : ''}`} />
        </div>
        <div className="mt-2">
          <FieldLabel>Address</FieldLabel>
          <textarea value={formState.consigneeAddress} onChange={e => updateAwb({ consigneeAddress: e.target.value })} rows={2} className={`${INPUT_BASE} resize-none ${formState.consigneeAddress ? PREFILLED : ''}`} />
        </div>
      </div>

      {/* Cargo */}
      <div>
        <SectionLabel>Cargo</SectionLabel>
        <div>
          <FieldLabel>Description</FieldLabel>
          <textarea value={formState.cargoDescription} onChange={e => updateAwb({ cargoDescription: e.target.value })} rows={2} className={`${INPUT_BASE} resize-none ${formState.cargoDescription ? PREFILLED : ''}`} />
        </div>
        <div className="grid grid-cols-2 gap-3 mt-2">
          <div>
            <FieldLabel>Pieces</FieldLabel>
            <input type="text" value={formState.pieces} onChange={e => updateAwb({ pieces: e.target.value })} className={`${INPUT_BASE} ${formState.pieces ? PREFILLED : ''}`} />
          </div>
          <div>
            <FieldLabel>Gross Weight (kg)</FieldLabel>
            <input type="text" value={formState.grossWeightKg} onChange={e => updateAwb({ grossWeightKg: e.target.value })} className={`${INPUT_BASE} ${formState.grossWeightKg ? PREFILLED : ''}`} />
          </div>
          <div>
            <FieldLabel>Chargeable Weight (kg)</FieldLabel>
            <input type="text" value={formState.chargeableWeightKg} onChange={e => updateAwb({ chargeableWeightKg: e.target.value })} className={`${INPUT_BASE} ${formState.chargeableWeightKg ? PREFILLED : ''}`} />
          </div>
        </div>
      </div>
    </>
  );
}
