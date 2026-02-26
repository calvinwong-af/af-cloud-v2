'use client';

import { useState } from 'react';
import { createShipmentOrderAction, CreateShipmentOrderPayload } from '@/app/actions/shipments-write';

// ─── Constants ────────────────────────────────────────────────────────────────

const CONTAINER_SIZES = ['20GP', '40GP', '40HC', '45HC', '20RF', '40RF'];
const CONTAINER_TYPES = ['DRY', 'REEFER', 'OPEN_TOP', 'FLAT_RACK'];
const INCOTERMS = ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'];

const STEPS = [
  { id: 1, label: 'Order' },
  { id: 2, label: 'Route' },
  { id: 3, label: 'Cargo' },
  { id: 4, label: 'Containers' },
  { id: 5, label: 'Parties' },
  { id: 6, label: 'Dates' },
  { id: 7, label: 'Review' },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface ContainerRow {
  container_size: string;
  container_type: string;
  quantity: number;
}

interface PartyForm {
  name: string;
  address: string;
  contact_person: string;
  phone: string;
  email: string;
  company_id: string;
}

interface Company {
  company_id: string;
  name: string;
}

interface Props {
  companies: Company[];
  onClose: () => void;
  onCreated: (shipmentOrderId: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyParty(): PartyForm {
  return { name: '', address: '', contact_person: '', phone: '', email: '', company_id: '' };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center gap-1 mb-6">
      {STEPS.map((step, i) => (
        <div key={step.id} className="flex items-center gap-1">
          <div
            className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold transition-colors ${
              step.id < currentStep
                ? 'bg-[var(--sky)] text-white'
                : step.id === currentStep
                ? 'bg-[var(--slate)] text-white'
                : 'bg-[var(--border)] text-[var(--text-muted)]'
            }`}
          >
            {step.id < currentStep ? '✓' : step.id}
          </div>
          <span
            className={`text-xs hidden sm:inline ${
              step.id === currentStep ? 'text-[var(--text)] font-medium' : 'text-[var(--text-muted)]'
            }`}
          >
            {step.label}
          </span>
          {i < STEPS.length - 1 && <div className="w-4 h-px bg-[var(--border)] mx-1" />}
        </div>
      ))}
    </div>
  );
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-medium text-[var(--text-mid)] mb-1">
      {children}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

function Input({ value, onChange, placeholder, className = '' }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--sky)] focus:border-transparent ${className}`}
    />
  );
}

function Select({ value, onChange, children, className = '' }: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--sky)] focus:border-transparent ${className}`}
    >
      {children}
    </select>
  );
}

function PartySection({ title, party, onChange }: {
  title: string;
  party: PartyForm;
  onChange: (updated: PartyForm) => void;
}) {
  const set = (field: keyof PartyForm) => (v: string) => onChange({ ...party, [field]: v });
  return (
    <div className="border border-[var(--border)] rounded-lg p-4 space-y-3">
      <p className="text-sm font-semibold text-[var(--text)]">{title}</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <FieldLabel>Name</FieldLabel>
          <Input value={party.name} onChange={set('name')} placeholder="Company or individual name" />
        </div>
        <div className="col-span-2">
          <FieldLabel>Address</FieldLabel>
          <Input value={party.address} onChange={set('address')} placeholder="Full address" />
        </div>
        <div>
          <FieldLabel>Contact Person</FieldLabel>
          <Input value={party.contact_person} onChange={set('contact_person')} placeholder="Full name" />
        </div>
        <div>
          <FieldLabel>Phone</FieldLabel>
          <Input value={party.phone} onChange={set('phone')} placeholder="+60 12 345 6789" />
        </div>
        <div className="col-span-2">
          <FieldLabel>Email</FieldLabel>
          <Input value={party.email} onChange={set('email')} placeholder="email@company.com" />
        </div>
        <div>
          <FieldLabel>AFC Company ID (if registered)</FieldLabel>
          <Input value={party.company_id} onChange={set('company_id')} placeholder="AFC-XXXX" />
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CreateShipmentModal({ companies, onClose, onCreated }: Props) {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Order type
  const [orderType] = useState<'SEA_FCL'>('SEA_FCL'); // locked to FCL for initial scope
  const [transactionType, setTransactionType] = useState<'IMPORT' | 'EXPORT' | 'DOMESTIC'>('IMPORT');

  // Step 2: Route
  const [originCode, setOriginCode] = useState('');
  const [originLabel, setOriginLabel] = useState('');
  const [destCode, setDestCode] = useState('');
  const [destLabel, setDestLabel] = useState('');
  const [incoterm, setIncoterm] = useState('');

  // Step 3: Customer + Cargo
  const [companyId, setCompanyId] = useState('');
  const [cargoDesc, setCargoDesc] = useState('');
  const [cargoHsCode, setCargoHsCode] = useState('');
  const [cargoDg, setCargoDg] = useState(false);

  // Step 4: Containers
  const [containers, setContainers] = useState<ContainerRow[]>([
    { container_size: '20GP', container_type: 'DRY', quantity: 1 },
  ]);

  // Step 5: Parties
  const [shipper, setShipper] = useState<PartyForm>(emptyParty());
  const [consignee, setConsignee] = useState<PartyForm>(emptyParty());
  const [notifyParty, setNotifyParty] = useState<PartyForm>(emptyParty());

  // Step 6: Dates
  const [cargoReadyDate, setCargoReadyDate] = useState('');
  const [etd, setEtd] = useState('');
  const [eta, setEta] = useState('');

  // ── Container helpers ──
  function addContainer() {
    setContainers([...containers, { container_size: '20GP', container_type: 'DRY', quantity: 1 }]);
  }
  function removeContainer(i: number) {
    setContainers(containers.filter((_, idx) => idx !== i));
  }
  function updateContainer(i: number, field: keyof ContainerRow, value: string | number) {
    setContainers(containers.map((c, idx) => idx === i ? { ...c, [field]: value } : c));
  }

  // ── Validation per step ──
  function validateStep(): string | null {
    if (step === 2) {
      if (!originCode.trim()) return 'Origin port UN code is required';
      if (!originLabel.trim()) return 'Origin port name is required';
      if (!destCode.trim()) return 'Destination port UN code is required';
      if (!destLabel.trim()) return 'Destination port name is required';
    }
    if (step === 3) {
      if (!companyId) return 'Customer company is required';
      if (!cargoDesc.trim()) return 'Cargo description is required';
    }
    if (step === 4) {
      if (containers.length === 0) return 'At least one container is required';
      for (const c of containers) {
        if (!c.container_size || !c.container_type) return 'All container fields are required';
        if (!c.quantity || c.quantity < 1) return 'Container quantity must be at least 1';
      }
    }
    return null;
  }

  function next() {
    const err = validateStep();
    if (err) { setError(err); return; }
    setError(null);
    setStep((s) => s + 1);
  }
  function back() {
    setError(null);
    setStep((s) => s - 1);
  }

  // ── Submit ──
  async function handleSubmit() {
    setSubmitting(true);
    setError(null);

    const toParty = (p: PartyForm) =>
      p.name.trim()
        ? {
            name: p.name.trim(),
            address: p.address.trim() || null,
            contact_person: p.contact_person.trim() || null,
            phone: p.phone.trim() || null,
            email: p.email.trim() || null,
            company_id: p.company_id.trim() || null,
            company_contact_id: null,
          }
        : null;

    const payload: CreateShipmentOrderPayload = {
      order_type: orderType,
      transaction_type: transactionType,
      company_id: companyId,
      origin_port_un_code: originCode.trim().toUpperCase(),
      origin_label: originLabel.trim(),
      destination_port_un_code: destCode.trim().toUpperCase(),
      destination_label: destLabel.trim(),
      incoterm_code: incoterm || null,
      cargo_description: cargoDesc.trim(),
      cargo_hs_code: cargoHsCode.trim() || null,
      cargo_is_dg: cargoDg,
      containers: containers.map((c) => ({
        container_size: c.container_size,
        container_type: c.container_type,
        quantity: Number(c.quantity),
      })),
      shipper: toParty(shipper),
      consignee: toParty(consignee),
      notify_party: toParty(notifyParty),
      cargo_ready_date: cargoReadyDate || null,
      etd: etd || null,
      eta: eta || null,
    };

    const result = await createShipmentOrderAction(payload);
    setSubmitting(false);

    if (!result.success) {
      setError(result.error ?? 'Failed to create shipment order');
      return;
    }

    onCreated(result.shipment_id);
  }

  const selectedCompany = companies.find((c) => c.company_id === companyId);

  // ── Step content ──
  function renderStep() {
    switch (step) {
      case 1:
        return (
          <div className="space-y-5">
            <div>
              <FieldLabel>Order Type</FieldLabel>
              <div className="flex items-center gap-2 px-3 py-2 bg-[var(--surface)] rounded-lg border border-[var(--border)]">
                <span className="text-sm font-semibold text-[var(--sky)]">SEA FCL</span>
                <span className="text-xs text-[var(--text-muted)]">— Sea Freight, Full Container Load</span>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-1">LCL and Air will be available in a future update.</p>
            </div>
            <div>
              <FieldLabel required>Transaction Type</FieldLabel>
              <div className="flex gap-2">
                {(['IMPORT', 'EXPORT', 'DOMESTIC'] as const).map((t) => (
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
          </div>
        );

      case 2:
        return (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel required>Origin Port (UN Code)</FieldLabel>
                <Input value={originCode} onChange={(v) => setOriginCode(v.toUpperCase())} placeholder="e.g. CNSHA" />
              </div>
              <div>
                <FieldLabel required>Origin Port Name</FieldLabel>
                <Input value={originLabel} onChange={setOriginLabel} placeholder="e.g. Shanghai" />
              </div>
              <div>
                <FieldLabel required>Destination Port (UN Code)</FieldLabel>
                <Input value={destCode} onChange={(v) => setDestCode(v.toUpperCase())} placeholder="e.g. MYPKG" />
              </div>
              <div>
                <FieldLabel required>Destination Port Name</FieldLabel>
                <Input value={destLabel} onChange={setDestLabel} placeholder="e.g. Port Klang" />
              </div>
            </div>
            <div>
              <FieldLabel>Incoterm</FieldLabel>
              <Select value={incoterm} onChange={setIncoterm}>
                <option value="">— Select Incoterm —</option>
                {INCOTERMS.map((i) => <option key={i} value={i}>{i}</option>)}
              </Select>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-5">
            <div>
              <FieldLabel required>Customer Company</FieldLabel>
              <Select value={companyId} onChange={setCompanyId}>
                <option value="">— Select Company —</option>
                {companies.map((c) => (
                  <option key={c.company_id} value={c.company_id}>
                    {c.name} ({c.company_id})
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <FieldLabel required>Cargo Description</FieldLabel>
              <textarea
                value={cargoDesc}
                onChange={(e) => setCargoDesc(e.target.value)}
                placeholder="e.g. Electronic components, automotive parts"
                rows={3}
                className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--sky)] focus:border-transparent resize-none"
              />
            </div>
            <div>
              <FieldLabel>HS Code</FieldLabel>
              <Input value={cargoHsCode} onChange={setCargoHsCode} placeholder="e.g. 8471.30" />
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="dg-check"
                checked={cargoDg}
                onChange={(e) => setCargoDg(e.target.checked)}
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
        return (
          <div className="space-y-4">
            <p className="text-xs text-[var(--text-muted)]">Add the container types for this shipment. Container numbers and seal numbers are assigned later.</p>
            {containers.map((c, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-end border border-[var(--border)] rounded-lg p-3">
                <div className="col-span-4">
                  <FieldLabel required>Size</FieldLabel>
                  <Select value={c.container_size} onChange={(v) => updateContainer(i, 'container_size', v)}>
                    {CONTAINER_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </Select>
                </div>
                <div className="col-span-4">
                  <FieldLabel required>Type</FieldLabel>
                  <Select value={c.container_type} onChange={(v) => updateContainer(i, 'container_type', v)}>
                    {CONTAINER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </Select>
                </div>
                <div className="col-span-3">
                  <FieldLabel required>Qty</FieldLabel>
                  <input
                    type="number"
                    min={1}
                    value={c.quantity}
                    onChange={(e) => updateContainer(i, 'quantity', parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--sky)] focus:border-transparent"
                  />
                </div>
                <div className="col-span-1 flex justify-center pb-0.5">
                  {containers.length > 1 && (
                    <button onClick={() => removeContainer(i)} className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
                  )}
                </div>
              </div>
            ))}
            <button
              onClick={addContainer}
              className="w-full py-2 border border-dashed border-[var(--border)] rounded-lg text-sm text-[var(--sky)] hover:bg-[var(--sky-mist)] transition-colors"
            >
              + Add Container
            </button>
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <p className="text-xs text-[var(--text-muted)]">All parties are optional. Leave blank if unknown at this stage.</p>
            <PartySection title="Shipper" party={shipper} onChange={setShipper} />
            <PartySection title="Consignee" party={consignee} onChange={setConsignee} />
            <PartySection title="Notify Party" party={notifyParty} onChange={setNotifyParty} />
          </div>
        );

      case 6:
        return (
          <div className="space-y-5">
            <p className="text-xs text-[var(--text-muted)]">All dates are optional and can be updated later.</p>
            <div>
              <FieldLabel>Cargo Ready Date</FieldLabel>
              <input
                type="date"
                value={cargoReadyDate}
                onChange={(e) => setCargoReadyDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--sky)] focus:border-transparent"
              />
            </div>
            <div>
              <FieldLabel>ETD (Estimated Time of Departure)</FieldLabel>
              <input
                type="date"
                value={etd}
                onChange={(e) => setEtd(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--sky)] focus:border-transparent"
              />
            </div>
            <div>
              <FieldLabel>ETA (Estimated Time of Arrival)</FieldLabel>
              <input
                type="date"
                value={eta}
                onChange={(e) => setEta(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--sky)] focus:border-transparent"
              />
            </div>
          </div>
        );

      case 7:
        return (
          <div className="space-y-4 text-sm">
            <div className="bg-[var(--surface)] rounded-lg p-4 space-y-3">
              <ReviewRow label="Order Type" value="SEA FCL" />
              <ReviewRow label="Transaction" value={transactionType} />
              <ReviewRow label="Customer" value={selectedCompany ? `${selectedCompany.name} (${selectedCompany.company_id})` : companyId} />
              <ReviewRow label="Origin" value={`${originLabel} (${originCode})`} />
              <ReviewRow label="Destination" value={`${destLabel} (${destCode})`} />
              {incoterm && <ReviewRow label="Incoterm" value={incoterm} />}
            </div>
            <div className="bg-[var(--surface)] rounded-lg p-4 space-y-3">
              <ReviewRow label="Cargo" value={cargoDesc} />
              {cargoHsCode && <ReviewRow label="HS Code" value={cargoHsCode} />}
              {cargoDg && <ReviewRow label="DG" value="Yes — Dangerous Goods" />}
            </div>
            <div className="bg-[var(--surface)] rounded-lg p-4 space-y-2">
              <p className="text-xs font-semibold text-[var(--text-mid)] mb-2">Containers</p>
              {containers.map((c, i) => (
                <ReviewRow key={i} label={`Container ${i + 1}`} value={`${c.quantity} × ${c.container_size} ${c.container_type}`} />
              ))}
            </div>
            {(cargoReadyDate || etd || eta) && (
              <div className="bg-[var(--surface)] rounded-lg p-4 space-y-3">
                {cargoReadyDate && <ReviewRow label="Cargo Ready" value={cargoReadyDate} />}
                {etd && <ReviewRow label="ETD" value={etd} />}
                {eta && <ReviewRow label="ETA" value={eta} />}
              </div>
            )}
            <div className="bg-[var(--sky-pale)] border border-[var(--sky)] rounded-lg px-3 py-2 text-xs text-[var(--sky)]">
              The shipment will be created with status <strong>Draft</strong>. You can update parties, dates, and status after creation.
            </div>
          </div>
        );
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[var(--border)]">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text)]">New Shipment Order</h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Step {step} of {STEPS.length} — {STEPS[step - 1].label}</p>
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text)] text-xl leading-none">×</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <StepIndicator currentStep={step} />
          {renderStep()}
          {error && (
            <div className="mt-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border)]">
          <button
            onClick={step === 1 ? onClose : back}
            className="px-4 py-2 text-sm text-[var(--text-mid)] hover:text-[var(--text)] transition-colors"
          >
            {step === 1 ? 'Cancel' : '← Back'}
          </button>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[var(--text-muted)]">{step} / {STEPS.length}</span>
            {step < STEPS.length ? (
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
