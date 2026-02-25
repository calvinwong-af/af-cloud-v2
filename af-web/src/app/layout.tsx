import type { Metadata } from "next";
import { Syne, Outfit, JetBrains_Mono } from "next/font/google";
import "@/styles/globals.css";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

// ─── Font Setup ───────────────────────────────────────────────────────────────
const syne = Syne({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-syne",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-outfit",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains",
  display: "swap",
});

// ─── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: Metadata = {
  title: {
    default: "AcceleFreight — Your Complete Logistics Solution",
    template: "%s | AcceleFreight",
  },
  description:
    "Accele Freight Sdn Bhd — Malaysian freight forwarder and multimodal transport operator. Sea freight, air freight, customs clearance, warehousing, and more.",
  keywords: [
    "freight forwarder",
    "Malaysia",
    "sea freight",
    "air freight",
    "customs clearance",
    "logistics",
    "LCL",
    "FCL",
    "warehousing",
    "EOR",
    "IOR",
  ],
  authors: [{ name: "Accele Freight Sdn Bhd" }],
  creator: "Accele Freight Sdn Bhd",
  metadataBase: new URL("https://www.accelefreight.com"),
  openGraph: {
    type: "website",
    locale: "en_MY",
    url: "https://www.accelefreight.com",
    siteName: "AcceleFreight",
    title: "AcceleFreight — Your Complete Logistics Solution",
    description:
      "Malaysian freight forwarder and multimodal transport operator. Sea freight, air freight, customs clearance, and more.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

// ─── Root Layout ──────────────────────────────────────────────────────────────
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${syne.variable} ${outfit.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <Navbar />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
