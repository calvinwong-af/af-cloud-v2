'use client';

// ---------------------------------------------------------------------------
// Toggle Switch (kept here — used by multiple modules)
// ---------------------------------------------------------------------------

export function ToggleSwitch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 shrink-0"
    >
      <div className={`w-8 h-4 rounded-full transition-colors relative ${checked ? 'bg-[var(--sky)]' : 'bg-[var(--border)]'}`}>
        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </div>
      <span className="text-xs text-[var(--text-muted)]">{label}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Re-exports for backward compatibility
// ---------------------------------------------------------------------------

export { PricingDashboard } from './_dashboard';
export { FCLRateCardsTab, LCLRateCardsTab } from './_rate-cards-tab';
