import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // AF Design System — Slate & Sky Blue
        slate: {
          DEFAULT: "#0f1c2e",
          mid: "#1a2f47",
          light: "#243b55",
        },
        sky: {
          DEFAULT: "#3b9eff",
          light: "#6cb8ff",
          pale: "#e8f4ff",
          mist: "#f0f7ff",
        },
        surface: "#f7f9fc",
        border: {
          DEFAULT: "#dde5ef",
          light: "#edf2f8",
        },
        text: {
          DEFAULT: "#0f1c2e",
          mid: "#3d5473",
          muted: "#7a93b0",
        },
      },
      fontFamily: {
        syne: ["var(--font-syne)", "sans-serif"],
        outfit: ["var(--font-outfit)", "sans-serif"],
        mono: ["var(--font-jetbrains)", "monospace"],
      },
      borderRadius: {
        DEFAULT: "6px",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        floatCard: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
        ticker: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        pulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
        scaleX: {
          "0%": { transform: "scaleX(0)" },
          "100%": { transform: "scaleX(1)" },
        },
      },
      animation: {
        "fade-up": "fadeUp 0.5s ease forwards",
        "float-card": "floatCard 5s ease-in-out infinite",
        ticker: "ticker 30s linear infinite",
        pulse: "pulse 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
