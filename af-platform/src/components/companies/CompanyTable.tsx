/**
 * CompanyTable — displays company list with sortable columns
 */

'use client';

import { useState } from 'react';
import { MoreVertical, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import type { Company } from '@/lib/types';

interface CompanyTableProps {
  companies: Company[];
  loading: boolean;
}

type SortKey = 'name' | 'company_id' | 'created' | 'updated';
type SortDir = 'asc' | 'desc';

export function CompanyTable({ companies, loading }: CompanyTableProps) {
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
    const av = a[sortKey] as string ?? '';
    const bv = b[sortKey] as string ?? '';
    const cmp = av.localeCompare(bv);
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
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--surface)] border-b border-[var(--border)]">
              <Th onClick={() => handleSort('name')}>
                Company <SortIcon col="name" />
              </Th>
              <Th onClick={() => handleSort('company_id')}>
                ID <SortIcon col="company_id" />
              </Th>
              <Th>Registration</Th>
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
              <CompanyRow key={company.company_id} company={company} />
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

function Th({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <th
      onClick={onClick}
      className={`px-4 py-3 text-left font-medium text-[var(--text-mid)] text-xs uppercase tracking-wide whitespace-nowrap
                  ${onClick ? 'cursor-pointer hover:text-[var(--text)] select-none' : ''}`}
    >
      {children}
    </th>
  );
}

function CompanyRow({ company }: { company: Company }) {
  const initials = company.short_name?.slice(0, 2).toUpperCase() ||
    company.name.slice(0, 2).toUpperCase();

  return (
    <tr className="hover:bg-[var(--surface)] transition-colors">
      {/* Company name + initials avatar */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--sky-pale)] text-[var(--sky)] font-semibold text-xs
                          flex items-center justify-center flex-shrink-0">
            {initials}
          </div>
          <div>
            <div className="font-medium text-[var(--text)]">{company.name}</div>
            {company.short_name && company.short_name !== company.name && (
              <div className="text-xs text-[var(--text-muted)]">{company.short_name}</div>
            )}
          </div>
        </div>
      </td>

      {/* Company ID */}
      <td className="px-4 py-3">
        <span className="font-mono text-xs bg-[var(--surface)] px-2 py-1 rounded text-[var(--text-mid)]">
          {company.company_id}
        </span>
      </td>

      {/* Registration number */}
      <td className="px-4 py-3 text-[var(--text-mid)]">
        {company.registration_number || <span className="text-[var(--text-muted)]">—</span>}
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
        <button className="p-1.5 rounded hover:bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]">
          <MoreVertical className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
}

function CompanyTableSkeleton() {
  return (
    <div className="bg-white border border-[var(--border)] rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--surface)] border-b border-[var(--border)]">
              {['Company', 'ID', 'Registration', 'Currency', 'Approved', 'Portal', 'Xero', 'Updated', ''].map(
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
                {Array.from({ length: 9 }).map((_, j) => (
                  <td key={j} className="px-4 py-3">
                    <div className={`h-4 bg-gray-100 rounded animate-pulse ${j === 0 ? 'w-36' : j === 1 ? 'w-20' : 'w-16'}`} />
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

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-MY', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}
