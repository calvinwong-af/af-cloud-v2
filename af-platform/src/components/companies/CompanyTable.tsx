/**
 * CompanyTable — displays company list with sortable columns
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { Company } from '@/lib/types';
import { CompanyActionsMenu } from './CompanyActionsMenu';

function getCountryCode(country: string): string | null {
  const map: Record<string, string> = {
    'Malaysia': 'my', 'Singapore': 'sg', 'Thailand': 'th', 'Indonesia': 'id',
    'Vietnam': 'vn', 'Philippines': 'ph', 'Cambodia': 'kh', 'Myanmar': 'mm',
    'Brunei': 'bn', 'Laos': 'la', 'Timor-Leste': 'tl',
    'China': 'cn', 'Hong Kong': 'hk', 'Taiwan': 'tw', 'Japan': 'jp',
    'South Korea': 'kr', 'India': 'in', 'Bangladesh': 'bd', 'Sri Lanka': 'lk',
    'Pakistan': 'pk', 'Nepal': 'np',
    'Australia': 'au', 'New Zealand': 'nz',
    'United States of America': 'us', 'United States': 'us', 'USA': 'us',
    'United Kingdom': 'gb', 'UK': 'gb',
    'Germany': 'de', 'France': 'fr', 'Netherlands': 'nl', 'Belgium': 'be',
    'Italy': 'it', 'Spain': 'es', 'Switzerland': 'ch', 'Sweden': 'se',
    'Norway': 'no', 'Poland': 'pl', 'Slovenia': 'si',
    'United Arab Emirates': 'ae', 'UAE': 'ae', 'Saudi Arabia': 'sa',
    'Qatar': 'qa', 'Kuwait': 'kw', 'Bahrain': 'bh', 'Oman': 'om',
    'Turkey': 'tr', 'Kenya': 'ke', 'South Africa': 'za', 'Nigeria': 'ng',
    'Egypt': 'eg', 'Ethiopia': 'et',
    'Trinidad and Tobago': 'tt',
    'Canada': 'ca', 'Mexico': 'mx', 'Brazil': 'br',
  };
  if (country.length === 2) return country.toLowerCase();
  return map[country] ?? null;
}

interface CompanyTableProps {
  companies: Company[];
  loading: boolean;
  onRefresh: () => void;
  onEdit: (company: Company) => void;
}

type SortKey = 'name' | 'company_id' | 'created' | 'updated';
type SortDir = 'asc' | 'desc';

export function CompanyTable({ companies, loading, onRefresh, onEdit }: CompanyTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const sorted = [...companies].sort((a, b) => {
    let cmp = 0;

    if (sortKey === 'updated' || sortKey === 'created') {
      // Date comparison — parse to timestamps, nulls sort last
      const at = a[sortKey] ? new Date(a[sortKey]!).getTime() : 0;
      const bt = b[sortKey] ? new Date(b[sortKey]!).getTime() : 0;
      cmp = at - bt;
    } else if (sortKey === 'company_id') {
      // Numeric sort on the trailing number e.g. AFC-0592 → 592
      const an = parseInt(a.company_id?.replace(/\D/g, '') ?? '0', 10);
      const bn = parseInt(b.company_id?.replace(/\D/g, '') ?? '0', 10);
      cmp = an - bn;
    } else {
      // String sort — case-insensitive
      const av = (a[sortKey] ?? '').toString().toLowerCase();
      const bv = (b[sortKey] ?? '').toString().toLowerCase();
      cmp = av.localeCompare(bv);
    }

    return sortDir === 'asc' ? cmp : -cmp;
  });

  const SortIcon = ({ col }: { col: SortKey }) => (
    <span className={`inline-block ml-1 opacity-40 text-xs ${sortKey === col ? 'opacity-100' : ''}`}>
      {sortKey === col ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
    </span>
  );

  if (loading) {
    return <CompanyTableSkeleton />;
  }

  if (!companies.length) {
    return (
      <div className="text-center py-16 text-[var(--text-muted)] text-sm">
        No companies found
      </div>
    );
  }

  return (
    <div className="bg-white border border-[var(--border)] rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr className="bg-[var(--surface)] border-b border-[var(--border)]">
              <Th onClick={() => handleSort('name')} className="w-[45%]">
                Company <SortIcon col="name" />
              </Th>
              <Th>Currency</Th>
              <Th>Approved</Th>
              <Th>Portal Access</Th>
              <Th>Xero</Th>
              <Th onClick={() => handleSort('updated')}>
                Updated <SortIcon col="updated" />
              </Th>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {sorted.map((company) => (
              <CompanyRow key={company.company_id} company={company} onRefresh={onRefresh} onEdit={onEdit} />
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2.5 text-xs text-[var(--text-muted)] border-t border-[var(--border)]">
        {companies.length} companies
      </div>
    </div>
  );
}

function Th({ children, onClick, className }: { children: React.ReactNode; onClick?: () => void; className?: string }) {
  return (
    <th
      onClick={onClick}
      className={`px-4 py-3 text-left font-medium text-[var(--text-mid)] text-xs uppercase tracking-wide whitespace-nowrap
                  ${onClick ? 'cursor-pointer hover:text-[var(--text)] select-none' : ''} ${className ?? ''}`}
    >
      {children}
    </th>
  );
}

function CompanyRow({ company, onRefresh, onEdit }: { company: Company; onRefresh: () => void; onEdit: (company: Company) => void }) {
  const initials = company.short_name?.slice(0, 2).toUpperCase() ||
    company.name.slice(0, 2).toUpperCase();

  return (
    <tr className="hover:bg-[var(--surface)] transition-colors">
      {/* Company name + ID badge + country */}
      <td className="px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--sky-pale)] text-[var(--sky)] font-semibold text-xs
                          flex items-center justify-center flex-shrink-0 mt-0.5">
            {initials}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Link
                href={`/companies/${company.company_id}`}
                className="font-semibold text-sm hover:text-[var(--sky)] hover:underline transition-colors"
                style={{ color: 'var(--text)' }}
              >
                {company.name}
              </Link>
              <span className="font-mono text-[11px] px-1.5 py-0.5 rounded border"
                style={{ background: 'var(--surface)', color: 'var(--text-mid)', borderColor: 'var(--border)' }}>
                {company.company_id}
              </span>
            </div>
            {company.address?.country && (() => {
              const code = getCountryCode(company.address.country);
              return (
                <div className="flex items-center gap-1.5 mt-0.5">
                  {code ? (
                    <img
                      src={`https://flagcdn.com/16x12/${code}.png`}
                      srcSet={`https://flagcdn.com/32x24/${code}.png 2x`}
                      width={16}
                      height={12}
                      alt={company.address.country}
                      className="inline-block rounded-[2px]"
                    />
                  ) : (
                    <span className="text-[12px]">🌐</span>
                  )}
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    {company.address.country}
                  </span>
                </div>
              );
            })()}
          </div>
        </div>
      </td>

      {/* Currency */}
      <td className="px-4 py-3">
        <span className="px-2 py-0.5 rounded text-xs font-medium bg-[var(--surface)] text-[var(--text-mid)]">
          {company.preferred_currency || 'MYR'}
        </span>
      </td>

      {/* Approved */}
      <td className="px-4 py-3">
        {company.approved
          ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          : <XCircle className="w-4 h-4 text-[var(--border)]" />}
      </td>

      {/* Portal Access */}
      <td className="px-4 py-3">
        {company.allow_access
          ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-sky-100 text-sky-700">Active</span>
          : <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">None</span>}
      </td>

      {/* Xero */}
      <td className="px-4 py-3">
        {company.xero_id
          ? (
            <div className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              {company.xero_sync_required && (
                <span title="Sync required">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                </span>
              )}
            </div>
          )
          : <XCircle className="w-4 h-4 text-[var(--border)]" />}
      </td>

      {/* Updated date */}
      <td className="px-4 py-3 text-[var(--text-muted)] text-xs whitespace-nowrap">
        {formatDate(company.updated)}
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <CompanyActionsMenu company={company} onEdit={onEdit} onRefresh={onRefresh} />
      </td>
    </tr>
  );
}

function CompanyTableSkeleton() {
  return (
    <div className="bg-white border border-[var(--border)] rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr className="bg-[var(--surface)] border-b border-[var(--border)]">
              {['Company', 'Currency', 'Approved', 'Portal', 'Xero', 'Updated', ''].map(
                (h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-[var(--text-mid)] uppercase tracking-wide">
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {Array.from({ length: 8 }).map((_, i) => (
              <tr key={i}>
                {Array.from({ length: 7 }).map((_, j) => (
                  <td key={j} className="px-4 py-3">
                    <div className={`h-4 bg-gray-100 rounded animate-pulse ${j === 0 ? 'w-44' : 'w-16'}`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

