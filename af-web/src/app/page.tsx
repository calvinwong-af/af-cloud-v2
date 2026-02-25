import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "AcceleFreight — Your Complete Logistics Solution",
  description:
    "AcceleFreight provides end-to-end freight forwarding and 3PL services for businesses operating in and out of Malaysia. Sea freight, air freight, customs clearance, and more.",
};

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

const TICKER_ITEMS = [
  "Sea Freight",
  "Air Freight",
  "Cross-Border Trucking",
  "Distribution Services",
  "Warehousing",
  "Cold Storage",
  "Customs Clearance",
  "EOR / IOR Services",
  "Outsourced Logistics",
];

export default function HomePage() {
  const tickerContent = [...TICKER_ITEMS, ...TICKER_ITEMS]; // doubled for seamless loop

  return (
    <>
      {/* ── Hero ───────────────────────────────────────────────────── */}
      <div
        style={{
          background: "var(--slate)",
          marginTop: "68px",
          minHeight: "calc(100vh - 68px)",
          display: "flex",
          alignItems: "center",
          padding: "80px 5%",
          position: "relative",
          overflow: "hidden",
        }}
        className="grid-texture"
      >
        {/* Sky glow */}
        <div
          style={{
            position: "absolute",
            right: "5%",
            top: "50%",
            transform: "translateY(-50%)",
            width: "500px",
            height: "500px",
            background:
              "radial-gradient(circle, rgba(59,158,255,0.14) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "48px",
            flexWrap: "wrap",
          }}
        >
          {/* Left: copy */}
          <div style={{ flex: "1", minWidth: "300px", maxWidth: "560px" }}>
            {/* Badge */}
            <div
              className="fade-up fade-1"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 14px",
                background: "rgba(59,158,255,0.1)",
                border: "1px solid rgba(59,158,255,0.25)",
                borderRadius: "100px",
                marginBottom: "28px",
              }}
            >
              <span className="status-dot" />
              <span
                style={{
                  fontFamily: "var(--font-outfit)",
                  fontSize: "0.8rem",
                  fontWeight: 500,
                  color: "rgba(255,255,255,0.75)",
                }}
              >
                Malaysian Freight Forwarder &amp; 3PL
              </span>
            </div>

            <h1
              className="fade-up fade-2"
              style={{
                fontFamily: "var(--font-syne)",
                fontSize: "clamp(2.4rem, 5vw, 3.5rem)",
                fontWeight: 800,
                color: "white",
                lineHeight: 1.1,
                letterSpacing: "-0.02em",
                marginBottom: "24px",
              }}
            >
              Your complete
              <br />
              <span style={{ color: "var(--sky)" }}>logistics solution.</span>
            </h1>

            <p
              className="fade-up fade-3"
              style={{
                fontFamily: "var(--font-outfit)",
                fontSize: "1rem",
                fontWeight: 300,
                color: "rgba(255,255,255,0.6)",
                lineHeight: 1.8,
                marginBottom: "36px",
                maxWidth: "460px",
              }}
            >
              AcceleFreight provides end-to-end freight forwarding and
              third-party logistics services for businesses operating in and out
              of Malaysia. Sea, air, distribution — we handle it all.
            </p>

            <div
              className="fade-up fade-4"
              style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "48px" }}
            >
              <Link href="/contact" className="btn-primary">
                Get In Touch
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
              <Link
                href="/services"
                className="btn-outline"
                style={{
                  borderColor: "rgba(255,255,255,0.15)",
                  color: "rgba(255,255,255,0.7)",
                }}
              >
                Our Services
              </Link>
            </div>

            {/* Stats */}
            <div
              className="fade-up fade-5"
              style={{ display: "flex", gap: "40px", flexWrap: "wrap" }}
            >
              {[
                { num: "2018", label: "Established" },
                { num: "9+", label: "Service Lines" },
                { num: "2,000+", label: "Quotations Processed" },
              ].map(({ num, label }) => (
                <div key={label}>
                  <div
                    style={{
                      fontFamily: "var(--font-syne)",
                      fontSize: "1.6rem",
                      fontWeight: 700,
                      color: "white",
                      lineHeight: 1,
                    }}
                  >
                    {num}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-outfit)",
                      fontSize: "0.78rem",
                      color: "rgba(255,255,255,0.4)",
                      marginTop: "4px",
                      fontWeight: 400,
                    }}
                  >
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Shipment tracker card */}
          <div
            className="fade-up fade-4 float-card"
            style={{ flex: "0 0 auto", width: "340px", maxWidth: "100%" }}
          >
            <div
              style={{
                background: "rgba(26,47,71,0.8)",
                border: "1px solid rgba(59,158,255,0.2)",
                borderRadius: "10px",
                padding: "20px",
                backdropFilter: "blur(12px)",
              }}
            >
              {/* Card header */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "16px",
                  paddingBottom: "16px",
                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-outfit)",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.6)",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  Shipment Tracker
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-jetbrains)",
                    fontSize: "0.72rem",
                    color: "var(--sky)",
                  }}
                >
                  AF-2026-08841
                </span>
              </div>

              {/* Details */}
              {[
                { key: "Mode", val: "Sea Freight · FCL" },
                { key: "Route", val: "Port Klang → Shanghai" },
                { key: "Container", val: "MSKU 7724901-3 · 20FT", mono: true },
              ].map(({ key, val, mono }) => (
                <div
                  key={key}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "10px",
                    alignItems: "flex-start",
                    gap: "12px",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-outfit)",
                      fontSize: "0.78rem",
                      color: "rgba(255,255,255,0.35)",
                      flexShrink: 0,
                    }}
                  >
                    {key}
                  </span>
                  <span
                    style={{
                      fontFamily: mono ? "var(--font-jetbrains)" : "var(--font-outfit)",
                      fontSize: "0.8rem",
                      color: "rgba(255,255,255,0.8)",
                      textAlign: "right",
                    }}
                  >
                    {val}
                  </span>
                </div>
              ))}

              <div
                style={{
                  borderTop: "1px solid rgba(255,255,255,0.08)",
                  margin: "14px 0",
                }}
              />

              {/* Timeline */}
              {[
                { label: "Booking Confirmed", sub: "12 Feb 2026 · 09:14", state: "done" },
                { label: "Customs Cleared", sub: "18 Feb 2026 · 14:32", state: "done" },
                { label: "In Transit · On Vessel", sub: "ETA Shanghai: 04 Mar 2026", state: "active" },
                { label: "Destination Clearance", sub: "Pending", state: "pending" },
              ].map(({ label, sub, state }, i) => (
                <div
                  key={i}
                  style={{ display: "flex", gap: "12px", marginBottom: i < 3 ? "12px" : 0 }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        width: "10px",
                        height: "10px",
                        borderRadius: "50%",
                        background:
                          state === "done"
                            ? "var(--sky)"
                            : state === "active"
                            ? "var(--sky)"
                            : "rgba(255,255,255,0.15)",
                        border:
                          state === "active"
                            ? "2px solid rgba(59,158,255,0.4)"
                            : "none",
                        animation: state === "active" ? "statusPulse 2s infinite" : "none",
                        marginTop: "2px",
                        flexShrink: 0,
                      }}
                    />
                    {i < 3 && (
                      <div
                        style={{
                          width: "1px",
                          height: "20px",
                          background: "rgba(255,255,255,0.1)",
                          marginTop: "3px",
                        }}
                      />
                    )}
                  </div>
                  <div>
                    <div
                      style={{
                        fontFamily: "var(--font-outfit)",
                        fontSize: "0.8rem",
                        fontWeight: state === "active" ? 600 : 400,
                        color:
                          state === "done"
                            ? "rgba(255,255,255,0.7)"
                            : state === "active"
                            ? "var(--sky-light)"
                            : "rgba(255,255,255,0.3)",
                      }}
                    >
                      {label}
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-outfit)",
                        fontSize: "0.72rem",
                        color: "rgba(255,255,255,0.3)",
                        marginTop: "1px",
                      }}
                    >
                      {sub}
                    </div>
                  </div>
                </div>
              ))}

              {/* Card footer */}
              <div
                style={{
                  borderTop: "1px solid rgba(255,255,255,0.08)",
                  marginTop: "14px",
                  paddingTop: "12px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "4px 10px",
                    background: "rgba(59,158,255,0.15)",
                    borderRadius: "100px",
                    fontFamily: "var(--font-outfit)",
                    fontSize: "0.72rem",
                    fontWeight: 600,
                    color: "var(--sky)",
                  }}
                >
                  <span className="status-dot" style={{ width: "5px", height: "5px" }} />
                  In Transit
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-jetbrains)",
                    fontSize: "0.72rem",
                    color: "rgba(255,255,255,0.35)",
                  }}
                >
                  ETA 04 Mar 2026
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Services Ticker ──────────────────────────────────────────── */}
      <div
        style={{
          background: "var(--sky)",
          padding: "14px 0",
          overflow: "hidden",
        }}
      >
        <div className="ticker-track">
          {tickerContent.map((item, i) => (
            <span
              key={i}
              style={{
                fontFamily: "var(--font-outfit)",
                fontSize: "0.82rem",
                fontWeight: 600,
                color: "white",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
                padding: "0 32px",
                display: "inline-flex",
                alignItems: "center",
                gap: "32px",
              }}
            >
              {item}
              <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.6rem" }}>◆</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── About / Network SVG ──────────────────────────────────────── */}
      <div
        style={{
          background: "var(--surface)",
          padding: "100px 5%",
          borderTop: "1px solid var(--border-light)",
          borderBottom: "1px solid var(--border-light)",
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "64px",
            alignItems: "center",
          }}
        >
          {/* Text */}
          <div>
            <div className="eyebrow">Who We Are</div>
            <h2
              style={{
                fontFamily: "var(--font-syne)",
                fontSize: "clamp(1.8rem, 3vw, 2.4rem)",
                fontWeight: 700,
                marginTop: "16px",
                marginBottom: "20px",
                letterSpacing: "-0.01em",
              }}
            >
              Built to simplify freight for Malaysian businesses
            </h2>
            <p
              style={{
                fontFamily: "var(--font-outfit)",
                fontSize: "0.95rem",
                fontWeight: 300,
                color: "var(--text-mid)",
                lineHeight: 1.8,
                marginBottom: "16px",
              }}
            >
              Founded in 2018, AcceleFreight is a Malaysian incorporated freight
              forwarder and Multimodal Transport Operator (MTO). We bring
              greater visibility, faster response times, and reduced human error
              to every shipment.
            </p>
            <p
              style={{
                fontFamily: "var(--font-outfit)",
                fontSize: "0.95rem",
                fontWeight: 300,
                color: "var(--text-mid)",
                lineHeight: 1.8,
                marginBottom: "32px",
              }}
            >
              We operate in Malaysia, handling all imports and exports through
              our trusted global partner network — exclusively for registered
              corporate and business entities.
            </p>
            <Link href="/about" className="btn-outline">
              Learn About Us
            </Link>
          </div>

          {/* Logistics Network SVG */}
          <div>
            <svg
              viewBox="0 0 480 340"
              style={{ width: "100%", maxWidth: "480px" }}
              aria-label="AcceleFreight logistics network diagram"
            >
              {/* Connection lines */}
              <line x1="80" y1="80" x2="200" y2="170" stroke="var(--sky)" strokeWidth="1.5" strokeDasharray="6 4" opacity="0.4" />
              <line x1="80" y1="260" x2="200" y2="170" stroke="var(--sky)" strokeWidth="1.5" strokeDasharray="6 4" opacity="0.4" />
              <line x1="200" y1="170" x2="340" y2="90" stroke="var(--sky)" strokeWidth="1.5" strokeDasharray="6 4" opacity="0.4" />
              <line x1="200" y1="170" x2="340" y2="170" stroke="var(--sky)" strokeWidth="1.5" strokeDasharray="6 4" opacity="0.4" />
              <line x1="200" y1="170" x2="340" y2="250" stroke="var(--sky)" strokeWidth="1.5" strokeDasharray="6 4" opacity="0.4" />
              <line x1="340" y1="90" x2="420" y2="65" stroke="var(--sky)" strokeWidth="1" opacity="0.25" />
              <line x1="340" y1="90" x2="420" y2="115" stroke="var(--sky)" strokeWidth="1" opacity="0.25" />
              <line x1="340" y1="250" x2="420" y2="225" stroke="var(--sky)" strokeWidth="1" opacity="0.25" />
              <line x1="340" y1="250" x2="420" y2="275" stroke="var(--sky)" strokeWidth="1" opacity="0.25" />

              {/* Animated dots */}
              <circle r="4" fill="var(--sky)" opacity="0.9">
                <animateMotion dur="3s" repeatCount="indefinite" begin="0s">
                  <mpath href="#path-air" />
                </animateMotion>
              </circle>
              <circle r="4" fill="var(--sky)" opacity="0.9">
                <animateMotion dur="4.5s" repeatCount="indefinite" begin="1s">
                  <mpath href="#path-sea" />
                </animateMotion>
              </circle>
              <circle r="3.5" fill="var(--sky-light)" opacity="0.8">
                <animateMotion dur="2.5s" repeatCount="indefinite" begin="0.5s">
                  <mpath href="#path-hub-b" />
                </animateMotion>
              </circle>
              <circle r="3.5" fill="var(--sky-light)" opacity="0.8">
                <animateMotion dur="2s" repeatCount="indefinite" begin="1.5s">
                  <mpath href="#path-hub-a" />
                </animateMotion>
              </circle>
              <circle r="3.5" fill="var(--sky-light)" opacity="0.8">
                <animateMotion dur="3s" repeatCount="indefinite" begin="2.5s">
                  <mpath href="#path-hub-c" />
                </animateMotion>
              </circle>
              <path id="path-air" d="M80,80 L200,170" fill="none" visibility="hidden" />
              <path id="path-sea" d="M80,260 L200,170" fill="none" visibility="hidden" />
              <path id="path-hub-a" d="M200,170 L340,90" fill="none" visibility="hidden" />
              <path id="path-hub-b" d="M200,170 L340,170" fill="none" visibility="hidden" />
              <path id="path-hub-c" d="M200,170 L340,250" fill="none" visibility="hidden" />

              {/* Air origin node */}
              <circle cx="80" cy="80" r="30" fill="white" stroke="var(--border)" strokeWidth="1.5" />
              <circle cx="80" cy="80" r="30" fill="white" stroke="var(--sky)" strokeWidth="1.5" opacity="0.4" />
              <path d="M74,77 l-8,4 2,1.5 2-1.5 1.5,2.5-3.5,1.5 1.5,2 4-0.5 2,3 1.5-0.5-0.5-3.5 3-2.5-0.5-2-3.5,1.5-1.5-3z" fill="var(--sky)" opacity="0.85" />
              <text x="80" y="123" textAnchor="middle" fontFamily="Outfit,sans-serif" fontSize="9" fontWeight="500" fill="var(--text-muted)" letterSpacing="0.04em">AIR ORIGIN</text>

              {/* Sea origin node */}
              <circle cx="80" cy="260" r="30" fill="white" stroke="var(--border)" strokeWidth="1.5" />
              <circle cx="80" cy="260" r="30" fill="white" stroke="var(--sky)" strokeWidth="1.5" opacity="0.4" />
              <circle cx="80" cy="252" r="5" fill="none" stroke="var(--sky)" strokeWidth="1.8" />
              <line x1="80" y1="257" x2="80" y2="272" stroke="var(--sky)" strokeWidth="1.8" />
              <path d="M70,268 Q80,275 90,268" stroke="var(--sky)" strokeWidth="1.8" fill="none" />
              <line x1="70" y1="253" x2="90" y2="253" stroke="var(--sky)" strokeWidth="1.5" />
              <text x="80" y="303" textAnchor="middle" fontFamily="Outfit,sans-serif" fontSize="9" fontWeight="500" fill="var(--text-muted)" letterSpacing="0.04em">SEA ORIGIN</text>

              {/* AF Hub */}
              <polygon points="200,140 224,154 224,183 200,197 176,183 176,154" fill="var(--sky)" />
              <polygon points="200,140 224,154 224,183 200,197 176,183 176,154" fill="white" opacity="0.08" />
              <path d="M188,169 L195,161 L195,165 L206,165 L206,161 L213,169 L206,177 L206,173 L195,173 L195,177 Z" fill="white" />
              <text x="200" y="213" textAnchor="middle" fontFamily="Outfit,sans-serif" fontSize="9.5" fontWeight="600" fill="var(--text-mid)" letterSpacing="0.04em">HUB · MY</text>

              {/* Distribution node */}
              <circle cx="340" cy="90" r="24" fill="white" stroke="var(--border)" strokeWidth="1.5" />
              <circle cx="340" cy="90" r="24" fill="white" stroke="var(--sky)" strokeWidth="1.5" opacity="0.35" />
              <rect x="326" y="84" width="13" height="9" rx="1" fill="none" stroke="var(--sky)" strokeWidth="1.5" />
              <polygon points="339,84 348,84 351,88 351,93 339,93" fill="none" stroke="var(--sky)" strokeWidth="1.5" />
              <circle cx="330" cy="94" r="2" fill="var(--sky)" />
              <circle cx="347" cy="94" r="2" fill="var(--sky)" />
              <text x="340" y="127" textAnchor="middle" fontFamily="Outfit,sans-serif" fontSize="8.5" fontWeight="500" fill="var(--text-muted)" letterSpacing="0.04em">DISTRIBUTION</text>

              {/* Warehousing node */}
              <circle cx="340" cy="170" r="24" fill="white" stroke="var(--border)" strokeWidth="1.5" />
              <circle cx="340" cy="170" r="24" fill="white" stroke="var(--sky)" strokeWidth="1.5" opacity="0.35" />
              <path d="M327,163 L340,156 L353,163" stroke="var(--sky)" strokeWidth="1.5" fill="none" />
              <rect x="328" y="163" width="24" height="12" fill="none" stroke="var(--sky)" strokeWidth="1.5" />
              <rect x="336" y="163" width="8" height="12" fill="var(--sky-pale)" stroke="var(--sky)" strokeWidth="1" />
              <text x="340" y="207" textAnchor="middle" fontFamily="Outfit,sans-serif" fontSize="8.5" fontWeight="500" fill="var(--text-muted)" letterSpacing="0.04em">WAREHOUSING</text>

              {/* Clearance node */}
              <circle cx="340" cy="250" r="24" fill="white" stroke="var(--border)" strokeWidth="1.5" />
              <circle cx="340" cy="250" r="24" fill="white" stroke="var(--sky)" strokeWidth="1.5" opacity="0.35" />
              <rect x="330" y="241" width="14" height="18" rx="2" fill="none" stroke="var(--sky)" strokeWidth="1.5" />
              <path d="M333,252 l3,3 5-6" stroke="var(--sky)" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              <text x="340" y="287" textAnchor="middle" fontFamily="Outfit,sans-serif" fontSize="8.5" fontWeight="500" fill="var(--text-muted)" letterSpacing="0.04em">CLEARANCE</text>

              {/* Endpoints */}
              {[65, 115, 225, 275].map((y) => (
                <circle key={y} cx="420" cy={y} r="10" fill="var(--sky-pale)" stroke="var(--sky)" strokeWidth="1" opacity="0.7" />
              ))}

              {/* Legend */}
              <rect x="10" y="310" width="460" height="24" rx="4" fill="white" opacity="0.7" />
              <circle cx="25" cy="322" r="3.5" fill="var(--sky)" />
              <text x="34" y="326" fontFamily="Outfit,sans-serif" fontSize="8" fill="var(--text-muted)">Active routes</text>
              <line x1="110" y1="322" x2="130" y2="322" stroke="var(--sky)" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.5" />
              <text x="136" y="326" fontFamily="Outfit,sans-serif" fontSize="8" fill="var(--text-muted)">Connection</text>
              <polygon points="220,318 228,322 220,326 212,322" fill="var(--sky)" />
              <text x="234" y="326" fontFamily="Outfit,sans-serif" fontSize="8" fill="var(--text-muted)">AF Hub (Malaysia)</text>
              <circle cx="340" cy="322" r="5" fill="white" stroke="var(--sky)" strokeWidth="1.2" opacity="0.6" />
              <text x="350" y="326" fontFamily="Outfit,sans-serif" fontSize="8" fill="var(--text-muted)">Service node</text>
            </svg>
            <p
              style={{
                textAlign: "center",
                fontSize: "0.78rem",
                color: "var(--text-muted)",
                marginTop: "12px",
                fontWeight: 300,
              }}
            >
              Origin → AcceleFreight Malaysia → Final Destination
            </p>
          </div>
        </div>
      </div>

      {/* ── Services Grid ────────────────────────────────────────────── */}
      <div style={{ padding: "100px 5%", background: "var(--white)" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <div className="eyebrow">What We Do</div>
          <h2
            style={{
              fontFamily: "var(--font-syne)",
              fontSize: "clamp(1.8rem, 3vw, 2.4rem)",
              fontWeight: 700,
              marginTop: "16px",
              marginBottom: "12px",
              letterSpacing: "-0.01em",
            }}
          >
            Comprehensive logistics services
          </h2>
          <p
            style={{
              fontFamily: "var(--font-outfit)",
              fontSize: "0.95rem",
              fontWeight: 300,
              color: "var(--text-mid)",
              marginBottom: "48px",
              maxWidth: "520px",
            }}
          >
            From port to door, we cover every leg of your supply chain with
            precision and transparency.
          </p>

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
            {SERVICES.map(({ icon, title, desc }) => (
              <Link
                key={title}
                href="/services"
                style={{ textDecoration: "none" }}
              >
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
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" dangerouslySetInnerHTML={{ __html: icon }} />
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
            ))}
          </div>
        </div>
      </div>

      {/* ── CTA Band ────────────────────────────────────────────────── */}
      <div
        style={{
          background: "var(--slate)",
          padding: "80px 5%",
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
        }}
        className="grid-texture"
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at center, rgba(59,158,255,0.12) 0%, transparent 60%)",
            pointerEvents: "none",
          }}
        />
        <div style={{ position: "relative", maxWidth: "600px", margin: "0 auto" }}>
          <h2
            style={{
              fontFamily: "var(--font-syne)",
              fontSize: "clamp(1.8rem, 3vw, 2.4rem)",
              fontWeight: 700,
              color: "white",
              marginBottom: "16px",
              letterSpacing: "-0.01em",
            }}
          >
            Ready to simplify your logistics?
          </h2>
          <p
            style={{
              fontFamily: "var(--font-outfit)",
              fontSize: "0.95rem",
              fontWeight: 300,
              color: "rgba(255,255,255,0.55)",
              marginBottom: "36px",
              lineHeight: 1.7,
            }}
          >
            Get in touch with our team for a consultation on your freight
            requirements.
          </p>
          <Link href="/contact" className="btn-white">
            Contact Us Today
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </>
  );
}
