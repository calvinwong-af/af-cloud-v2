'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Ship, Package, Plane, Truck, Car, Lock, Warehouse, ClipboardList, FlaskConical,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  fetchPricingCountriesAction,
  fetchPricingDashboardSummaryAction,
} from '@/app/actions/pricing';
import type { PricingCountry, DashboardSummary } from '@/app/actions/pricing';
import { PortCombobox } from '@/components/shared/PortCombobox';
import { formatDate } from './_helpers';

interface PricingComponent {
  key: string;
  label: string;
  icon: LucideIcon;
  href: string;
  locked: boolean;
}

const PRICING_COMPONENTS: PricingComponent[] = [
  { key: 'fcl',            label: 'FCL Ocean Freight',   icon: Ship,      href: '/pricing/fcl',              locked: false },
  { key: 'lcl',            label: 'LCL Ocean Freight',   icon: Package,   href: '/pricing/lcl',              locked: false },
  { key: 'air',            label: 'Air Freight',          icon: Plane,     href: '/pricing/air',              locked: false },
  { key: 'local-charges',  label: 'Local Charges',          icon: Warehouse,     href: '/pricing/local-charges',    locked: false },
  { key: 'customs',        label: 'Customs Clearance',    icon: ClipboardList, href: '/pricing/customs',          locked: false },
  { key: 'haulage',        label: 'Haulage',              icon: Truck,     href: '/pricing/haulage',          locked: false },
  { key: 'port-transport',   label: 'Transportation',     icon: Car,          href: '/pricing/transportation',   locked: false },
  { key: 'dg-class-charges', label: 'DG Class Charges',   icon: FlaskConical, href: '/pricing/dg-class-charges', locked: false },
];

