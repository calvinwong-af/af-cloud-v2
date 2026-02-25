import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Our Services",
  description:
    "AcceleFreight offers 9 service lines: sea freight, air freight, cross-border trucking, distribution, warehousing, cold storage, customs clearance, EOR/IOR, and outsourced logistics.",
};

const SERVICES = [
  {
    icon: `<path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>`,
    title: "Sea Freight",
    tags: ["FCL", "LCL", "Import", "Export"],
    desc: "Full Container Load (FCL) and Less-than-Container Load (LCL) sea freight services for import and export. We manage the entire ocean freight process from booking to port of discharge, working with major shipping lines across all major global trade lanes.",
  },
  {
    icon: `<path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9l20-7z"/>`,
    title: "Air Freight",
    tags: ["Time-Critical", "Port-to-Port", "Import", "Export"],
    desc: "Time-sensitive air freight services for import and export cargo. We coordinate with airlines for space booking, manage documentation, and ensure your cargo is prioritised for fast, reliable delivery across major air freight corridors.",
  },
  {
    icon: `<line x1="3" y1="12" x2="21" y2="12"/><polyline points="8 7 3 12 8 17"/><polyline points="16 7 21 12 16 17"/>`,
    title: "Cross-Border Trucking",
    tags: ["MY–SG", "MY–TH", "Land Freight", "Border Clearance"],
    desc: "Land freight services across the Malaysia–Singapore, Malaysia–Thailand, and other regional corridors. We handle all cross-border trucking coordination including border clearance documentation, customs liaisoning, and transshipment arrangements.",
  },
  {
    icon: `<rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>`,
    title: "Distribution Services",
    tags: ["Last-Mile", "1/3/5/10 Ton", "Haulage", "Malaysia"],
    desc: "Last-mile and regional distribution across Malaysia. We provide truck-load delivery in 1, 3, 5, and 10-ton configurations, as well as full haulage solutions for moving cargo from port to your warehouse or end destination.",
  },
  {
    icon: `<path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>`,
    title: "Warehousing",
    tags: ["General Cargo", "Inventory Management", "Malaysia"],
    desc: "Conventional storage solutions for general cargo at our Malaysia-based facility. We offer short and long-term warehousing with inventory tracking and management, suitable for a wide range of non-perishable goods.",
  },
  {
    icon: `<path d="M2 12h20M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12a10 10 0 1020 0 10 10 0 00-20 0z"/>`,
    title: "Cold Storage",
    tags: ["Cold Chain", "Pharma", "Perishables", "Temperature-Controlled"],
    desc: "Temperature-controlled storage for pharmaceuticals, perishable food products, and other temperature-sensitive goods. Our cold chain facilities maintain precise temperature ranges to ensure product integrity throughout the storage period.",
  },
  {
    icon: `<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>`,
    title: "Customs Clearance",
    tags: ["Import", "Export"],
    desc: "All cargo exported or imported across borders requires customs clearance. We handle all documentation preparation and submission, represent your company during customs examination, manage duty assessment and payment, and deliver cargo after clearance.",
  },
  {
    icon: `<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>`,
    title: "EOR / IOR Services",
    tags: ["EOR", "IOR", "Cross-Border"],
    desc: "Exporter of Record (EOR) and Importer of Record (IOR) services allow businesses without a local legal entity in Malaysia to import or export goods compliantly. We act as the responsible party for all regulatory, tax, and customs obligations on your behalf.",
  },
  {
    icon: `<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>`,
    title: "Outsourced Logistics Management & Consultation",
    tags: ["Supply Chain", "Outsourced", "Consultation"],
    desc: "For businesses looking to optimise their supply chain without building an in-house logistics team, we offer fully outsourced logistics management and expert consultation. We take ownership of the entire logistics function or provide advisory support on a project basis.",
  },
];

export default function ServicesPage() {
  return (
    <>
      {/* Banner */}
      <div className="page-banner" style={{ marginTop: "68px" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", position: "relative", zIndex: 1 }}>
          <div className="page-tag">What We Offer</div>
          <h1
            style={{
              fontFamily: "var(--font-syne)",
              fontSize: "clamp(2rem, 4vw, 3rem)",
              fontWeight: 800,
              color: "white",
              letterSpacing: "-0.02em",
              marginBottom: "16px",
            }}
          >
            Our Services
          </h1>
          <p
            style={{
              fontFamily: "var(--font-outfit)",
              fontSize: "1rem",
              fontWeight: 300,
              color: "rgba(255,255,255,0.55)",
              maxWidth: "520px",
              lineHeight: 1.7,
            }}
          >
            Nine service lines covering every leg of your import and export
            supply chain — from origin to final destination.
          </p>
        </div>
      </div>

      {/* Services grid */}
      <div style={{ padding: "80px 5%", background: "var(--white)" }}>
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))",
            gap: "24px",
          }}
        >
          {SERVICES.map(({ icon, title, tags, desc }) => (
            <div key={title} className="af-card" style={{ padding: "28px" }}>
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  background: "var(--sky-pale)",
                  borderRadius: "10px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--sky)",
                  marginBottom: "18px",
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" dangerouslySetInnerHTML={{ __html: icon }} />
              </div>
              <h3
                style={{
                  fontFamily: "var(--font-syne)",
                  fontSize: "1.05rem",
                  fontWeight: 700,
                  marginBottom: "12px",
                  color: "var(--text)",
                }}
              >
                {title}
              </h3>
              <p
                style={{
                  fontFamily: "var(--font-outfit)",
                  fontSize: "0.88rem",
                  fontWeight: 300,
                  color: "var(--text-mid)",
                  lineHeight: 1.8,
                  marginBottom: "18px",
                }}
              >
                {desc}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {tags.map((tag) => (
                  <span key={tag} className="af-tag">{tag}</span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Prompt bar */}
        <div
          style={{
            maxWidth: "1200px",
            margin: "48px auto 0",
            padding: "24px 28px",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <div>
            <p
              style={{
                fontFamily: "var(--font-outfit)",
                fontSize: "0.95rem",
                fontWeight: 500,
                color: "var(--text)",
                marginBottom: "4px",
              }}
            >
              Not sure which service you need?
            </p>
            <p
              style={{
                fontFamily: "var(--font-outfit)",
                fontSize: "0.85rem",
                fontWeight: 300,
                color: "var(--text-muted)",
              }}
            >
              Get in touch and our team will assess your requirements and
              recommend the right solution.
            </p>
          </div>
          <Link href="/contact" className="btn-primary" style={{ flexShrink: 0 }}>
            Contact Us
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </>
  );
}
