'use client';

import type { OrderType, ContainerRow, PackageRow, Company, Port } from './_types';
import { ORDER_TYPES, PACKAGING_TYPES } from './_constants';

// ─── Props ───────────────────────────────────────────────────────────────────

interface StepReviewProps {
  orderType: OrderType;
  transactionType: string;
  incoterm: string;
  originCode: string;
  destCode: string;
  originTerminalId: string;
  destTerminalId: string;
  cargoDescription: string;
  cargoHsCode: string;
  cargoDgClass: string | null;
  cargoReadyDate: string;
  packageRows: PackageRow[];
  containerRows: ContainerRow[];
  companyId: string;
  selectedCompany: Company | null;
  ports: Port[];
  isTest?: boolean;
  onIsTestChange?: (v: boolean) => void;
  createAsConfirmed?: boolean;
  onCreateAsConfirmedChange?: (v: boolean) => void;
  accountType?: string | null;
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-[var(--text-muted)] flex-shrink-0">{label}</span>
      <span className="text-[var(--text)] font-medium text-right">{value}</span>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function StepReview({
  orderType,
  transactionType,
  incoterm,
  originCode,
  destCode,
  originTerminalId,
  destTerminalId,
  cargoDescription,
  cargoHsCode,
  cargoDgClass,
  cargoReadyDate,
  packageRows,
  containerRows,
  companyId,
  selectedCompany,
  ports,
  isTest,
  onIsTestChange,
  createAsConfirmed,
  onCreateAsConfirmedChange,
  accountType,
}: StepReviewProps) {
  const activePorts = orderType === 'AIR'
    ? ports.filter(p => p.port_type?.toLowerCase().includes('air') ?? false)
    : ports.filter(p => !(p.port_type?.toLowerCase().includes('air') ?? false));

  const originPort = activePorts.find(p => p.un_code === originCode);
  const destPort = activePorts.find(p => p.un_code === destCode);

  return (
    <div className="space-y-4 text-sm">
      <div className="bg-[var(--surface)] rounded-lg p-4 space-y-3">
        <ReviewRow label="Order Type" value={ORDER_TYPES.find(t => t.value === orderType)?.label ?? orderType} />
        <ReviewRow label="Transaction" value={transactionType} />
        <ReviewRow label="Customer" value={selectedCompany ? `${selectedCompany.name} (${selectedCompany.company_id})` : companyId} />
        {cargoReadyDate && (
          <ReviewRow
            label="Cargo Ready Date"
            value={(() => {
              const d = new Date(cargoReadyDate);
              return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            })()}
          />
        )}
      </div>
      <div className="bg-[var(--surface)] rounded-lg p-4 space-y-3">
        <ReviewRow label="Origin" value={`${originPort ? `${originPort.name} (${originPort.un_code})` : originCode}${originTerminalId ? ' · ' + (originPort?.terminals.find(t => t.terminal_id === originTerminalId)?.name ?? originTerminalId) : ''}`} />
        <ReviewRow label="Destination" value={`${destPort ? `${destPort.name} (${destPort.un_code})` : destCode}${destTerminalId ? ' · ' + (destPort?.terminals.find(t => t.terminal_id === destTerminalId)?.name ?? destTerminalId) : ''}`} />
        {incoterm && <ReviewRow label="Incoterm" value={incoterm} />}
      </div>
      {(cargoDescription || cargoHsCode || cargoDgClass) && (
        <div className="bg-[var(--surface)] rounded-lg p-4 space-y-3">
          {cargoDescription && <ReviewRow label="Cargo" value={cargoDescription} />}
          {cargoHsCode && <ReviewRow label="HS Code" value={cargoHsCode} />}
          {cargoDgClass ? (
            <ReviewRow label="DG" value={`Yes — ${cargoDgClass === 'DG-2' ? 'DG Class 2' : 'DG Class 3'}`} />
          ) : (
            <ReviewRow label="DG" value="Not DG" />
          )}
        </div>
      )}
      {orderType === 'SEA_FCL' ? (
        <div className="bg-[var(--surface)] rounded-lg p-4 space-y-2">
          <p className="text-xs font-semibold text-[var(--text-mid)] mb-2">Containers</p>
          {containerRows.map((c, i) => (
            <ReviewRow key={i} label={`Container ${i + 1}`} value={`${c.quantity} × ${c.container_size} ${c.container_type}`} />
          ))}
        </div>
      ) : (
        <div className="bg-[var(--surface)] rounded-lg p-4 space-y-2">
          <p className="text-xs font-semibold text-[var(--text-mid)] mb-2">Packages</p>
          {packageRows.map((p, i) => (
            <ReviewRow key={i} label={`Package ${i + 1}`} value={`${p.quantity} × ${PACKAGING_TYPES.find(pt => pt.value === p.packaging_type)?.label ?? p.packaging_type}${p.gross_weight_kg ? ` · ${p.gross_weight_kg} kg` : ''}${p.volume_cbm ? ` · ${p.volume_cbm} CBM` : ''}`} />
          ))}
        </div>
      )}
      {accountType === 'AFU' && (
        <div className="space-y-2">
          {onCreateAsConfirmedChange && (
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={createAsConfirmed ?? false}
                onChange={e => onCreateAsConfirmedChange(e.target.checked)}
                className="rounded border-[var(--border)]"
              />
              <span className="text-[var(--text-muted)]">Create as Confirmed</span>
            </label>
          )}
          {onIsTestChange && (
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isTest ?? false}
                onChange={e => onIsTestChange(e.target.checked)}
                className="rounded border-[var(--border)]"
              />
              <span className="text-[var(--text-muted)]">Test order</span>
            </label>
          )}
        </div>
      )}
      <div className={`border rounded-lg px-3 py-2 text-xs ${
        createAsConfirmed
          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
          : 'bg-[var(--sky-pale)] border-[var(--sky)] text-[var(--sky)]'
      }`}>
        The shipment will be created with status{' '}
        <strong>{createAsConfirmed ? 'Confirmed' : 'Draft'}</strong>.
      </div>
    </div>
  );
}
