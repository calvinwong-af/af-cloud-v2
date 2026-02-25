import type { Metadata } from "next";
import Link from "next/link";
import ServicesGrid from "@/components/home/ServicesGrid";

export const metadata: Metadata = {
  title: "AcceleFreight — Your Complete Logistics Solution",
  description:
    "AcceleFreight provides end-to-end freight forwarding and 3PL services for businesses operating in and out of Malaysia. Sea freight, air freight, customs clearance, and more.",
};

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
  const tickerContent = [...TICKER_ITEMS, ...TICKER_ITEMS];

  return (
    <>
      {/* Hero */}
      <div
        style={{
          background: "var(--slate)",
          marginTop: "68px",
          minHeight: "calc(100vh - 68px)",
          position: "relative",
          display: "flex",
          alignItems: "center",
          padding: "80px 5%",
        }}
        className="grid-texture"
      >
        <div style={{ position: "absolute", left: "-100px", top: "30%", width: "600px", height: "600px", background: "radial-gradient(circle, rgba(59,158,255,0.08) 0%, transparent 65%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", right: "-100px", bottom: "10%", width: "500px", height: "500px", background: "radial-gradient(circle, rgba(59,158,255,0.06) 0%, transparent 65%)", pointerEvents: "none" }} />

        <div style={{ width: "100%", maxWidth: "860px", margin: "0 auto" }}>

          {/* Copy */}
          <div style={{ marginBottom: "48px" }}>
            <div
              className="fade-up fade-1"
              style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "6px 14px", background: "rgba(59,158,255,0.1)", border: "1px solid rgba(59,158,255,0.25)", borderRadius: "100px", marginBottom: "28px" }}
            >
              <span className="status-dot" />
              <span style={{ fontFamily: "var(--font-outfit)", fontSize: "0.8rem", fontWeight: 500, color: "rgba(255,255,255,0.75)" }}>
                Malaysian Freight Forwarder &amp; 3PL
              </span>
            </div>

            <h1
              className="fade-up fade-2"
              style={{ fontFamily: "var(--font-syne)", fontSize: "clamp(2.8rem, 6vw, 4.5rem)", fontWeight: 800, color: "white", lineHeight: 1.05, letterSpacing: "-0.03em", marginBottom: "24px", maxWidth: "700px" }}
            >
              Your complete{" "}
              <span style={{ color: "var(--sky)" }}>logistics solution.</span>
            </h1>

            <p
              className="fade-up fade-3"
              style={{ fontFamily: "var(--font-outfit)", fontSize: "1.05rem", fontWeight: 300, color: "rgba(255,255,255,0.6)", lineHeight: 1.8, marginBottom: "36px", maxWidth: "520px" }}
            >
              AcceleFreight provides end-to-end freight forwarding and third-party logistics services for businesses operating in and out of Malaysia. Sea, air, distribution — we handle it all.
            </p>

            <div className="fade-up fade-4" style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "48px" }}>
              <a href="/contact" className="btn-primary">
                Get In Touch
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
              </a>
              <a href="/services" className="btn-outline" style={{ borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)" }}>
                Our Services
              </a>
            </div>

            <div className="fade-up fade-5" style={{ display: "flex", gap: "40px", flexWrap: "wrap" }}>
              {[
                { num: "2018", label: "Established" },
                { num: "9+", label: "Service Lines" },
                { num: "2,000+", label: "Quotations Processed" },
              ].map(({ num, label }) => (
                <div key={label}>
                  <div style={{ fontFamily: "var(--font-syne)", fontSize: "1.6rem", fontWeight: 700, color: "white", lineHeight: 1 }}>{num}</div>
                  <div style={{ fontFamily: "var(--font-outfit)", fontSize: "0.78rem", color: "rgba(255,255,255,0.4)", marginTop: "4px", fontWeight: 400 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Shipment Tracker Card — horizontal strip */}
          <div
            className="fade-up fade-5"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(59,158,255,0.25)",
              borderRadius: "10px",
              padding: "20px 24px",
              display: "flex",
              alignItems: "center",
              gap: "32px",
              flexWrap: "wrap",
            }}
          >
            {/* Label + ID */}
            <div style={{ flexShrink: 0 }}>
              <div style={{ fontFamily: "var(--font-outfit)", fontSize: "0.7rem", fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "4px" }}>Live Tracking</div>
              <div style={{ fontFamily: "var(--font-jetbrains)", fontSize: "0.85rem", color: "var(--sky)" }}>AF-2026-08841</div>
            </div>

            <div style={{ width: "1px", height: "36px", background: "rgba(255,255,255,0.1)", flexShrink: 0 }} />

            {/* Route */}
            <div style={{ flexShrink: 0 }}>
              <div style={{ fontFamily: "var(--font-outfit)", fontSize: "0.7rem", color: "rgba(255,255,255,0.4)", marginBottom: "4px" }}>Route</div>
              <div style={{ fontFamily: "var(--font-outfit)", fontSize: "0.85rem", color: "rgba(255,255,255,0.85)", fontWeight: 500 }}>Port Klang → Shanghai</div>
            </div>

            <div style={{ width: "1px", height: "36px", background: "rgba(255,255,255,0.1)", flexShrink: 0 }} />

            {/* Mode */}
            <div style={{ flexShrink: 0 }}>
              <div style={{ fontFamily: "var(--font-outfit)", fontSize: "0.7rem", color: "rgba(255,255,255,0.4)", marginBottom: "4px" }}>Mode</div>
              <div style={{ fontFamily: "var(--font-outfit)", fontSize: "0.85rem", color: "rgba(255,255,255,0.85)", fontWeight: 500 }}>Sea Freight · FCL</div>
            </div>

            <div style={{ width: "1px", height: "36px", background: "rgba(255,255,255,0.1)", flexShrink: 0 }} />

            {/* Timeline dots */}
            <div style={{ flex: 1, minWidth: "200px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0" }}>
                {[
                  { label: "Booked", done: true },
                  { label: "Cleared", done: true },
                  { label: "In Transit", done: false, active: true },
                  { label: "Delivered", done: false },
                ].map((step, i, arr) => (
                  <div key={step.label} style={{ display: "flex", alignItems: "center", flex: i < arr.length - 1 ? 1 : 0 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                      <div style={{
                        width: "10px", height: "10px", borderRadius: "50%", flexShrink: 0,
                        background: step.done || step.active ? "var(--sky)" : "rgba(255,255,255,0.15)",
                        boxShadow: step.active ? "0 0 0 3px rgba(59,158,255,0.25)" : "none",
                      }} />
                      <span style={{ fontFamily: "var(--font-outfit)", fontSize: "0.65rem", color: step.done || step.active ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.25)", whiteSpace: "nowrap" }}>{step.label}</span>
                    </div>
                    {i < arr.length - 1 && (
                      <div style={{ flex: 1, height: "1px", background: step.done ? "var(--sky)" : "rgba(255,255,255,0.1)", margin: "0 4px", marginBottom: "16px" }} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Status badge */}
            <div style={{ flexShrink: 0, marginLeft: "auto" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "5px 12px", background: "rgba(59,158,255,0.15)", borderRadius: "100px", fontFamily: "var(--font-outfit)", fontSize: "0.75rem", fontWeight: 600, color: "var(--sky)" }}>
                <span className="status-dot" style={{ width: "5px", height: "5px" }} />
                In Transit · ETA 04 Mar
              </span>
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
              <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.6rem" }}>
                ◆
              </span>
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

          <ServicesGrid />
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
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </>
  );
}
