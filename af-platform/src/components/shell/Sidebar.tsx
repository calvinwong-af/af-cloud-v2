"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { User } from "firebase/auth";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Truck,
  Users,
  Building2,
  Grid3X3,
  Globe,
  ScrollText,
  ChevronLeft,
  LogOut,
} from "lucide-react";
import { LogoMark } from "@/components/shared/Logo";
import { signOut } from "@/lib/auth";
import { getCurrentUserProfileAction } from "@/app/actions/users";
import { cn } from "@/lib/utils";

function resolveRoleLabel(accountType: string | null, role: string | null): string {
  if (accountType === 'AFU') {
    return role === 'AFU-ADMIN' ? 'AF Admin' : 'AF Staff';
  }
  if (accountType === 'AFC') {
    if (role === 'AFC-ADMIN') return 'Company Admin';
    if (role === 'AFC-M') return 'Company Manager';
  }
  return role ?? 'Staff';
}

interface NavItem {
  label: string;
  icon: LucideIcon;
  href: string;
  badge?: number;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: "OVERVIEW",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
    ],
  },
  {
    title: "OPERATIONS",
    items: [
      { label: "Shipments", icon: Truck, href: "/shipments" },
    ],
  },
  {
    title: "ADMINISTRATION",
    items: [
      { label: "Users", icon: Users, href: "/users" },
      { label: "Companies", icon: Building2, href: "/companies" },
    ],
  },
  {
    title: "SYSTEM",
    items: [
      { label: "Pricing Tables", icon: Grid3X3, href: "/pricing" },
      { label: "Geography", icon: Globe, href: "/geography" },
      { label: "System Logs", icon: ScrollText, href: "/logs" },
    ],
  },
];

function getInitials(displayName: string | null): string {
  if (!displayName) return "U";
  return displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

interface SidebarProps {
  currentUser: User;
}

export function Sidebar({ currentUser }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [roleLabel, setRoleLabel] = useState("Staff");

  // Hydrate collapse state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("af-nav-collapsed");
    if (stored === "true") setCollapsed(true);
  }, []);

  // Fetch current user's role for sidebar display
  useEffect(() => {
    getCurrentUserProfileAction().then(({ role, account_type }) => {
      setRoleLabel(resolveRoleLabel(account_type, role));
    });
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("af-nav-collapsed", String(next));
      return next;
    });
  }

  return (
    <aside
      className="relative flex flex-col shrink-0 h-full overflow-hidden"
      style={{
        width: collapsed ? 64 : 240,
        background: "var(--slate)",
        borderRight: "1px solid rgba(255,255,255,0.05)",
        transition: "width 0.25s cubic-bezier(0.4,0,0.2,1)",
      }}
    >
      {/* Grid texture overlay */}
      <div className="grid-texture pointer-events-none absolute inset-0" />

      {/* ── Header ── */}
      <div className="relative z-10 flex items-center h-[56px] px-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0 flex-1 overflow-hidden">
          <div className="shrink-0 flex items-center justify-center" style={{ width: 40, height: 40 }}>
            <LogoMark size={28} />
          </div>
          <span
            className="font-display text-[0.95rem] font-bold leading-none tracking-tight whitespace-nowrap"
            style={{
              opacity: collapsed ? 0 : 1,
              transition: "opacity 0.2s",
            }}
          >
            <span className="text-white">Accele</span>
            <span style={{ color: "var(--sky-light)" }}>Freight</span>
          </span>
        </div>
        <button
          onClick={toggleCollapsed}
          className="relative z-10 shrink-0 flex items-center justify-center w-7 h-7 rounded-md transition-colors hover:bg-white/10"
          style={{
            opacity: collapsed ? 0 : 1,
            pointerEvents: collapsed ? "none" : "auto",
            transition: "opacity 0.2s",
          }}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronLeft
            size={16}
            className="text-white/50 transition-transform"
            style={{
              transform: collapsed ? "rotate(180deg)" : "rotate(0deg)",
            }}
          />
        </button>
      </div>

      {/* ── Nav sections ── */}
      <nav className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden px-2 py-2 space-y-4">
        {navSections.map((section) => (
          <div key={section.title}>
            {/* Section label */}
            <div
              className="font-mono uppercase tracking-[0.2em] px-2 mb-1.5 whitespace-nowrap overflow-hidden transition-all"
              style={{
                fontSize: "0.6rem",
                color: "var(--text-muted)",
                opacity: collapsed ? 0 : 1,
                height: collapsed ? 0 : "1.25rem",
                marginBottom: collapsed ? 0 : 6,
                transition: "opacity 0.2s, height 0.2s, margin 0.2s",
              }}
            >
              {section.title}
            </div>

            {/* Items */}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = pathname.startsWith(item.href);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                      collapsed && "justify-center px-0",
                      active
                        ? "text-white"
                        : "text-white/50 hover:bg-white/[0.055]"
                    )}
                    style={
                      active
                        ? { background: "rgba(59,158,255,0.11)" }
                        : undefined
                    }
                  >
                    {/* Active indicator */}
                    {active && (
                      <div
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full"
                        style={{
                          height: "60%",
                          background: "var(--sky)",
                        }}
                      />
                    )}

                    <Icon
                      size={18}
                      className={cn(
                        "shrink-0",
                        active ? "text-[var(--sky)]" : ""
                      )}
                    />

                    {!collapsed && (
                      <>
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.badge && (
                          <span
                            className="text-[0.6rem] font-medium px-1.5 py-0.5 rounded-full"
                            style={{
                              background: "rgba(59,158,255,0.15)",
                              color: "var(--sky)",
                            }}
                          >
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Footer ── */}
      <div
        className="relative z-10 shrink-0 border-t px-3 py-3"
        style={{ borderColor: "rgba(255,255,255,0.05)" }}
      >
        {/* Expand button when collapsed */}
        {collapsed && (
          <button
            onClick={toggleCollapsed}
            className="flex items-center justify-center w-full h-8 rounded-md transition-colors hover:bg-white/10 mb-2"
            aria-label="Expand sidebar"
          >
            <ChevronLeft
              size={16}
              className="text-white/50"
              style={{ transform: "rotate(180deg)" }}
            />
          </button>
        )}

        <div className="flex items-center gap-2.5 overflow-hidden">
          {/* Avatar */}
          <div
            className="shrink-0 flex items-center justify-center rounded-lg text-white text-xs font-semibold"
            style={{
              width: 32,
              height: 32,
              background: "linear-gradient(135deg, var(--sky), var(--sky-light))",
            }}
          >
            {getInitials(currentUser.displayName)}
          </div>

          {/* Name + role */}
          <div
            className="flex-1 min-w-0 overflow-hidden"
            style={{
              opacity: collapsed ? 0 : 1,
              transition: "opacity 0.2s",
            }}
          >
            <p className="text-xs font-medium text-white truncate">
              {currentUser.displayName || "User"}
            </p>
            <p className="text-[0.6rem] truncate" style={{ color: "var(--text-muted)" }}>
              {roleLabel}
            </p>
          </div>

          {/* Sign out */}
          <button
            onClick={() => signOut()}
            title="Sign out"
            className="shrink-0 flex items-center justify-center w-7 h-7 rounded-md transition-colors hover:bg-white/10"
            style={{
              opacity: collapsed ? 0 : 1,
              pointerEvents: collapsed ? "none" : "auto",
              transition: "opacity 0.2s",
            }}
          >
            <LogOut size={14} className="text-white/50" />
          </button>
        </div>
      </div>
    </aside>
  );
}
