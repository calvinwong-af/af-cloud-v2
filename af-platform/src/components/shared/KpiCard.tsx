/**
 * KpiCard — reusable KPI metric card for dashboard and module list pages
 */

'use client';

import type { ReactNode } from 'react';

type CardColor = 'default' | 'green' | 'sky' | 'purple' | 'amber' | 'red';

const COLOR_MAP: Record<CardColor, { icon: string; value: string }> = {
  default: { icon: 'text-[var(--text-mid)] bg-[var(--surface)]', value: 'text-[var(--text)]' },
  green:   { icon: 'text-emerald-600 bg-emerald-50',             value: 'text-emerald-700' },
  sky:     { icon: 'text-sky-600 bg-sky-50',                     value: 'text-sky-700' },
  purple:  { icon: 'text-purple-600 bg-purple-50',               value: 'text-purple-700' },
  amber:   { icon: 'text-amber-600 bg-amber-50',                 value: 'text-amber-700' },
  red:     { icon: 'text-red-600 bg-red-50',                     value: 'text-red-700' },
};

interface KpiCardProps {
  icon: ReactNode;
  label: string;
  value: number | string;
  sublabel?: string;
  color?: CardColor;
  loading?: boolean;
}

export function KpiCard({ icon, label, value, sublabel, color = 'default', loading }: KpiCardProps) {
  const colors = COLOR_MAP[color];

  return (
    <div className="bg-white rounded-xl border border-[var(--border)] p-4">
      <div className="flex items-start justify-between">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colors.icon}`}>
          {icon}
        </div>
      </div>

      <div className="mt-3">
        {loading ? (
          <>
            <div className="h-7 w-16 bg-gray-100 rounded animate-pulse mb-1" />
            <div className="h-3.5 w-24 bg-gray-100 rounded animate-pulse" />
          </>
        ) : (
          <>
            <div className={`text-2xl font-bold tabular-nums ${colors.value}`}>
              {typeof value === 'number' ? value.toLocaleString() : value}
            </div>
            <div className="text-xs text-[var(--text-muted)] mt-0.5">{label}</div>
            {sublabel && (
              <div className="text-xs text-[var(--text-muted)] opacity-70">{sublabel}</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
