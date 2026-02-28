import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "AcceleFreight was founded in 2018 with a clear goal: to improve how shipments are managed for all parties. Learn about our story, values, and what drives us.",
};

const VALUES = [
  {
    icon: `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`,
    title: "Transparency",
    desc: "Customers deserve to know exactly what they are paying for and why. No hidden costs, no surprises.",
  },
  {
    icon: `<polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>`,
    title: "Efficiency",
    desc: "Reducing lead times and eliminating unnecessary back-and-forth is at the core of how we operate every day.",
  },
  {
    icon: `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>`,
    title: "Reliability",
    desc: "Your cargo is your business. We treat every shipment with the care and accountability it deserves.",
  },
  {
    icon: `<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>`,
    title: "Accessibility",
    desc: "Freight management shouldn't be a privilege. We make professional logistics services accessible to businesses of all sizes.",
  },
];

export default function AboutPage() {
  return (
    <>
      {/* Banner */}
      <div className="page-banner" style={{ marginTop: "68px" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", position: "relative", zIndex: 1 }}>
          <div className="page-tag">Our Company</div>
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
            About AcceleFreight
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
            A Malaysian freight forwarder built on the belief that logistics
            should be transparent, efficient, and accessible to every business.
          </p>
        </div>
      </div>

      {/* Story + Values */}
      <div style={{ padding: "80px 5%", background: "var(--white)" }}>
        <div
          className="about-grid"
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "64px",
            alignItems: "start",
          }}
        >
          {/* Story */}
          <div>
            <div className="eyebrow">Our Story</div>
            <h2
              style={{
                fontFamily: "var(--font-syne)",
                fontSize: "clamp(1.6rem, 2.5vw, 2rem)",
                fontWeight: 700,
                marginTop: "16px",
                marginBottom: "24px",
                letterSpacing: "-0.01em",
              }}
            >
              Established in 2018
            </h2>
            {[
              `AcceleFreight was founded in late 2018 with a clear goal: to improve how shipments in freight forwarding are managed for all parties — both customers and service providers.`,
              `We set out to bring greater visibility, faster response times, and reduced human error to the freight forwarding process — for customers of all sizes, with no additional cost.`,
              `AcceleFreight is a Malaysian incorporated freight forwarder and Multimodal Transport Operator (MTO). We provide services comparable to any established freight forwarder, with the added advantage of a dedicated team managing all your shipment transactions — so you only need to deal with us.`,
              `We currently operate in Malaysia and accept all shipments going in and out of the country, in cooperation with our trusted global partners. Our services are available exclusively to legally registered corporate and business entities.`,
            ].map((p, i) => (
              <p
                key={i}
                style={{
                  fontFamily: "var(--font-outfit)",
                  fontSize: "0.95rem",
                  fontWeight: 300,
                  color: "var(--text-mid)",
                  lineHeight: 1.85,
                  marginBottom: "16px",
                }}
              >
                {p}
              </p>
            ))}
          </div>

          {/* Values */}
          <div>
            <div className="eyebrow">Our Values</div>
            <div
              style={{
                marginTop: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              {VALUES.map(({ icon, title, desc }) => (
                <div
                  key={title}
                  className="af-card"
                  style={{ padding: "20px" }}
                >
                  <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
                    <div
                      style={{
                        width: "36px",
                        height: "36px",
                        background: "var(--sky-pale)",
                        borderRadius: "8px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--sky)",
                        flexShrink: 0,
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" dangerouslySetInnerHTML={{ __html: icon }} />
                    </div>
                    <div>
                      <h3
                        style={{
                          fontFamily: "var(--font-syne)",
                          fontSize: "0.95rem",
                          fontWeight: 700,
                          marginBottom: "6px",
                        }}
                      >
                        {title}
                      </h3>
                      <p
                        style={{
                          fontFamily: "var(--font-outfit)",
                          fontSize: "0.85rem",
                          fontWeight: 300,
                          color: "var(--text-mid)",
                          lineHeight: 1.7,
                        }}
                      >
                        {desc}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Stats band */}
      <div
        style={{
          background: "var(--surface)",
          borderTop: "1px solid var(--border-light)",
          borderBottom: "1px solid var(--border-light)",
          padding: "56px 5%",
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: "40px",
            textAlign: "center",
          }}
        >
          {[
            { num: "2018", label: "Year Founded" },
            { num: "9", label: "Service Lines" },
            { num: "2,000+", label: "Quotations Processed" },
            { num: "60+", label: "Countries Served" },
          ].map(({ num, label }) => (
            <div key={label}>
              <div
                style={{
                  fontFamily: "var(--font-syne)",
                  fontSize: "2.2rem",
                  fontWeight: 800,
                  color: "var(--sky)",
                  letterSpacing: "-0.02em",
                }}
              >
                {num}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-outfit)",
                  fontSize: "0.82rem",
                  color: "var(--text-muted)",
                  marginTop: "6px",
                  fontWeight: 400,
                }}
              >
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA Band */}
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
            background: "radial-gradient(circle at center, rgba(59,158,255,0.12) 0%, transparent 60%)",
            pointerEvents: "none",
          }}
        />
        <div style={{ position: "relative", maxWidth: "560px", margin: "0 auto" }}>
          <h2
            style={{
              fontFamily: "var(--font-syne)",
              fontSize: "clamp(1.6rem, 3vw, 2.2rem)",
              fontWeight: 700,
              color: "white",
              marginBottom: "16px",
              letterSpacing: "-0.01em",
            }}
          >
            Ready to work with us?
          </h2>
          <p
            style={{
              fontFamily: "var(--font-outfit)",
              fontSize: "0.95rem",
              fontWeight: 300,
              color: "rgba(255,255,255,0.55)",
              marginBottom: "32px",
            }}
          >
            Get in touch to discuss how AcceleFreight can support your business.
          </p>
          <Link href="/contact" className="btn-white">
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
