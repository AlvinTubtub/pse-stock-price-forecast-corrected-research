import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        charcoal: {
          950: "#0a0b0e",
          900: "#101115",
          850: "#14151a",
          800: "#181a20",
          700: "#22252e",
          600: "#2d303c",
        },
        neon: {
          300: "#7ef8ff",
          400: "#00f0ff",
          500: "#00d2ff",
          600: "#00a3ff",
        },
        accent: {
          emerald: "#00f59b",
          rose: "#ff3b69",
          amber: "#ffb800",
        },
        brand: {
          50: "#eff6ff",
          100: "#dbeafe",
          400: "#00d2ff",
          500: "#00f0ff",
          600: "#0284c7",
          900: "#101115",
          950: "#0a0b0e",
        },
        dark: {
          bg: "#0a0b0e",
          card: "#101115",
          border: "#22252e",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "JetBrains Mono", "Menlo", "Monaco", "monospace"],
      },
      boxShadow: {
        "neon-sm": "0 0 12px rgba(0, 240, 255, 0.25)",
        "neon-md": "0 0 25px rgba(0, 240, 255, 0.35)",
        "neon-lg": "0 0 45px rgba(0, 240, 255, 0.45)",
        "neon-border": "0 0 15px rgba(0, 240, 255, 0.3), inset 0 0 15px rgba(0, 240, 255, 0.1)",
        "card-glow": "0 8px 32px 0 rgba(0, 0, 0, 0.37), 0 0 20px -3px rgba(0, 240, 255, 0.08)",
      },
      animation: {
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "glow-pulse": "glowPulse 3s ease-in-out infinite",
        marquee: "marquee 45s linear infinite",
      },
      keyframes: {
        glowPulse: {
          "0%, 100%": { opacity: "0.4", transform: "scale(1)" },
          "50%": { opacity: "0.8", transform: "scale(1.02)" },
        },
        marquee: {
          "0%": { transform: "translateX(0%)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
