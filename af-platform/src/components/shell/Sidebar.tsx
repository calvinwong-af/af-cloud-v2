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
  Container,
  LayoutList,
  Ship,
  Grid3X3,
  Globe,
  ScrollText,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  LogOut,
  X,
  UserCircle,
  Package,
  Plane,
  Warehouse,
  FileCheck,
  Car,
  Lock,
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

interface PricingSubItem {
  label: string;
  icon: LucideIcon;
  href: string;
  locked: boolean;
}

const PRICING_SUB_ITEMS: PricingSubItem[] = [
  { label: 'FCL Ocean',      icon: Ship,      href: '/pricing/fcl',          locked: false },
  { label: 'LCL Ocean',      icon: Package,   href: '/pricing/lcl',          locked: false },
  { label: 'Air Freight',    icon: Plane,     href: '/pricing/air',          locked: false },
  { label: 'Local Charges',  icon: Warehouse, href: '/pricing/local-charges', locked: false },
  { label: 'Customs',        icon: FileCheck, href: '/pricing/customs',      locked: false },
  { label: 'Haulage',        icon: Truck,     href: '/pricing/haulage',      locked: false },
  { label: 'Transportation', icon: Car,       href: '/pricing/transportation', locked: false },
];

function getNavSections(accountType: string | null): NavSection[] {
  const isAfu = accountType === 'AFU';

  const sections: NavSection[] = [
    {
      title: 'OVERVIEW',
      items: [{ label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' }],
    },
    {
      title: 'OPERATIONS',
      items: [
        { label: 'All Orders',        icon: LayoutList, href: '/orders' },
        { label: 'Freight Shipments', icon: Ship,       href: '/orders/shipments' },
        { label: 'Deliveries',        icon: Truck,      href: '/orders/deliveries' },
        { label: 'Haulage',           icon: Container,  href: '/orders/haulage' },
      ],
    },
  ];

  if (isAfu) {
    sections.push({
      title: 'ADMINISTRATION',
      items: [
        { label: 'Users',     icon: Users,     href: '/users' },
        { label: 'Companies', icon: Building2, href: '/companies' },
      ],
    });
    // SYSTEM section — pricing handled separately in render
    sections.push({
      title: 'SYSTEM',
      items: [
        { label: 'Geography',      icon: Globe,      href: '/geography' },
        { label: 'System Logs',    icon: ScrollText, href: '/logs' },
      ],
    });
  }

  sections.push({
    title: 'ACCOUNT',
    items: [{ label: 'Profile', icon: UserCircle, href: '/profile' }],
  });

  return sections;
}

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
  isMobileDrawer?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ currentUser, isMobileDrawer, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [roleLabel, setRoleLabel] = useState("Staff");
  const [accountType, setAccountType] = useState<string | null>(null);
  const [pricingExpanded, setPricingExpanded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("af-nav-collapsed");
    if (stored === "true") setCollapsed(true);
    const pricingStored = localStorage.getItem("af-nav-pricing-expanded");
    if (pricingStored === "true") setPricingExpanded(true);
  }, []);

  useEffect(() => {
    getCurrentUserProfileAction().then(({ role, account_type }) => {
      setRoleLabel(resolveRoleLabel(account_type, role));
      setAccountType(account_type);
    });
  }, []);

  // Auto-expand pricing sub-nav when navigating to a pricing route
  const isPricingRoute = pathname.startsWith('/pricing');
  useEffect(() => {
    if (isPricingRoute && !pricingExpanded) {
      setPricingExpanded(true);
      localStorage.setItem("af-nav-pricing-expanded", "true");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPricingRoute]);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("af-nav-collapsed", String(next));
      return next;
    });
  }

  const isCollapsed = isMobileDrawer ? false : collapsed;
  // showPricingSub is now purely driven by pricingExpanded state.
  // Auto-expand via useEffect above ensures it opens on pricing route arrival,
  // but the chevron can still close it even while on a pricing route.
  const showPricingSub = pricingExpanded;

  function togglePricingExpanded() {
    setPricingExpanded((prev) => {
      const next = !prev;
      localStorage.setItem("af-nav-pricing-expanded", String(next));
      return next;
    });
  }

  function handleNavClick() {
    if (isMobileDrawer && onMobileClose) onMobileClose();
  }

  return (
    <aside
      className="relative flex flex-col shrink-0 h-full overflow-hidden"
      style={{
        width: isCollapsed ? 64 : 240,
        background: "var(--slate)",
        borderRight: "1px solid rgba(255,255,255,0.05)",
        transition: "width 0.25s cubic-bezier(0.4,0,0.2,1)",
      }}
    >
      <div className="grid-texture pointer-events-none absolute inset-0" />

      {/* ── Header ── */}
      <div className="relative z-10 flex items-center h-[56px] px-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0 flex-1 overflow-hidden">
          <div className="shrink-0 flex items-center justify-center" style={{ width: 40, height: 40 }}>
            <LogoMark size={28} />
          </div>
          <span
            className="font-display text-[0.95rem] font-bold leading-none tracking-tight whitespace-nowrap"
            style={{ opacity: isCollapsed ? 0 : 1, transition: "opacity 0.2s" }}
          >
            <span className="text-white">Accele</span>
            <span style={{ color: "var(--sky-light)" }}>Freight</span>
          </span>
        </div>

        {isMobileDrawer ? (
          <button
            onClick={onMobileClose}
            className="relative z-10 shrink-0 flex items-center justify-center w-7 h-7 rounded-md transition-colors hover:bg-white/10"
          >
            <X size={16} className="text-white/50" />
          </button>
        ) : (
          <button
            onClick={toggleCollapsed}
            className="relative z-10 shrink-0 items-center justify-center w-7 h-7 rounded-md transition-colors hover:bg-white/10 hidden lg:flex"
            style={{
              opacity: isCollapsed ? 0 : 1,
              pointerEvents: isCollapsed ? "none" : "auto",
              transition: "opacity 0.2s",
            }}
          >
            <ChevronLeft
              size={16}
              className="text-white/50 transition-transform"
              style={{ transform: isCollapsed ? "rotate(180deg)" : "rotate(0deg)" }}
            />
          </button>
        )}
      </div>

      {/* ── Nav sections ── */}
      <nav className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden px-2 py-2 space-y-4">
        {getNavSections(accountType).map((section) => (
          <div key={section.title}>
            {/* Section label */}
            <div
              className="font-mono uppercase tracking-[0.2em] px-2 mb-1.5 whitespace-nowrap overflow-hidden transition-all"
              style={{
                fontSize: "0.6rem",
                color: "var(--text-muted)",
                opacity: isCollapsed ? 0 : 1,
                height: isCollapsed ? 0 : "1.25rem",
                marginBottom: isCollapsed ? 0 : 6,
                transition: "opacity 0.2s, height 0.2s, margin 0.2s",
              }}
            >
              {section.title}
            </div>

            <div className="space-y-0.5">
              {/* Pricing sub-nav group — rendered before other SYSTEM items */}
              {section.title === 'SYSTEM' && (
                <>
                  {/* Pricing group header — link + chevron toggle */}
                  <Link
                    href="/pricing"
                    title={isCollapsed ? "Pricing Tables" : undefined}
                    onClick={() => {
                      handleNavClick();
                      if (!showPricingSub) {
                        setPricingExpanded(true);
                        localStorage.setItem("af-nav-pricing-expanded", "true");
                      }
                    }}
                    className={cn(
                      "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors w-full text-left",
                      isCollapsed && "justify-center px-0",
                      isPricingRoute ? "text-white" : "text-white/50 hover:bg-white/[0.055]"
                    )}
                    style={isPricingRoute ? { background: "rgba(59,158,255,0.11)" } : undefined}
                  >
                    {isPricingRoute && (
                      <div
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full"
                        style={{ height: "60%", background: "var(--sky)" }}
                      />
                    )}
                    <Grid3X3 size={18} className={cn("shrink-0", isPricingRoute ? "text-[var(--sky)]" : "")} />
                    {!isCollapsed && (
                      <>
                        <span className="flex-1 truncate">Pricing Tables</span>
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); togglePricingExpanded(); }}
                          className="shrink-0 p-0.5 rounded hover:bg-white/10 transition-colors"
                        >
                          {showPricingSub
                            ? <ChevronDown size={14} className="text-white/30" />
                            : <ChevronRight size={14} className="text-white/30" />}
                        </button>
                      </>
                    )}
                  </Link>

                  {/* Pricing sub-items */}
                  {showPricingSub && !isCollapsed && (
                    <div className="ml-4 pl-3 border-l border-white/10 space-y-0.5">
                      {PRICING_SUB_ITEMS.map((sub) => {
                        if (sub.locked) {
                          return (
                            <div
                              key={sub.href}
                              className="relative flex items-center gap-3 rounded-md px-3 py-1.5 text-xs opacity-40 cursor-not-allowed"
                            >
                              <sub.icon size={14} className="shrink-0" />
                              <span className="flex-1 truncate text-white/50">{sub.label}</span>
                              <Lock size={10} className="shrink-0 text-white/30" />
                            </div>
                          );
                        }
                        const subActive = sub.href === '/pricing'
                          ? pathname === '/pricing'
                          : pathname.startsWith(sub.href);
                        return (
                          <Link
                            key={sub.href}
                            href={sub.href}
                            onClick={handleNavClick}
                            className={cn(
                              "relative flex items-center gap-3 rounded-md px-3 py-1.5 text-xs transition-colors",
                              subActive ? "text-white" : "text-white/50 hover:bg-white/[0.055]"
                            )}
                            style={subActive ? { background: "rgba(59,158,255,0.11)" } : undefined}
                          >
                            <sub.icon size={14} className={cn("shrink-0", subActive ? "text-[var(--sky)]" : "")} />
                            <span className="flex-1 truncate">{sub.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {section.items.map((item) => {
                // Exact match for /orders to avoid highlighting when on sub-routes
                const active = item.href === '/orders'
                  ? pathname === '/orders'
                  : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={isCollapsed ? item.label : undefined}
                    onClick={handleNavClick}
                    className={cn(
                      "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                      isCollapsed && "justify-center px-0",
                      active ? "text-white" : "text-white/50 hover:bg-white/[0.055]"
                    )}
                    style={active ? { background: "rgba(59,158,255,0.11)" } : undefined}
                  >
                    {active && (
                      <div
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full"
                        style={{ height: "60%", background: "var(--sky)" }}
                      />
                    )}
                    <Icon size={18} className={cn("shrink-0", active ? "text-[var(--sky)]" : "")} />
                    {!isCollapsed && (
                      <>
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.badge && (
                          <span
                            className="text-[0.6rem] font-medium px-1.5 py-0.5 rounded-full"
                            style={{ background: "rgba(59,158,255,0.15)", color: "var(--sky)" }}
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
        {isCollapsed && !isMobileDrawer && (
          <button
            onClick={toggleCollapsed}
            className="flex items-center justify-center w-full h-8 rounded-md transition-colors hover:bg-white/10 mb-2"
          >
            <ChevronLeft size={16} className="text-white/50" style={{ transform: "rotate(180deg)" }} />
          </button>
        )}

        <div className="flex items-center gap-2.5 overflow-hidden">
          <div
            className="shrink-0 flex items-center justify-center rounded-lg text-white text-xs font-semibold"
            style={{ width: 32, height: 32, background: "linear-gradient(135deg, var(--sky), var(--sky-light))" }}
          >
            {getInitials(currentUser.displayName)}
          </div>
          <div
            className="flex-1 min-w-0 overflow-hidden"
            style={{ opacity: isCollapsed ? 0 : 1, transition: "opacity 0.2s" }}
          >
            <p className="text-xs font-medium text-white truncate">{currentUser.displayName || "User"}</p>
            <p className="text-[0.6rem] truncate" style={{ color: "var(--text-muted)" }}>{roleLabel}</p>
          </div>
          <button
            onClick={() => signOut()}
            title="Sign out"
            className="shrink-0 flex items-center justify-center w-7 h-7 rounded-md transition-colors hover:bg-white/10"
            style={{
              opacity: isCollapsed ? 0 : 1,
              pointerEvents: isCollapsed ? "none" : "auto",
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
