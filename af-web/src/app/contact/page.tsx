"use client";

import { useState } from "react";

const SERVICES = [
  "Sea Freight (FCL)",
  "Sea Freight (LCL)",
  "Air Freight",
  "Cross-Border Trucking",
  "Distribution Services",
  "Warehousing",
  "Cold Storage",
  "Customs Clearance",
  "EOR / IOR Services",
  "Outsourced Logistics Management & Consultation",
  "General Enquiry",
];

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(true);
    (e.target as HTMLFormElement).reset();
  }

  return (
    <>
      {/* Banner */}
      <div className="page-banner" style={{ marginTop: "68px" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", position: "relative", zIndex: 1 }}>
          <div className="page-tag">Get In Touch</div>
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
            Contact Us
          </h1>
          <p
            style={{
              fontFamily: "var(--font-outfit)",
              fontSize: "1rem",
              fontWeight: 300,
              color: "rgba(255,255,255,0.55)",
              maxWidth: "480px",
              lineHeight: 1.7,
            }}
          >
            Reach out for a quotation, general enquiry, or to discuss your
            freight requirements. We typically respond within 1–2 business days.
          </p>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "80px 5%", background: "var(--white)" }}>
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "1fr 1.6fr",
            gap: "64px",
            alignItems: "start",
          }}
        >
          {/* Contact info */}
          <div>
            <h2
              style={{
                fontFamily: "var(--font-syne)",
                fontSize: "1.3rem",
                fontWeight: 700,
                marginBottom: "32px",
                letterSpacing: "-0.01em",
              }}
            >
              Our contact details
            </h2>

            {[
              {
                label: "Phone",
                value: "+60 12 820 8565",
                href: "tel:+60128208565",
                icon: `<path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 014.3 12.1a19.79 19.79 0 01-3.07-8.67A2 2 0 013.22 1.5h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L7.09 9.91a16 16 0 006 6l1.77-1.77a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0121.5 16.92z"/>`,
              },
              {
                label: "Email",
                value: "info@accelefreight.com",
                href: "mailto:info@accelefreight.com",
                icon: `<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>`,
              },
              {
                label: "Address",
                value: "3, Jalan PJU 1A/8, Taman Perindustrian Jaya, Ara Damansara, 47301 Petaling Jaya, Selangor, Malaysia",
                href: "https://maps.google.com/?q=3+Jalan+PJU+1A/8+Taman+Perindustrian+Jaya+Ara+Damansara+47301+Petaling+Jaya+Selangor",
                icon: `<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>`,
              },
            ].map(({ label, value, href, icon }) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  gap: "14px",
                  marginBottom: "24px",
                  alignItems: "flex-start",
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
                    color: "var(--sky)",
                    flexShrink: 0,
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" dangerouslySetInnerHTML={{ __html: icon }} />
                </div>
                <div>
                  <div
                    style={{
                      fontFamily: "var(--font-outfit)",
                      fontSize: "0.7rem",
                      fontWeight: 600,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: "var(--sky)",
                      marginBottom: "4px",
                    }}
                  >
                    {label}
                  </div>
                  <a
                    href={href}
                    target={label === "Address" ? "_blank" : undefined}
                    rel={label === "Address" ? "noopener noreferrer" : undefined}
                    style={{
                      fontFamily: "var(--font-outfit)",
                      fontSize: "0.9rem",
                      fontWeight: 300,
                      color: "var(--text-mid)",
                      textDecoration: "none",
                      lineHeight: 1.6,
                    }}
                  >
                    {value}
                  </a>
                </div>
              </div>
            ))}
          </div>

          {/* Form */}
          <div>
            <form onSubmit={handleSubmit} style={{ display: "grid", gap: "18px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px" }}>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontFamily: "var(--font-outfit)",
                      fontSize: "0.72rem",
                      fontWeight: 600,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "var(--text-muted)",
                      marginBottom: "6px",
                    }}
                  >
                    Full Name *
                  </label>
                  <input type="text" className="af-input" placeholder="Your full name" required />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontFamily: "var(--font-outfit)",
                      fontSize: "0.72rem",
                      fontWeight: 600,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "var(--text-muted)",
                      marginBottom: "6px",
                    }}
                  >
                    Company Name *
                  </label>
                  <input type="text" className="af-input" placeholder="Your company" required />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px" }}>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontFamily: "var(--font-outfit)",
                      fontSize: "0.72rem",
                      fontWeight: 600,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "var(--text-muted)",
                      marginBottom: "6px",
                    }}
                  >
                    Email Address *
                  </label>
                  <input type="email" className="af-input" placeholder="your@email.com" required />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontFamily: "var(--font-outfit)",
                      fontSize: "0.72rem",
                      fontWeight: 600,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "var(--text-muted)",
                      marginBottom: "6px",
                    }}
                  >
                    Phone Number
                  </label>
                  <input type="tel" className="af-input" placeholder="+60 12 345 6789" />
                </div>
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontFamily: "var(--font-outfit)",
                    fontSize: "0.72rem",
                    fontWeight: 600,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--text-muted)",
                    marginBottom: "6px",
                  }}
                >
                  Service Enquiry
                </label>
                <select className="af-input" style={{ cursor: "pointer" }}>
                  <option value="">Select a service (optional)</option>
                  {SERVICES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontFamily: "var(--font-outfit)",
                    fontSize: "0.72rem",
                    fontWeight: 600,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--text-muted)",
                    marginBottom: "6px",
                  }}
                >
                  Message *
                </label>
                <textarea
                  className="af-input"
                  placeholder="Tell us about your shipment or enquiry..."
                  required
                  style={{ resize: "vertical", minHeight: "120px" }}
                />
              </div>

              <button type="submit" className="btn-primary" style={{ width: "fit-content" }}>
                Send Message
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>

              {submitted && (
                <div
                  style={{
                    padding: "14px 18px",
                    background: "rgba(59,158,255,0.08)",
                    border: "1px solid rgba(59,158,255,0.25)",
                    borderRadius: "6px",
                    fontFamily: "var(--font-outfit)",
                    fontSize: "0.875rem",
                    color: "var(--sky)",
                  }}
                >
                  ✓ Thank you for your message. Our team will be in touch within 1–2 business days.
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Google Map */}
        <div style={{ maxWidth: "1200px", margin: "64px auto 0" }}>
          <div className="eyebrow" style={{ marginBottom: "16px" }}>Find Us</div>
          <div
            style={{
              borderRadius: "8px",
              overflow: "hidden",
              border: "1px solid var(--border)",
            }}
          >
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3984.0681035596867!2d101.5879405!3d3.0764888999999997!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x31cc4db2c8b4d46f%3A0xdc661123e9b850d!2sAcceleFreight%20Sdn%20Bhd!5e0!3m2!1sen!2smy!4v1771937021248!5m2!1sen!2smy"
              style={{
                display: "block",
                width: "100%",
                height: "360px",
                border: 0,
                filter: "invert(92%) hue-rotate(180deg) saturate(0.85) brightness(0.95)",
              }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="AcceleFreight Office – Ara Damansara, Petaling Jaya"
            />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "8px",
              marginTop: "12px",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-outfit)",
                fontSize: "0.82rem",
                color: "var(--text-muted)",
                fontWeight: 300,
              }}
            >
              3, Jalan PJU 1A/8, Taman Perindustrian Jaya, Ara Damansara, 47301 Petaling Jaya, Selangor, Malaysia.
            </span>
            <a
              href="https://maps.google.com/?q=3+Jalan+PJU+1A/8+Taman+Perindustrian+Jaya+Ara+Damansara+47301+Petaling+Jaya+Selangor"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontFamily: "var(--font-outfit)",
                fontSize: "0.82rem",
                color: "var(--sky)",
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              Open in Google Maps →
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
