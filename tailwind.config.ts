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
        h1: ["32px", { lineHeight: "1.2", fontWeight: "600" }],
        h2: ["24px", { lineHeight: "1.3", fontWeight: "600" }],
        body: ["16px", { lineHeight: "1.5", fontWeight: "400" }],
        small: ["14px", { lineHeight: "1.4", fontWeight: "400" }],
      },
      spacing: {
        page: "24px",
        section: "32px",
        card: "16px",
      },
      borderRadius: {
        card: "8px", // Changed from 12px to 8px (rounded-lg)
        button: "6px", // Changed from 8px to 6px (rounded-md)
        input: "6px", // Changed from 8px to 6px (rounded-md)
        modal: "12px", // Changed from 16px to 12px (rounded-lg)
      },
      boxShadow: {
        card: "0 4px 12px rgba(0,0,0,0.1)",
        modal: "0 8px 32px rgba(0,0,0,0.2)",
      },
    },
  },
  plugins: [],
};

export default config;

