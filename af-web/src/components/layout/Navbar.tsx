"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { LogoLockup } from "@/components/shared/Logo";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About Us" },
  { href: "/services", label: "Services" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const isActive = (href: string) =>
    pathname === href || pathname === href + "/";

  return (
    <nav
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        height: "68px",
        background: "var(--slate)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        display: "flex",
        alignItems: "center",
        padding: "0 5%",
        justifyContent: "space-between",
      }}
    >
      {/* Logo */}
      <Link href="/" style={{ textDecoration: "none", flexShrink: 0 }}>
        <LogoLockup variant="dark" size="md" />
      </Link>

      {/* Desktop nav links */}
      {!isMobile && (
        <div style={{ display: "flex", alignItems: "center", gap: "32px" }}>
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              style={{
                fontFamily: "var(--font-outfit), sans-serif",
                fontSize: "0.88rem",
                fontWeight: 500,
                color: isActive(href) ? "#6cb8ff" : "rgba(255,255,255,0.75)",
                textDecoration: "none",
                transition: "color 0.15s ease",
                borderBottom: isActive(href)
                  ? "1.5px solid rgba(107,184,255,0.6)"
                  : "1.5px solid transparent",
                paddingBottom: "2px",
                whiteSpace: "nowrap",
              }}
            >
              {label}
            </Link>
          ))}
        </div>
      )}

      {/* Right side */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
        {/* Dashboard button — desktop only */}
        {!isMobile && (
          <a
            href="https://alfred.accelefreight.com"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary"
            style={{ padding: "8px 20px", fontSize: "0.85rem" }}
          >
            Dashboard
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M7 17L17 7M17 7H7M17 7v10" />
            </svg>
          </a>
        )}

        {/* Hamburger — mobile only */}
        {isMobile && (
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            aria-label="Toggle menu"
          >
            {menuOpen ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12h18M3 6h18M3 18h18" />
              </svg>
            )}
          </button>
        )}
      </div>

      {/* Mobile dropdown menu */}
      {isMobile && menuOpen && (
        <div
          style={{
            position: "absolute",
            top: "68px",
            left: 0,
            right: 0,
            background: "var(--slate)",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            padding: "12px 5% 20px",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          }}
        >
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMenuOpen(false)}
              style={{
                fontFamily: "var(--font-outfit), sans-serif",
                fontSize: "0.95rem",
                fontWeight: 500,
                color: isActive(href) ? "#6cb8ff" : "rgba(255,255,255,0.8)",
                textDecoration: "none",
                padding: "12px 0",
                borderBottom: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              {label}
            </Link>
          ))}
          <a
            href="https://alfred.accelefreight.com"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary"
            style={{ marginTop: "16px", justifyContent: "center" }}
          >
            Dashboard
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M7 17L17 7M17 7H7M17 7v10" />
            </svg>
          </a>
        </div>
      )}
    </nav>
  );
}