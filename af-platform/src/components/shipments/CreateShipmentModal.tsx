'use client';

import { useState, useEffect, useCallback } from 'react';
import { createShipmentOrderAction, CreateShipmentOrderPayload, createShipmentFromBLAction, type CreateFromBLPayload } from '@/app/actions/shipments-write';
import BLUploadTab, { type BLFormState, getDefaultBLFormState } from './BLUploadTab';
import { StepOrder } from './_create-shipment/StepOrder';
import { StepRoute } from './_create-shipment/StepRoute';
import { StepCargo } from './_create-shipment/StepCargo';
import { StepContainers } from './_create-shipment/StepContainers';
import { StepReview } from './_create-shipment/StepReview';
import type { OrderType, ContainerRow, PackageRow, Company, Port } from './_create-shipment/_types';
import { BASE_STEPS } from './_create-shipment/_constants';

// ─── Port filtering ───────────────────────────────────────────────────────────

function isAirport(port: Port): boolean {
  // Matches port_type values like 'AIR', 'airport', 'AIRPORT', 'air_port' etc.
  return port.port_type?.toLowerCase().includes('air') ?? false;
}

function getSeaPorts(ports: Port[]): Port[] {
  return ports.filter(p => !isAirport(p));
}

function getAirports(ports: Port[]): Port[] {
  return ports.filter(p => isAirport(p));
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center gap-1 mb-6">
      {BASE_STEPS.map((step, i) => (
        <div key={step.id} className="flex items-center gap-1">
          <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold transition-colors ${
            step.id < currentStep ? 'bg-[var(--sky)] text-white'
              : step.id === currentStep ? 'bg-[var(--slate)] text-white'
              : 'bg-[var(--border)] text-[var(--text-muted)]'
          }`}>
            {step.id < currentStep ? '✓' : step.id}
          </div>
          <span className={`text-xs hidden sm:inline ${step.id === currentStep ? 'text-[var(--text)] font-medium' : 'text-[var(--text-muted)]'}`}>
            {step.label}
          </span>
          {i < BASE_STEPS.length - 1 && <div className="w-4 h-px bg-[var(--border)] mx-1" />}
        </div>
      ))}
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  companies: Company[];
  ports: Port[];
  onClose: () => void;
  onCreated: (shipmentOrderId: string) => void;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CreateShipmentModal({ companies, ports, onClose, onCreated }: Props) {
  const [activeTab, setActiveTab] = useState<'manual' | 'bl'>('manual');

  // ── BL Upload state ──
  const [blParsedResult, setBLParsedResult] = useState<Record<string, unknown> | null>(null);
  const [blFormState, setBLFormState] = useState<BLFormState>(getDefaultBLFormState());
  const [blConfirmReady, setBLConfirmReady] = useState(false);
  const [blSubmitting, setBLSubmitting] = useState(false);
  const [blError, setBLError] = useState<string | null>(null);

  const handleBLConfirmCreate = useCallback(async () => {
    if (!blParsedResult || !blConfirmReady) return;
    setBLSubmitting(true);
    setBLError(null);

    const parsed = (blParsedResult as Record<string, unknown>).parsed as Record<string, unknown> | undefined;

    try {
      const originPort = ports.find(p => p.un_code === blFormState.originCode);
      const destPort = ports.find(p => p.un_code === blFormState.destCode);

      // BC docs should never get 4001+ status — override to 3002 (Booking Confirmed)
      const docType = (blParsedResult as Record<string, unknown>).doc_type as string | undefined;
      const isBookingConfirmation = docType === 'BOOKING_CONFIRMATION';
      const isAWB = docType === 'AWB';
      const rawStatus = (blParsedResult as Record<string, unknown>).initial_status as number ?? 3001;
      const effectiveStatus = (rawStatus >= 4001 && isBookingConfirmation) ? 3002 : rawStatus;

      // For AWB, use flightDate as etd and mawbNumber as waybill_number
      const resolvedEtd = isAWB ? (blFormState.flightDate || null) : (blFormState.etd || null);
      const resolvedWaybill = isAWB ? (blFormState.mawbNumber || blFormState.waybillNumber || null) : (blFormState.waybillNumber || null);

      const payload: CreateFromBLPayload = {
        order_type: blFormState.orderType || (blParsedResult as Record<string, unknown>).order_type as string || 'SEA_FCL',
        transaction_type: blFormState.transactionType || 'IMPORT',
        incoterm_code: blFormState.incotermCode || 'CNF',
        company_id: blFormState.linkedCompanyId,
        origin_port_un_code: blFormState.originCode || null,
        origin_terminal_id: blFormState.originTerminalId || null,
        origin_label: originPort?.name ?? (blFormState.originCode || null),
        destination_port_un_code: blFormState.destCode || null,
        destination_terminal_id: blFormState.destTerminalId || null,
        destination_label: destPort?.name ?? (blFormState.destCode || null),
        cargo_description: blFormState.cargoDescription || null,
        cargo_weight_kg: blFormState.cargoWeight ? parseFloat(blFormState.cargoWeight) : null,
        etd: resolvedEtd,
        initial_status: effectiveStatus,
        carrier: blFormState.carrier || null,
        waybill_number: resolvedWaybill,
        vessel_name: isAWB ? null : (blFormState.vesselName || null),
        voyage_number: isAWB ? null : (blFormState.voyageNumber || null),
        shipper_name: blFormState.shipperName || null,
        shipper_address: blFormState.shipperAddress || null,
        consignee_name: blFormState.consigneeName || null,
        consignee_address: blFormState.consigneeAddress || null,
        notify_party_name: blFormState.notifyPartyName || null,
        containers: isAWB ? null : ((parsed?.containers as CreateFromBLPayload['containers']) ?? null),
        customer_reference: blFormState.customerReference || null,
        // AWB-specific
        mawb_number: isAWB ? (blFormState.mawbNumber || null) : null,
        hawb_number: isAWB ? (blFormState.hawbNumber || null) : null,
        awb_type: isAWB ? (blFormState.awbType || null) : null,
        flight_number: isAWB ? (blFormState.flightNumber || null) : null,
        flight_date: isAWB ? (blFormState.flightDate || null) : null,
        pieces: isAWB && blFormState.pieces ? parseInt(blFormState.pieces, 10) : null,
        chargeable_weight_kg: isAWB && blFormState.chargeableWeightKg ? parseFloat(blFormState.chargeableWeightKg) : null,
      };

      const result = await createShipmentFromBLAction(payload);
      setBLSubmitting(false);

      if (!result) {
        setBLError('No response from server');
        return;
      }
      if (!result.success) {
        setBLError(result.error ?? 'Failed to create shipment');
        return;
      }

      onCreated(result.shipment_id);
    } catch (err) {
      console.error('[CreateShipmentModal] BL create error:', err);
      setBLSubmitting(false);
      setBLError('Failed to create shipment');
    }
  }, [blParsedResult, blConfirmReady, blFormState, ports, onCreated]);

  // ── Manual Entry state ──
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Order
  const [orderType, setOrderType] = useState<OrderType>('SEA_FCL');
  const [transactionType, setTransactionType] = useState<'IMPORT' | 'EXPORT'>('IMPORT');
  const [companyId, setCompanyId] = useState('');
  const [cargoReadyDate, setCargoReadyDate] = useState<string>(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  });

  // Step 2: Route
  const [originCode, setOriginCode] = useState('');
  const [destCode, setDestCode] = useState('');
  const [originTerminalId, setOriginTerminalId] = useState('');
  const [destTerminalId, setDestTerminalId] = useState('');
  const [incoterm, setIncoterm] = useState('');

  // Step 3: Cargo
  const [cargoDesc, setCargoDesc] = useState('');
  const [cargoHsCode, setCargoHsCode] = useState('');
  const [cargoDg, setCargoDg] = useState(false);

  // Step 4: Containers (SEA_FCL)
  const [containers, setContainers] = useState<ContainerRow[]>([
    { container_size: '20GP', container_type: 'DRY', quantity: 1 },
  ]);

  // Step 4: Packages (SEA_LCL / AIR)
  const [packages, setPackages] = useState<PackageRow[]>([
    { packaging_type: 'CARTON', quantity: 1, gross_weight_kg: null, volume_cbm: null },
  ]);

  // ── Derived data ──
  const seaPorts = getSeaPorts(ports);
  const airports = getAirports(ports);
  const activePorts = orderType === 'AIR' ? airports : seaPorts;

  const originPort = activePorts.find(p => p.un_code === originCode);
  const destPort = activePorts.find(p => p.un_code === destCode);
  const selectedCompany = companies.find(c => c.company_id === companyId) ?? null;

  // Reset route and cargo state when order type changes
  useEffect(() => {
    setOriginCode('');
    setDestCode('');
    setOriginTerminalId('');
    setDestTerminalId('');
    setContainers([{ container_size: '20GP', container_type: 'DRY', quantity: 1 }]);
    setPackages([{ packaging_type: 'CARTON', quantity: 1, gross_weight_kg: null, volume_cbm: null }]);
  }, [orderType]);

  // Auto-select default terminal when port changes
  useEffect(() => {
    const port = activePorts.find(p => p.un_code === originCode);
    if (port?.has_terminals) {
      const def = port.terminals.find(t => t.is_default);
      setOriginTerminalId(def?.terminal_id ?? '');
    } else {
      setOriginTerminalId('');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originCode, orderType]);

  useEffect(() => {
    const port = activePorts.find(p => p.un_code === destCode);
    if (port?.has_terminals) {
      const def = port.terminals.find(t => t.is_default);
      setDestTerminalId(def?.terminal_id ?? '');
    } else {
      setDestTerminalId('');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destCode, orderType]);

  // ── Validation ──
  function validateStep(): string | null {
    if (step === 1) {
      if (!companyId) return 'Customer company is required';
    }
    if (step === 2) {
      if (!originCode) return 'Origin port is required';
      if (!destCode) return 'Destination port is required';
      if (originCode === destCode) return 'Origin and destination cannot be the same port';
      if (!incoterm) return 'Incoterm is required';
    }
    if (step === 4) {
      if (orderType === 'SEA_FCL') {
        if (containers.length === 0) return 'At least one container is required';
        for (const c of containers) {
          if (!c.container_size || !c.container_type) return 'All container fields are required';
          if (!c.quantity || c.quantity < 1) return 'Container quantity must be at least 1';
        }
      } else {
        if (packages.length === 0) return 'At least one package is required';
        for (const p of packages) {
          if (!p.quantity || p.quantity < 1) return 'Package quantity must be at least 1';
        }
      }
    }
    return null;
  }

  function next() {
    const err = validateStep();
    if (err) { setError(err); return; }
    setError(null);
    setStep(s => s + 1);
  }
  function back() { setError(null); setStep(s => s - 1); }

  // ── Submit ──
  async function handleSubmit() {
    setSubmitting(true);
    setError(null);

    const payload: CreateShipmentOrderPayload = {
      order_type: orderType,
      transaction_type: transactionType,
      company_id: companyId,
      origin_port_un_code: originCode,
      origin_terminal_id: originTerminalId || null,
      origin_label: originPort?.name || originCode,
      destination_port_un_code: destCode,
      destination_terminal_id: destTerminalId || null,
      destination_label: destPort?.name || destCode,
      incoterm_code: incoterm || null,
      cargo_description: cargoDesc.trim() || '',
      cargo_hs_code: cargoHsCode.trim() || null,
      cargo_is_dg: cargoDg,
      containers: orderType === 'SEA_FCL' ? containers.map(c => ({
        container_size: c.container_size,
        container_type: c.container_type,
        quantity: Number(c.quantity),
      })) : [],
      packages: orderType !== 'SEA_FCL' ? packages.map(p => ({
        packaging_type: p.packaging_type,
        quantity: Number(p.quantity),
        gross_weight_kg: p.gross_weight_kg,
        volume_cbm: p.volume_cbm,
      })) : [],
      shipper: null,
      consignee: null,
      notify_party: null,
      cargo_ready_date: cargoReadyDate || null,
      etd: null,
      eta: null,
    };

    const result = await createShipmentOrderAction(payload);
    setSubmitting(false);

    if (!result.success) {
      setError(result.error ?? 'Failed to create shipment order');
      return;
    }

    onCreated(result.shipment_id);
  }

  // ── Step content ──
  function renderStep() {
    switch (step) {
      case 1:
        return (
          <StepOrder
            orderType={orderType}
            setOrderType={setOrderType}
            transactionType={transactionType}
            setTransactionType={setTransactionType}
            companyId={companyId}
            setCompanyId={setCompanyId}
            cargoReadyDate={cargoReadyDate}
            setCargoReadyDate={setCargoReadyDate}
            companies={companies}
          />
        );

      case 2:
        return (
          <StepRoute
            originCode={originCode}
            setOriginCode={setOriginCode}
            destCode={destCode}
            setDestCode={setDestCode}
            originTerminalId={originTerminalId}
            setOriginTerminalId={setOriginTerminalId}
            destTerminalId={destTerminalId}
            setDestTerminalId={setDestTerminalId}
            incoterm={incoterm}
            setIncoterm={setIncoterm}
            ports={ports}
            orderType={orderType}
          />
        );

      case 3:
        return (
          <StepCargo
            cargoDescription={cargoDesc}
            setCargoDescription={setCargoDesc}
            cargoHsCode={cargoHsCode}
            setCargoHsCode={setCargoHsCode}
            cargoDg={cargoDg}
            setCargoDg={setCargoDg}
            packageRows={packages}
            setPackageRows={setPackages}
            orderType={orderType}
          />
        );

      case 4:
        if (orderType === 'SEA_FCL') {
          return (
            <StepContainers
              containerRows={containers}
              setContainerRows={setContainers}
            />
          );
        }
        // For SEA_LCL / AIR — show package rows (packages only mode)
        return (
          <StepCargo
            cargoDescription={cargoDesc}
            setCargoDescription={setCargoDesc}
            cargoHsCode={cargoHsCode}
            setCargoHsCode={setCargoHsCode}
            cargoDg={cargoDg}
            setCargoDg={setCargoDg}
            packageRows={packages}
            setPackageRows={setPackages}
            orderType={orderType}
            packagesOnly
          />
        );

      case 5:
        return (
          <StepReview
            orderType={orderType}
            transactionType={transactionType}
            incoterm={incoterm}
            originCode={originCode}
            destCode={destCode}
            originTerminalId={originTerminalId}
            destTerminalId={destTerminalId}
            cargoDescription={cargoDesc}
            cargoHsCode={cargoHsCode}
            cargoDg={cargoDg}
            cargoReadyDate={cargoReadyDate}
            packageRows={packages}
            containerRows={containers}
            companyId={companyId}
            selectedCompany={selectedCompany}
            ports={ports}
          />
        );
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header with tabs */}
        <div className="px-6 pt-6 pb-0 border-b border-[var(--border)]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[var(--text)]">New Shipment Order</h2>
            <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text)] text-xl leading-none">×</button>
          </div>
          <div className="flex gap-0">
            <button
              onClick={() => setActiveTab('manual')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'manual'
                  ? 'text-[var(--text)] border-[var(--sky)]'
                  : 'text-[var(--text-muted)] border-transparent hover:text-[var(--text)] hover:border-[var(--border)]'
              }`}
            >
              Manual Entry
            </button>
            <button
              onClick={() => setActiveTab('bl')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'bl'
                  ? 'text-[var(--text)] border-[var(--sky)]'
                  : 'text-[var(--text-muted)] border-transparent hover:text-[var(--text)] hover:border-[var(--border)]'
              }`}
            >
              Upload Document
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {activeTab === 'manual' ? (
            <>
              <p className="text-xs text-[var(--text-muted)] mb-3">Step {step} of {BASE_STEPS.length} — {step === 4 ? (orderType === 'SEA_FCL' ? 'Containers' : 'Packages') : BASE_STEPS[step - 1]?.label}</p>
              <StepIndicator currentStep={step} />
              {renderStep()}
              {error && (
                <div className="mt-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
                  {error}
                </div>
              )}
            </>
          ) : (
            <>
              <BLUploadTab
                ports={ports}
                companies={companies}
                onParsed={(result) => setBLParsedResult(result as unknown as Record<string, unknown>)}
                parsedResult={blParsedResult as never}
                onConfirmReady={setBLConfirmReady}
                formState={blFormState}
                onFormChange={setBLFormState}
              />
              {blError && (
                <div className="mt-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
                  {blError}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border)]">
          {activeTab === 'manual' ? (
            <>
              <button
                onClick={step === 1 ? onClose : back}
                className="px-4 py-2 text-sm text-[var(--text-mid)] hover:text-[var(--text)] transition-colors"
              >
                {step === 1 ? 'Cancel' : '← Back'}
              </button>
              <div className="flex items-center gap-3">
                <span className="text-xs text-[var(--text-muted)]">{step} / {BASE_STEPS.length}</span>
                {step < BASE_STEPS.length ? (
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
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-[var(--text-mid)] hover:text-[var(--text)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBLConfirmCreate}
                disabled={!blParsedResult || !blConfirmReady || blSubmitting}
                className="px-5 py-2 bg-[var(--sky)] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {blSubmitting ? 'Creating…' : 'Confirm & Create'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
