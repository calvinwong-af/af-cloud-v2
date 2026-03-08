'use client';

import { useMemo } from 'react';
import type { MonthBucket } from './_types';
import type { RateCard } from '@/app/actions/pricing';

export function useMonthBuckets(historicalCount: number): MonthBucket[] {
  return useMemo(() => {
    const result: MonthBucket[] = [];
    const now = new Date();
    for (let i = -historicalCount; i <= 2; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const yy = String(d.getFullYear()).slice(2);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const month_key = `${d.getFullYear()}-${mm}`;
      result.push({
        month_key,
        label: `${yy}-${mm}`,
        isCurrentMonth: i === 0,
      });
    }
    return result;
  }, [historicalCount]);
}

export function formatCompact(n: number | null): string {
  if (n == null) return '\u2014';
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export function formatDate(d: string | null): string {
  if (!d) return '\u2014';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '\u2014';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export type AlertLevel = 'cost_exceeds_price' | 'no_list_price' | 'price_review_needed' | null;

export function getAlertLevel(
  timeSeries: RateCard['time_series'],
  latestCostFrom?: string | null,
  latestListPriceFrom?: string | null,
): AlertLevel {
  if (!timeSeries) return null;
  const today = new Date();
  const currentKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const bucket = timeSeries.find(b => b.month_key === currentKey);
  if (!bucket) return null;

  const cost = bucket.cost ?? null;
  const list = bucket.list_price ?? null;
  const costTotal = cost != null
    ? cost + (bucket.cost_surcharge_total ?? bucket.surcharge_total ?? 0)
    : null;
  const listTotal = list != null
    ? list + (bucket.list_surcharge_total ?? bucket.surcharge_total ?? 0)
    : null;

  if (costTotal != null && listTotal != null && costTotal > listTotal) return 'cost_exceeds_price';
  if (costTotal != null && listTotal == null) return 'no_list_price';

  // Scenario 3: cost updated more recently than list price
  if (
    latestCostFrom != null &&
    latestListPriceFrom != null &&
    latestCostFrom > latestListPriceFrom
  ) return 'price_review_needed';

  return null;
}

export function getDGChipStyle(dgCode: string): string {
  const code = (dgCode ?? '').toUpperCase();
  if (code === 'GEN' || code === 'GENERAL' || code === 'NDG') return 'bg-slate-100 text-slate-600';
  if (code.includes('2')) return 'bg-blue-50 text-blue-700';
  if (code.includes('3')) return 'bg-orange-50 text-orange-700';
  if (code.includes('4')) return 'bg-yellow-50 text-yellow-700';
  if (code.includes('5')) return 'bg-amber-50 text-amber-700';
  if (code.includes('6')) return 'bg-purple-50 text-purple-700';
  if (code.includes('7')) return 'bg-pink-50 text-pink-700';
  if (code.includes('8')) return 'bg-red-50 text-red-700';
  if (code.includes('9')) return 'bg-gray-100 text-gray-600';
  return 'bg-slate-100 text-slate-600';
}
