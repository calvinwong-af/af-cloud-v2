/**
 * /companies/[id] — Company detail page
 *
 * Shows company info, address, contacts, Xero status, linked users, and shipments.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, CheckCircle2, XCircle,
  AlertCircle, Loader2, ArrowRight,
} from 'lucide-react';
import { fetchCompanyAction, fetchCompanyUsersAction, fetchCompanyShipmentsAction } from '@/app/actions/companies';
import { formatDate } from '@/lib/utils';
import type { Company } from '@/lib/types';
import type { ShipmentOrder } from '@/lib/types';
import type { CompanyUser } from '@/lib/companies';
import { SHIPMENT_STATUS_LABELS, SHIPMENT_STATUS_COLOR, ORDER_TYPE_LABELS } from '@/lib/types';

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CompanyDetailPage({ params }: { params: { id: string } }) {
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'shipments' | 'users'>('shipments');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchCompanyAction(params.id);
      if (!result.success) throw new Error(result.error);
      setCompany(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load company');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="p-6 space-y-4">
        <Link href="/companies" className="inline-flex items-center gap-1.5 text-sm text-[var(--sky)] hover:underline">
          <ArrowLeft className="w-4 h-4" /> Back to Companies
        </Link>
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-3">
          <span className="font-medium">Error:</span> {error ?? 'Company not found'}
          <button onClick={load} className="ml-auto text-red-600 hover:text-red-800 underline">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Back link */}
      <Link href="/companies" className="inline-flex items-center gap-1.5 text-sm text-[var(--sky)] hover:underline">
        <ArrowLeft className="w-4 h-4" /> Back to Companies
      </Link>

      {/* Banner */}
      <div className="bg-white border border-[var(--border)] rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[var(--sky-pale)] text-[var(--sky)] font-bold text-sm flex items-center justify-center">
              {(company.short_name || company.name).slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-semibold text-[var(--text)]">{company.name}</h1>
              {company.short_name && company.short_name !== company.name && (
                <p className="text-sm text-[var(--text-muted)]">{company.short_name}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs bg-[var(--surface)] px-2.5 py-1 rounded text-[var(--text-mid)]">
              {company.company_id}
            </span>
            {company.approved ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                <CheckCircle2 className="w-3 h-3" /> Approved
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                <XCircle className="w-3 h-3" /> Not Approved
              </span>
            )}
            {company.allow_access ? (
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-sky-100 text-sky-700">
                Portal Active
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                No Portal
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Info card */}
          <Card title="Company Info">
            <InfoRow label="Registration" value={company.registration_number || '—'} />
            <InfoRow label="Currency" value={company.preferred_currency} />
            <InfoRow label="Created" value={formatDate(company.created)} />
            <InfoRow label="Updated" value={formatDate(company.updated)} />
          </Card>

          {/* Address card */}
          <Card title="Address">
            {Object.values(company.address ?? {}).some(Boolean) ? (
              <div className="text-sm text-[var(--text-mid)] space-y-0.5">
                {company.address.line1 && <p>{company.address.line1}</p>}
                {company.address.line2 && <p>{company.address.line2}</p>}
                <p>
                  {[company.address.city, company.address.state, company.address.postcode]
                    .filter(Boolean).join(', ')}
                </p>
                {company.address.country && <p>{company.address.country}</p>}
              </div>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">No address on file</p>
            )}
          </Card>

          {/* Contact card */}
          <Card title="Contact">
            <div className="space-y-3">
              {(company.contact_info?.phone || company.contact_info?.email) && (
                <div className="text-sm space-y-1">
                  {company.contact_info.phone && (
                    <InfoRow label="Phone" value={company.contact_info.phone} />
                  )}
                  {company.contact_info.email && (
                    <InfoRow label="Email" value={company.contact_info.email} />
                  )}
                  {company.contact_info.website && (
                    <InfoRow label="Website" value={company.contact_info.website} />
                  )}
                </div>
              )}

              {(company.contact_persons ?? []).length > 0 && (
                <div>
                  <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-2">Contact Persons</p>
                  <div className="space-y-2">
                    {company.contact_persons.map((cp, i) => (
                      <div key={i} className="text-sm text-[var(--text-mid)] bg-[var(--surface)] rounded-lg p-3">
                        <p className="font-medium text-[var(--text)]">{cp.name ?? '—'}</p>
                        {cp.role && <p className="text-xs text-[var(--text-muted)]">{cp.role}</p>}
                        {cp.email && <p>{cp.email}</p>}
                        {cp.phone && <p>{cp.phone}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!company.contact_info?.phone && !company.contact_info?.email && !(company.contact_persons ?? []).length && (
                <p className="text-sm text-[var(--text-muted)]">No contact information on file</p>
              )}
            </div>
          </Card>

          {/* Tags */}
          {(company.tags ?? []).length > 0 && (
            <Card title="Tags">
              <div className="flex flex-wrap gap-2">
                {company.tags.map((tag) => (
                  <span key={tag} className="px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--surface)] text-[var(--text-mid)]">
                    {tag}
                  </span>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Right column (1/3) */}
        <div className="space-y-6">
          {/* Xero card */}
          <Card title="Xero Integration">
            <div className="space-y-3">
              <InfoRow label="Xero ID" value={company.xero_id ?? '—'} />
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--text-muted)]">Synced:</span>
                {company.xero_sync ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-gray-300" />
                )}
              </div>
              {company.xero_sync_required && (
                <div className="flex items-center gap-2 text-amber-600 text-xs">
                  <AlertCircle className="w-4 h-4" />
                  Sync required
                </div>
              )}
            </div>
          </Card>

          {/* Files count */}
          <Card title="Files">
            <p className="text-sm text-[var(--text-mid)]">
              {(company.files ?? []).length} file{company.files?.length !== 1 ? 's' : ''} attached
            </p>
          </Card>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-lg bg-[var(--surface)] p-1 w-fit">
        {(['shipments', 'users'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors capitalize
              ${activeTab === tab
                ? 'bg-white text-[var(--text)] shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text-mid)]'
              }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'shipments' ? (
        <CompanyShipmentsTab companyId={params.id} />
      ) : (
        <CompanyUsersTab companyId={params.id} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shipments Tab
// ---------------------------------------------------------------------------

function CompanyShipmentsTab({ companyId }: { companyId: string }) {
  const [orders, setOrders] = useState<ShipmentOrder[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (cursor?: string) => {
    const isLoadMore = !!cursor;
    if (isLoadMore) setLoadingMore(true); else setLoading(true);

    const result = await fetchCompanyShipmentsAction(companyId, cursor);
    if (result.success) {
      setOrders((prev) => isLoadMore ? [...prev, ...result.data.orders] : result.data.orders);
      setNextCursor(result.data.nextCursor);
    }

    if (isLoadMore) setLoadingMore(false); else setLoading(false);
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="py-8 text-center"><Loader2 className="w-5 h-5 animate-spin text-[var(--text-muted)] mx-auto" /></div>;
  }

  if (!orders.length) {
    return <p className="text-sm text-[var(--text-muted)] text-center py-8">No shipments found for this company</p>;
  }

  const STATUS_STYLES: Record<string, string> = {
    gray: 'bg-gray-100 text-gray-600', yellow: 'bg-yellow-100 text-yellow-700',
    blue: 'bg-blue-100 text-blue-700', orange: 'bg-orange-100 text-orange-700',
    teal: 'bg-teal-100 text-teal-700', sky: 'bg-sky-100 text-sky-700',
    indigo: 'bg-indigo-100 text-indigo-700', purple: 'bg-purple-100 text-purple-700',
    red: 'bg-red-100 text-red-600', green: 'bg-emerald-100 text-emerald-700',
  };

  return (
    <div className="bg-white border border-[var(--border)] rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--surface)] border-b border-[var(--border)]">
              {['Order ID', 'Status', 'Type', 'Route', 'Updated'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-[var(--text-mid)] uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {orders.map((order) => {
              const statusLabel = SHIPMENT_STATUS_LABELS[order.status] ?? `${order.status}`;
              const statusColor = SHIPMENT_STATUS_COLOR[order.status] ?? 'gray';
              const statusStyle = STATUS_STYLES[statusColor] ?? STATUS_STYLES.gray;
              return (
                <tr key={order.quotation_id} className="hover:bg-[var(--surface)] transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/shipments/${order.quotation_id}`} className="font-mono text-xs font-medium text-[var(--sky)] hover:underline">
                      {order.quotation_id}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${statusStyle}`}>
                      {statusLabel}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--text-mid)]">
                    {ORDER_TYPE_LABELS[order.order_type] ?? order.order_type}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-xs text-[var(--text-mid)]">
                      <span className="font-mono">{order.origin?.label ?? order.origin?.port_un_code ?? '—'}</span>
                      <ArrowRight className="w-3 h-3 text-[var(--text-muted)]" />
                      <span className="font-mono">{order.destination?.label ?? order.destination?.port_un_code ?? '—'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--text-muted)] whitespace-nowrap">
                    {formatDate(order.updated)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2.5 text-xs text-[var(--text-muted)] border-t border-[var(--border)] flex items-center justify-between">
        <span>{orders.length} orders shown</span>
        {nextCursor && (
          <button
            onClick={() => load(nextCursor)}
            disabled={loadingMore}
            className="text-[var(--sky)] hover:underline flex items-center gap-1"
          >
            {loadingMore && <Loader2 className="w-3 h-3 animate-spin" />}
            Load more
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Users Tab
// ---------------------------------------------------------------------------

function CompanyUsersTab({ companyId }: { companyId: string }) {
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCompanyUsersAction(companyId).then((result) => {
      if (result.success) setUsers(result.data);
      setLoading(false);
    });
  }, [companyId]);

  if (loading) {
    return <div className="py-8 text-center"><Loader2 className="w-5 h-5 animate-spin text-[var(--text-muted)] mx-auto" /></div>;
  }

  if (!users.length) {
    return <p className="text-sm text-[var(--text-muted)] text-center py-8">No users linked to this company</p>;
  }

  return (
    <div className="bg-white border border-[var(--border)] rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--surface)] border-b border-[var(--border)]">
              {['Name', 'Email', 'Role', 'Access'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-[var(--text-mid)] uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {users.map((user) => (
              <tr key={user.uid} className="hover:bg-[var(--surface)] transition-colors">
                <td className="px-4 py-3 font-medium text-[var(--text)]">{user.name}</td>
                <td className="px-4 py-3 text-[var(--text-mid)]">{user.email}</td>
                <td className="px-4 py-3">
                  {user.role ? (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-sky-100 text-sky-700">
                      {user.role}
                    </span>
                  ) : (
                    <span className="text-[var(--text-muted)]">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block h-2.5 w-2.5 rounded-full ${user.valid_access ? 'bg-green-500' : 'bg-gray-300'}`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2.5 text-xs text-[var(--text-muted)] border-t border-[var(--border)]">
        {users.length} user{users.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-[var(--border)] rounded-xl p-5">
      <h3 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-3">{title}</h3>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between py-1.5">
      <span className="text-xs text-[var(--text-muted)]">{label}</span>
      <span className="text-sm text-[var(--text-mid)]">{value}</span>
    </div>
  );
}

