import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "sans-serif"]
      },
      colors: {
        canvas: "var(--canvas)",
        card: "var(--card)",
        ink: "var(--ink)",
        muted: "var(--muted)",
        accent: "var(--accent)",
        accent2: "var(--accent-2)",
        accent3: "var(--accent-3)",
        outline: "var(--outline)"
      },
      boxShadow: {
        soft: "var(--shadow)",
        glow: "0 14px 28px -18px rgba(243, 111, 90, 0.9)"
      }
    }
  },
  plugins: []
};

export default config;
