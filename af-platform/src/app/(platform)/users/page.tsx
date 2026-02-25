"use client";

import { useState, useEffect, useMemo } from "react";
import { Users, ShieldCheck, Building2, AlertTriangle, Plus, Search, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchUsersAction } from "@/app/actions/users";
import type { UserRecord } from "@/lib/users";
import { UserTable } from "@/components/users/UserTable";
import { CreateUserModal } from '@/components/users/CreateUserModal';

type FilterTab = "all" | "afc" | "afu";

interface KpiCardProps {
  label: string;
  value: number;
  accent: string;
  icon: React.ReactNode;
}

function KpiCard({ label, value, accent, icon }: KpiCardProps) {
  return (
    <div
      className="bg-white rounded-xl border border-[var(--border)] p-5 flex items-center gap-4"
      style={{ borderLeftWidth: 4, borderLeftColor: accent }}
    >
      <div className="shrink-0 opacity-60" style={{ color: accent }}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-semibold" style={{ color: "var(--text)" }}>
          {value}
        </p>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          {label}
        </p>
      </div>
    </div>
  );
}

function SkeletonCards() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-[var(--border)] p-5 h-[88px] animate-pulse">
          <div className="h-4 w-16 rounded bg-[var(--surface)] mb-2" />
          <div className="h-3 w-24 rounded bg-[var(--surface)]" />
        </div>
      ))}
    </div>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);

  async function fetchUsers() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchUsersAction();
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.valid_access).length;
    const staff = users.filter((u) => u.account_type === "AFU").length;
    const broken = users.filter((u) => u.account_type === "AFC" && !u.company_id).length;
    return { total, active, staff, customers: total - staff, broken };
  }, [users]);

  const filtered = useMemo(() => {
    let list = users;

    if (activeTab === "afc") list = list.filter((u) => u.account_type === "AFU");
    if (activeTab === "afu") list = list.filter((u) => u.account_type === "AFC");

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (u) =>
          u.first_name.toLowerCase().includes(q) ||
          u.last_name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
      );
    }

    return list;
  }, [users, activeTab, search]);

  const tabs: { key: FilterTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "afc", label: "AF Staff" },
    { key: "afu", label: "Customers" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold" style={{ color: "var(--text)" }}>
            User Management
          </h1>
          {!loading && (
            <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
              {stats.total} accounts · {stats.staff} AF Staff · {stats.customers} Customers
            </p>
          )}
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ background: 'var(--sky)' }}
        >
          <Plus size={16} />
          New User
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 flex items-center justify-between">
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={fetchUsers}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-red-700 hover:text-red-900 transition-colors"
          >
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      )}

      {/* KPI cards */}
      {loading ? (
        <SkeletonCards />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Total Users" value={stats.total} accent="var(--sky)" icon={<Users size={22} />} />
          <KpiCard label="Active" value={stats.active} accent="#22c55e" icon={<ShieldCheck size={22} />} />
          <KpiCard label="AF Staff" value={stats.staff} accent="#3b82f6" icon={<Building2 size={22} />} />
          <KpiCard label="Broken Links" value={stats.broken} accent="#f59e0b" icon={<AlertTriangle size={22} />} />
        </div>
      )}

      {/* Filter tabs + search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg bg-[var(--surface)] p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
                activeTab === tab.key
                  ? "bg-white text-[var(--text)] shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text-mid)]"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: "var(--text-muted)" }}
          />
          <input
            type="text"
            placeholder="Search users…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-64 rounded-lg border border-[var(--border)] bg-white pl-9 pr-3 py-2 text-sm outline-none focus:border-[var(--sky)] transition-colors"
            style={{ color: "var(--text)" }}
          />
        </div>
      </div>

      {/* Table */}
      <UserTable users={filtered} loading={loading} onRefresh={fetchUsers} />

      <CreateUserModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={() => {
          setShowCreateModal(false);
          fetchUsers();
        }}
      />
    </div>
  );
}
