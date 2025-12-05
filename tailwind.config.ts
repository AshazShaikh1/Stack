import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        emerald: {
          DEFAULT: "#1DB954",
          dark: "#1AA34A",
          light: "#1ED760",
        },
        jet: {
          DEFAULT: "#312F2C",
          dark: "#0A0A0A",
        },
        cloud: {
          DEFAULT: "#FAFAFA",
        },
        gray: {
          light: "#E5E5E5",
          muted: "#555555",
        },
      },
      fontFamily: {
        sans: [
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Arial",
          "Helvetica",
          "sans-serif",
        ],
      },
      fontSize: {
        h1: ["40px", { lineHeight: "1.2", fontWeight: "700", letterSpacing: "-0.02em" }],
        h2: ["28px", { lineHeight: "1.3", fontWeight: "600", letterSpacing: "-0.01em" }],
        body: ["16px", { lineHeight: "1.6", fontWeight: "400" }],
        small: ["14px", { lineHeight: "1.5", fontWeight: "400" }],
      },
      spacing: {
        page: "24px",
        section: "32px",
        card: "16px",
      },
      borderRadius: {
        card: "12px",
        button: "10px",
        input: "8px",
        modal: "16px",
      },
      boxShadow: {
        card: "0 2px 8px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.1)",
        cardHover: "0 8px 24px rgba(0,0,0,0.12), 0 4px 8px rgba(0,0,0,0.08)",
        button: "0 2px 8px rgba(29,185,84,0.25)",
        buttonHover: "0 4px 12px rgba(29,185,84,0.35)",
        modal: "0 20px 60px rgba(0,0,0,0.15), 0 8px 24px rgba(0,0,0,0.1)",
      },
    },
  },
  plugins: [],
};

export default config;

