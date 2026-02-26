/**
 * /companies — Company directory
 *
 * Shows all AF customer companies with search, KPI cards, and a sortable table.
 * AFC staff only.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Building2, CheckCircle2, Globe, Link2, Plus, RefreshCw, Search } from 'lucide-react';
import { fetchCompaniesAction, fetchCompanyStatsAction } from '@/app/actions/companies';
import type { Company } from '@/lib/types';
import { CompanyTable } from '@/components/companies/CompanyTable';
import { CreateCompanyModal } from '@/components/companies/CreateCompanyModal';
import { EditCompanyModal } from '@/components/companies/EditCompanyModal';
import { KpiCard } from '@/components/shared/KpiCard';

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [stats, setStats] = useState<{
    total: number;
    approved: number;
    with_access: number;
    xero_synced: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);

  const load = useCallback(async (searchTerm?: string) => {
    setLoading(true);
    setError(null);
    try {
      const [companiesResult, statsResult] = await Promise.all([
        fetchCompaniesAction({ search: searchTerm }),
        stats == null ? fetchCompanyStatsAction() : Promise.resolve({ success: true, data: stats }),
      ]);

      if (!companiesResult.success) throw new Error(companiesResult.error);
      setCompanies(companiesResult.data);

      if (statsResult.success) setStats(statsResult.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load companies');
    } finally {
      setLoading(false);
    }
  }, [stats]);

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search.length === 0 || search.length >= 2) {
        load(search || undefined);
      }
    }, 300);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text)]">Companies</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            Customer and partner company directory
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => load(search || undefined)}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-[var(--border)] text-[var(--text-mid)] hover:bg-[var(--surface)] transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg text-white font-medium hover:opacity-90 transition-opacity"
            style={{ background: 'var(--sky)' }}
          >
            <Plus className="w-4 h-4" />
            Add Company
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<Building2 className="w-5 h-5" />}
          label="Total Companies"
          value={stats?.total ?? '—'}
          loading={stats == null}
        />
        <KpiCard
          icon={<CheckCircle2 className="w-5 h-5" />}
          label="Approved"
          value={stats?.approved ?? '—'}
          loading={stats == null}
          color="green"
        />
        <KpiCard
          icon={<Globe className="w-5 h-5" />}
          label="Portal Access"
          value={stats?.with_access ?? '—'}
          loading={stats == null}
          color="sky"
        />
        <KpiCard
          icon={<Link2 className="w-5 h-5" />}
          label="Xero Synced"
          value={stats?.xero_synced ?? '—'}
          loading={stats == null}
          color="purple"
        />
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
        <input
          type="text"
          placeholder="Search by name or ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoComplete="off"
          className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-[var(--border)] rounded-lg
                     focus:outline-none focus:ring-2 focus:ring-[var(--sky)] focus:border-transparent
                     placeholder:text-[var(--text-muted)]"
        />
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-3">
          <span className="font-medium">Error:</span> {error}
          <button
            onClick={() => load(search || undefined)}
            className="ml-auto text-red-600 hover:text-red-800 underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Table */}
      <CompanyTable
        companies={companies}
        loading={loading}
        onRefresh={() => load(search || undefined)}
        onEdit={(company) => setEditingCompany(company)}
      />

      <CreateCompanyModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={() => {
          setShowCreateModal(false);
          setStats(null);
          load(search || undefined);
        }}
      />

      <EditCompanyModal
        company={editingCompany}
        onClose={() => setEditingCompany(null)}
        onUpdated={() => {
          setEditingCompany(null);
          load(search || undefined);
        }}
      />
    </div>
  );
}
