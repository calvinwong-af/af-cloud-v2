"use client";

import Link from "next/link";

const SERVICES = [
  {
    icon: `<path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>`,
    title: "Sea Freight",
    desc: "FCL & LCL across major global routes",
  },
  {
    icon: `<path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9l20-7z"/>`,
    title: "Air Freight",
    desc: "Time-critical cargo, handled with care",
  },
  {
    icon: `<line x1="3" y1="12" x2="21" y2="12"/><polyline points="8 7 3 12 8 17"/><polyline points="16 7 21 12 16 17"/>`,
    title: "Cross-Border Trucking",
    desc: "Land freight across Malaysia & regional borders",
  },
  {
    icon: `<rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>`,
    title: "Distribution",
    desc: "Last-mile & regional delivery in Malaysia",
  },
  {
    icon: `<path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>`,
    title: "Warehousing",
    desc: "General cargo storage & inventory management",
  },
  {
    icon: `<path d="M2 12h20M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12a10 10 0 1020 0 10 10 0 00-20 0z"/>`,
    title: "Cold Storage",
    desc: "Temperature-controlled for pharma & perishables",
  },
  {
    icon: `<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>`,
    title: "Customs Clearance",
    desc: "Import & export clearance management",
  },
  {
    icon: `<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>`,
    title: "EOR / IOR",
    desc: "Exporter & Importer of Record services",
  },
  {
    icon: `<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>`,
    title: "Outsourced Logistics",
    desc: "Management & consultation services",
  },
];

function ServiceTile({
  icon,
  title,
  desc,
}: {
  icon: string;
  title: string;
  desc: string;
}) {
  return (
    <Link href="/services" style={{ textDecoration: "none" }}>
      <div
        style={{
          background: "var(--white)",
          padding: "28px 24px",
          height: "100%",
          transition: "background 0.2s ease",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = "var(--sky-mist)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = "var(--white)";
        }}
      >
        <div
          style={{
            width: "36px",
            height: "36px",
            background: "var(--sky-pale)",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "14px",
            color: "var(--sky)",
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            dangerouslySetInnerHTML={{ __html: icon }}
          />
        </div>
        <h4
          style={{
            fontFamily: "var(--font-syne)",
            fontSize: "0.9rem",
            fontWeight: 700,
            marginBottom: "6px",
            color: "var(--text)",
          }}
        >
          {title}
        </h4>
        <p
          style={{
            fontFamily: "var(--font-outfit)",
            fontSize: "0.82rem",
            fontWeight: 300,
            color: "var(--text-muted)",
            lineHeight: 1.6,
          }}
        >
          {desc}
        </p>
      </div>
    </Link>
  );
}

export default function ServicesGrid() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
        gap: "1px",
        background: "var(--border)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        overflow: "hidden",
      }}
    >
      {SERVICES.map((s) => (
        <ServiceTile key={s.title} {...s} />
      ))}
    </div>
  );
}
