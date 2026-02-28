"use client";

import { useState } from "react";

const COMPANY_FAQS = [
  {
    q: "What type of company is AcceleFreight?",
    a: "AcceleFreight (Accele Freight Sdn Bhd, Reg. No. 1292343-T) is a Malaysian incorporated freight forwarder and Multimodal Transport Operator (MTO). We were founded in late 2018 and operate in Malaysia, handling all import and export shipments in cooperation with our trusted global partners.",
  },
  {
    q: "Where do you operate?",
    a: "We are based in Ara Damansara, Petaling Jaya, Selangor, Malaysia. We handle all imports and exports going in and out of Malaysia. For international legs of a shipment, we work with a network of trusted global partners.",
  },
  {
    q: "How do I get started with AcceleFreight?",
    a: "Simply reach out to us via our Contact page or email us at info@accelefreight.com. Our team will get back to you to discuss your requirements and provide a quotation. We work exclusively with legally registered corporate and business entities.",
  },
  {
    q: "Who can use AcceleFreight's services?",
    a: "Our services are available exclusively to legally registered corporate and business entities. We do not handle personal or individual shipments.",
  },
];

const SERVICES_FAQS = [
  {
    q: "How do I appoint AcceleFreight as my freight forwarder?",
    a: "Contact us through our website or directly via email at info@accelefreight.com. We will guide you through the onboarding process, which includes company registration and documentation requirements. Once set up, you'll have access to our full suite of services.",
  },
  {
    q: "Do you handle personal or household items?",
    a: "No. AcceleFreight handles commercial shipments for registered businesses only. We do not provide services for personal effects, household items, or individual parcels.",
  },
  {
    q: "What are EOR and IOR services?",
    a: "Exporter of Record (EOR) and Importer of Record (IOR) services are designed for businesses that need to import or export goods in Malaysia but do not have a local legal entity. AcceleFreight acts as the responsible party for all regulatory, tax, and customs obligations, allowing you to trade compliantly without establishing a local company.",
  },
  {
    q: "What does Outsourced Logistics Management cover?",
    a: "Our Outsourced Logistics Management service allows businesses to fully delegate their logistics function to AcceleFreight. This includes freight coordination, supplier management, customs clearance, documentation, and reporting. We also offer standalone logistics consultation for businesses looking to optimise specific parts of their supply chain.",
  },
  {
    q: "Do you offer cold chain logistics?",
    a: "Yes. We offer dedicated Cold Storage services for pharmaceuticals, perishable food products, and other temperature-sensitive cargo. Our facilities maintain precise temperature ranges to ensure product integrity throughout the storage period.",
  },
  {
    q: "Can AcceleFreight handle both import and export shipments?",
    a: "Yes. We handle both import and export shipments across all our freight modes — sea (FCL and LCL), air, and cross-border trucking. Customs clearance is available for both import and export directions.",
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      style={{
        borderBottom: "1px solid var(--border-light)",
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          background: "none",
          border: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "20px 0",
          cursor: "pointer",
          textAlign: "left",
          gap: "16px",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-outfit)",
            fontSize: "0.95rem",
            fontWeight: 500,
            color: open ? "var(--sky)" : "var(--text)",
            transition: "color 0.15s",
          }}
        >
          {q}
        </span>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--sky)"
          strokeWidth="2"
          style={{
            flexShrink: 0,
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.3s ease",
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      <div
        style={{
          overflow: "hidden",
          maxHeight: open ? "600px" : "0",
          transition: "max-height 0.35s ease",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-outfit)",
            fontSize: "0.9rem",
            fontWeight: 300,
            color: "var(--text-mid)",
            lineHeight: 1.85,
            paddingBottom: "20px",
          }}
        >
          {a}
        </p>
      </div>
    </div>
  );
}

export default function FAQPage() {
  const [activeTab, setActiveTab] = useState<"company" | "services">("company");

  return (
    <>
      {/* Banner */}
      <div className="page-banner" style={{ marginTop: "68px" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", position: "relative", zIndex: 1 }}>
          <div className="page-tag">Help Centre</div>
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
            Frequently Asked Questions
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
            Common questions about AcceleFreight and our services.
          </p>
        </div>
      </div>

      {/* FAQ content */}
      <div style={{ padding: "64px 5%", background: "var(--white)" }}>
        <div style={{ maxWidth: "800px", margin: "0 auto" }}>
          {/* Tabs */}
          <div
            style={{
              display: "flex",
              borderBottom: "2px solid var(--border)",
              marginBottom: "40px",
              gap: "0",
            }}
          >
            {(["company", "services"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: "10px 22px",
                  background: "none",
                  border: "none",
                  fontFamily: "var(--font-outfit)",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  cursor: "pointer",
                  color: activeTab === tab ? "var(--sky)" : "var(--text-muted)",
                  borderBottom: `2px solid ${activeTab === tab ? "var(--sky)" : "transparent"}`,
                  marginBottom: "-2px",
                  transition: "color 0.15s, border-color 0.15s",
                  textTransform: "capitalize",
                  minHeight: "44px",
                }}
              >
                {tab === "company" ? "Company" : "Services"}
              </button>
            ))}
          </div>

          {/* Panels */}
          {activeTab === "company" && (
            <div>
              {COMPANY_FAQS.map((item) => (
                <FaqItem key={item.q} {...item} />
              ))}
            </div>
          )}
          {activeTab === "services" && (
            <div>
              {SERVICES_FAQS.map((item) => (
                <FaqItem key={item.q} {...item} />
              ))}
            </div>
          )}

          {/* Still have questions */}
          <div
            style={{
              marginTop: "48px",
              padding: "28px",
              background: "var(--sky-pale)",
              border: "1px solid rgba(59,158,255,0.2)",
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
                  fontWeight: 600,
                  color: "var(--text)",
                  marginBottom: "4px",
                }}
              >
                Still have questions?
              </p>
              <p
                style={{
                  fontFamily: "var(--font-outfit)",
                  fontSize: "0.85rem",
                  fontWeight: 300,
                  color: "var(--text-mid)",
                }}
              >
                Our team is happy to help with any specific enquiries.
              </p>
            </div>
            <a href="/contact" className="btn-primary" style={{ flexShrink: 0 }}>
              Contact Us
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
