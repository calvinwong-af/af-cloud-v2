'use client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BLFormState = Record<string, unknown>;

interface Port {
  un_code: string;
  name: string;
  country: string;
  port_type: string;
  has_terminals: boolean;
  terminals: Array<{ terminal_id: string; name: string; is_default: boolean }>;
}

export interface BLReviewProps {
  formState: BLFormState;
  setFormState: (s: BLFormState) => void;
  ports: Port[];
  isApplying: boolean;
  applyError: string | null;
  onConfirm: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderField(label: string, value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const display = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return (
    <div key={label} className="flex items-start gap-3 py-1.5">
      <span className="text-xs text-[var(--text-secondary)] w-40 shrink-0">{label}</span>
      <span className="text-xs text-[var(--text-primary)] break-all">{display}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BLReview component
// ---------------------------------------------------------------------------

export function BLReview({
  formState,
}: BLReviewProps) {
  return (
    <>
      {/* BL / BC — existing flat field view */}
      <div className="border border-[var(--border)] rounded-lg p-4 divide-y divide-[var(--border)]">
        {Object.entries(formState).map(([key, value]) => {
          if (key === 'containers' || key === 'cargo_items') return null;
          const label = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
          return renderField(label, value);
        })}
      </div>

      {/* Containers table */}
      {Array.isArray(formState.containers) && (formState.containers as unknown[]).length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-[var(--text-primary)] mb-2">Containers</h3>
          <div className="border border-[var(--border)] rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-[var(--surface)]">
                <tr>
                  {Object.keys((formState.containers as Record<string, unknown>[])[0]).map((k) => (
                    <th key={k} className="px-3 py-2 text-left font-medium text-[var(--text-secondary)]">
                      {k.replace(/_/g, ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(formState.containers as Record<string, unknown>[]).map((c, i) => (
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
      {Array.isArray(formState.cargo_items) && (formState.cargo_items as unknown[]).length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-[var(--text-primary)] mb-2">Cargo Items</h3>
          <div className="border border-[var(--border)] rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-[var(--surface)]">
                <tr>
                  {Object.keys((formState.cargo_items as Record<string, unknown>[])[0]).map((k) => (
                    <th key={k} className="px-3 py-2 text-left font-medium text-[var(--text-secondary)]">
                      {k.replace(/_/g, ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(formState.cargo_items as Record<string, unknown>[]).map((c, i) => (
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
  );
}
