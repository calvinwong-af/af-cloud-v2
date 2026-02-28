import { Ship, Plane } from 'lucide-react';
import { formatDate } from '@/lib/utils';

// ---------------------------------------------------------------------------
// PortPair — shared port-pair display for route cards and timeline
// ---------------------------------------------------------------------------

interface PortPairProps {
  origin: {
    port_un_code: string | null;
    terminal_id?: string | null;
    terminal_name?: string | null;
    port_name?: string | null;
    country_code?: string | null;
  };
  destination: {
    port_un_code: string | null;
    terminal_id?: string | null;
    terminal_name?: string | null;
    port_name?: string | null;
    country_code?: string | null;
  };
  viewContext: 'staff' | 'customer';
  etd?: string | null;
  eta?: string | null;
  incoterm?: string | null;
  orderType?: string;
  size?: 'lg' | 'sm';
  vesselName?: string | null;
  voyageNumber?: string | null;
}

export default function PortPair({
  origin,
  destination,
  viewContext,
  etd,
  eta,
  incoterm,
  orderType,
  size = 'lg',
  vesselName,
  voyageNumber,
}: PortPairProps) {
  const originLabel = viewContext === 'staff' ? 'POL' : 'Origin';
  const destLabel = viewContext === 'staff' ? 'POD' : 'Destination';

  const originCode = origin.port_un_code || '—';
  const destCode = destination.port_un_code || '—';

  const isAir = orderType === 'AIR';
  const isLg = size === 'lg';

  const codeCls = isLg
    ? 'text-2xl font-bold font-mono text-[var(--text)] tracking-wide'
    : 'text-xs font-bold font-mono text-[var(--text)]';

  const labelCls = isLg
    ? 'text-xs text-[var(--text-muted)] mb-1'
    : 'text-[9px] text-[var(--text-muted)] mb-0.5';

  const dateLabelCls = isLg
    ? 'text-[10px] text-[var(--text-muted)]'
    : 'text-[9px] text-[var(--text-muted)]';

  const dateValueCls = isLg
    ? 'text-xs text-[var(--text-mid)] font-medium'
    : 'text-[10px] text-[var(--text-mid)]';

  const iconSize = isLg ? 'w-4 h-4' : 'w-3 h-3';
  const iconPad = isLg ? 'p-2' : 'p-1';
  const lineW = isLg ? 'w-12' : 'w-6';

  return (
    <div>
      <div className="flex items-center">
        {/* Origin side */}
        <div className="flex-1 min-w-0">
          <div className={labelCls}>{originLabel}</div>
          <div
            className={`${codeCls} ${origin.port_name && origin.port_name !== originCode ? 'cursor-help' : ''}`}
            title={origin.port_name && origin.port_name !== originCode ? origin.port_name : undefined}
          >
            {originCode}
          </div>
          {origin.terminal_id && (
            <div className={isLg ? 'text-[10px] text-[var(--text-muted)]' : 'text-[9px] text-[var(--text-muted)]'}>
              {origin.terminal_name ?? origin.terminal_id}
            </div>
          )}
          {etd && (
            <div className={`mt-1`}>
              <span className={dateLabelCls}>ETD </span>
              <span className={dateValueCls}>{formatDate(etd)}</span>
            </div>
          )}
          {!etd && isLg && (
            <div className="mt-1">
              <span className={dateLabelCls}>ETD </span>
              <span className={`${dateLabelCls}`}>—</span>
            </div>
          )}
        </div>

        {/* Connecting line + icon */}
        <div className="flex items-center flex-shrink-0 mx-4">
          <div className={`h-px ${lineW} bg-[var(--border)]`} />
          <div className={`${iconPad} rounded-full bg-[var(--sky-pale)] mx-2`}>
            {isAir
              ? <Plane className={`${iconSize} text-[var(--sky)]`} />
              : <Ship className={`${iconSize} text-[var(--sky)]`} />}
          </div>
          <div className={`h-px ${lineW} bg-[var(--border)]`} />
        </div>

        {/* Destination side */}
        <div className="flex-1 min-w-0 text-right">
          <div className={labelCls}>{destLabel}</div>
          <div
            className={`${codeCls} ${destination.port_name && destination.port_name !== destCode ? 'cursor-help' : ''}`}
            title={destination.port_name && destination.port_name !== destCode ? destination.port_name : undefined}
          >
            {destCode}
          </div>
          {destination.terminal_id && (
            <div className={isLg ? 'text-[10px] text-[var(--text-muted)]' : 'text-[9px] text-[var(--text-muted)]'}>
              {destination.terminal_name ?? destination.terminal_id}
            </div>
          )}
          {eta && (
            <div className={`mt-1`}>
              <span className={dateLabelCls}>ETA </span>
              <span className={dateValueCls}>{formatDate(eta)}</span>
            </div>
          )}
          {!eta && isLg && (
            <div className="mt-1">
              <span className={dateLabelCls}>ETA </span>
              <span className={`${dateLabelCls}`}>—</span>
            </div>
          )}
        </div>
      </div>

      {/* Vessel row — between port pair and incoterm */}
      {isLg && (vesselName || voyageNumber) && (
        <div className="mt-2 flex items-center justify-center gap-1.5 text-xs text-[var(--text-muted)]">
          <Ship className="w-3.5 h-3.5" />
          {vesselName && <span className="font-medium">{vesselName}</span>}
          {vesselName && voyageNumber && <span>·</span>}
          {voyageNumber && <span className="font-mono">{voyageNumber}</span>}
        </div>
      )}

      {/* Incoterm pill */}
      {incoterm && (
        <div className={`${isLg ? 'mt-4 pt-4' : 'mt-2 pt-2'} border-t border-[var(--border)] flex items-center gap-2`}>
          <span className="text-xs text-[var(--text-muted)]">Incoterm</span>
          <span className="px-2 py-0.5 bg-[var(--surface)] border border-[var(--border)] rounded text-xs font-mono font-semibold text-[var(--text-mid)]">
            {incoterm}
          </span>
        </div>
      )}
    </div>
  );
}
