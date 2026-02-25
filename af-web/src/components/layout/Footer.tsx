import Link from "next/link";
import { LogoLockup } from "@/components/shared/Logo";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About Us" },
  { href: "/services", label: "Services" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
];

export default function Footer() {
  return (
    <footer
      style={{
        background: "var(--slate)",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        padding: "56px 5% 32px",
      }}
    >
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "48px",
          marginBottom: "48px",
        }}
      >
        {/* Brand column */}
        <div>
          <LogoLockup variant="dark" size="md" />
          <p
            style={{
              marginTop: "16px",
              fontFamily: "var(--font-outfit), sans-serif",
              fontSize: "0.85rem",
              color: "rgba(255,255,255,0.5)",
              lineHeight: 1.7,
              maxWidth: "240px",
            }}
          >
            Malaysian freight forwarder and multimodal transport operator.
            Import, export, and everything in between.
          </p>
          <p
            style={{
              marginTop: "16px",
              fontFamily: "var(--font-jetbrains), monospace",
              fontSize: "0.75rem",
              color: "rgba(255,255,255,0.3)",
            }}
          >
            Reg. No. 1292343-T
          </p>
        </div>

        {/* Navigation column */}
        <div>
          <p
            style={{
              fontFamily: "var(--font-outfit), sans-serif",
              fontSize: "0.75rem",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.35)",
              marginBottom: "16px",
            }}
          >
            Navigation
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                style={{
                  fontFamily: "var(--font-outfit), sans-serif",
                  fontSize: "0.88rem",
                  color: "rgba(255,255,255,0.6)",
                  textDecoration: "none",
                  transition: "color 0.15s ease",
                }}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>

        {/* Contact column */}
        <div>
          <p
            style={{
              fontFamily: "var(--font-outfit), sans-serif",
              fontSize: "0.75rem",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.35)",
              marginBottom: "16px",
            }}
          >
            Contact
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <a
              href="tel:+60128208565"
              style={{
                fontFamily: "var(--font-outfit), sans-serif",
                fontSize: "0.88rem",
                color: "rgba(255,255,255,0.6)",
                textDecoration: "none",
              }}
            >
              +60 12 820 8565
            </a>
            <a
              href="mailto:info@accelefreight.com"
              style={{
                fontFamily: "var(--font-outfit), sans-serif",
                fontSize: "0.88rem",
                color: "rgba(255,255,255,0.6)",
                textDecoration: "none",
              }}
            >
              info@accelefreight.com
            </a>
            <p
              style={{
                fontFamily: "var(--font-outfit), sans-serif",
                fontSize: "0.85rem",
                color: "rgba(255,255,255,0.4)",
                lineHeight: 1.6,
              }}
            >
              3, Jalan PJU 1A/8<br />
              Taman Perindustrian Jaya<br />
              Ara Damansara, 47301<br />
              Petaling Jaya, Selangor
            </p>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          paddingTop: "24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-outfit), sans-serif",
            fontSize: "0.8rem",
            color: "rgba(255,255,255,0.3)",
          }}
        >
          © 2025 Accele Freight Sdn Bhd (1292343-T). All rights reserved.
        </p>
        <a
          href="https://alfred.accelefreight.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontFamily: "var(--font-outfit), sans-serif",
            fontSize: "0.8rem",
            color: "rgba(59,158,255,0.6)",
            textDecoration: "none",
          }}
        >
          Dashboard Login →
        </a>
      </div>
    </footer>
  );
}