export function PricingDashboard() {
  const [countries, setCountries] = useState<PricingCountry[]>([]);
  const [country, setCountry] = useState('MY');
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPricingCountriesAction().then(r => {
      if (r?.success) setCountries(r.data);
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchPricingDashboardSummaryAction(country || undefined).then(r => {
      if (r?.success) setSummary(r.data);
      setLoading(false);
    });
  }, [country]);

  const countryOptions = [
    { value: '', label: 'All Countries' },
    ...countries.filter(c => c.country_code && c.country_name).map(c => ({ value: c.country_code, label: `${c.country_code} — ${c.country_name}` })),
  ];

  return (
    <div className="space-y-6">
      {/* Country filter */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-[var(--text-muted)]">Country</span>
        <div className="w-64">
          <PortCombobox
            value={country}
            onChange={setCountry}
            options={countryOptions}
            placeholder="All Countries"
          />
        </div>
      </div>

      {/* Card grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {PRICING_COMPONENTS.map(comp => {
          if (comp.locked) {
            return <LockedCard key={comp.key} comp={comp} />;
          }
          const stats = summary?.[comp.key as keyof DashboardSummary] ?? null;
          if (stats !== null) {
            return (
              <ActiveCard
                key={comp.key}
                comp={comp}
                stats={stats}
                loading={loading}
                country={country}
              />
            );
          }
          return <SimpleCard key={comp.key} comp={comp} country={country} />;
        })}
      </div>
    </div>
  );
}

function ActiveCard({
  comp,
  stats,
  loading,
  country,
}: {
  comp: PricingComponent;
  stats: {
    total_cards: number;
    last_updated: string | null;
    expiring_soon: number;
    cost_exceeds_price: number;
    no_active_cost: number;
    no_list_price: number;
    price_review_needed: number;
  } | null;
  loading: boolean;
  country: string;
}) {
  const Icon = comp.icon;
  const href = country ? `${comp.href}?country=${country}` : comp.href;

  return (
    <Link
      href={href}
      className="bg-white rounded-xl border border-[var(--border)] p-5 hover:border-[var(--sky)]/30 hover:shadow-sm transition-all"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[var(--sky-mist)] flex items-center justify-center">
            <Icon size={16} className="text-[var(--sky)]" />
          </div>
          <span className="text-sm font-semibold text-[var(--text)]">{comp.label}</span>
        </div>
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">Live</span>
      </div>

      {/* Stats */}
      {loading || !stats ? (
        <div className="space-y-3">
          <div className="h-8 w-20 bg-[var(--surface)] rounded animate-pulse" />
          <div className="h-4 w-32 bg-[var(--surface)] rounded animate-pulse" />
          <div className="h-4 w-28 bg-[var(--surface)] rounded animate-pulse" />
        </div>
      ) : (
        <div className="space-y-2">
          <div>
            <span className="text-2xl font-bold text-[var(--text)]">{stats.total_cards}</span>
            <span className="text-xs text-[var(--text-muted)] ml-1.5">Rate Cards</span>
          </div>
          <div className="text-xs text-[var(--text-muted)]">
            Last Updated: {formatDate(stats.last_updated)}
          </div>
          {(() => {
            const expiringSoon = stats.expiring_soon ?? 0;
            return expiringSoon > 0 ? (
              <div className="text-xs font-medium px-2 py-1 rounded-md bg-amber-50 text-amber-600 inline-block">
                {expiringSoon} card{expiringSoon !== 1 ? 's' : ''} need attention
              </div>
            ) : (
              <div className="text-xs font-medium px-2 py-1 rounded-md bg-emerald-50 text-emerald-600 inline-block">
                Up to date
              </div>
            );
          })()}
          {(stats.cost_exceeds_price > 0 || stats.no_active_cost > 0 || stats.no_list_price > 0 || stats.price_review_needed > 0) && (
            <div className="mt-2 pt-2 border-t border-[var(--border)] space-y-1">
              {stats.cost_exceeds_price > 0 && (
                <Link
                  href={`${comp.href}?country=${country}&alerts=cost_exceeds_price`}
                  onClick={e => e.stopPropagation()}
                  className="text-[11px] font-medium text-red-600 flex items-center gap-1.5 hover:text-red-800 hover:underline"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                  {stats.cost_exceeds_price} cost{stats.cost_exceeds_price > 1 ? 's exceed' : ' exceeds'} price
                </Link>
              )}
              {stats.no_active_cost > 0 && (
                <Link
                  href={`${comp.href}?country=${country}&alerts=no_active_cost`}
                  onClick={e => e.stopPropagation()}
                  className="text-[11px] font-medium text-red-600 flex items-center gap-1.5 hover:text-red-800 hover:underline"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                  {stats.no_active_cost} cost{stats.no_active_cost > 1 ? 's' : ''} expired
                </Link>
              )}
              {stats.no_list_price > 0 && (
                <Link
                  href={`${comp.href}?country=${country}&alerts=no_list_price`}
                  onClick={e => e.stopPropagation()}
                  className="text-[11px] font-medium text-amber-600 flex items-center gap-1.5 hover:text-amber-800 hover:underline"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                  {stats.no_list_price} unpriced
                </Link>
              )}
              {stats.price_review_needed > 0 && (
                <Link
                  href={`${comp.href}?country=${country}&alerts=price_review_needed`}
                  onClick={e => e.stopPropagation()}
                  className="text-[11px] font-medium text-yellow-600 flex items-center gap-1.5 hover:text-yellow-800 hover:underline"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 shrink-0" />
                  {stats.price_review_needed} need price review
                </Link>
              )}
            </div>
          )}
        </div>
      )}
    </Link>
  );
}

function SimpleCard({ comp, country }: { comp: PricingComponent; country: string }) {
  const Icon = comp.icon;
  const href = country ? `${comp.href}?country=${country}` : comp.href;

  return (
    <Link
      href={href}
      className="bg-white rounded-xl border border-[var(--border)] p-5 hover:border-[var(--sky)]/30 hover:shadow-sm transition-all"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[var(--sky-mist)] flex items-center justify-center">
            <Icon size={16} className="text-[var(--sky)]" />
          </div>
          <span className="text-sm font-semibold text-[var(--text)]">{comp.label}</span>
        </div>
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">Live</span>
      </div>
      <div className="text-xs text-[var(--text-muted)]">
        Manage {comp.label.toLowerCase()} rates
      </div>
    </Link>
  );
}

function LockedCard({ comp }: { comp: PricingComponent }) {
  const Icon = comp.icon;
  return (
    <div className="bg-white rounded-xl border border-[var(--border)] p-5 opacity-50 cursor-not-allowed pointer-events-none">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[var(--surface)] flex items-center justify-center">
            <Icon size={16} className="text-[var(--text-muted)]" />
          </div>
          <span className="text-sm font-semibold text-[var(--text)]">{comp.label}</span>
        </div>
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Coming Soon</span>
      </div>
      <div className="flex items-center justify-center gap-2 py-6 text-[var(--text-muted)]">
        <Lock className="w-4 h-4" />
        <span className="text-sm">Not yet available</span>
      </div>
    </div>
  );
}
