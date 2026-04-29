import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        fg: {
          // Maison Doclar design system palette (Slice 4B)
          background: "#000000",
          surface: "#0a0a0a",
          elevated: "#141414",
          inset: "#080808",
          ivory: "#FFFFF0",
          secondary: "#E8E8D8",
          muted: "#888888",
          placeholder: "#666666",
          "grey-800": "#333333",
          gold: "#b79f85",
          "gold-hover": "#c9b59f",
          "gold-active": "#a0886e",
          "gold-muted": "#8a7761",
          "gold-glow": "rgba(183,159,133,0.2)",
          success: "#2E7D32",
          warning: "#ED6C02",
          error: "#D32F2F",
          info: "#0288D1",

          // Backwards-compatible aliases used throughout the UI.
          black: "#000000",
          line: "#333333",
          ink: "#FFFFF0",
          mist: "#888888",
          danger: "#D32F2F",
          "danger-text": "#FFFFF0",
          "success-text": "#FFFFF0",
          "warning-text": "#FFFFF0",
          ready: "#0288D1",
          "ready-text": "#FFFFF0",
          archive: "#333333",
          "archive-text": "#E8E8D8",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "-apple-system", "sans-serif"],
        display: ["var(--font-instrument)", "Instrument Sans", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
