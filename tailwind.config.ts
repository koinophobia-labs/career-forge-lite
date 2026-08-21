import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#111827",
        paper: "#f7f2e8",
        obsidian: "#080d18",
        graphite: "#111827",
        gold: "#d8b26e",
        cyan: "#6c8cff",
        ember: "#e08a64",
        mint: "#8fd8b8",
        spruce: "#2b6f68",
        coral: "#e27b7b"
      },
      boxShadow: {
        soft: "0 24px 70px rgba(3, 8, 20, 0.28)",
        glow: "0 28px 90px rgba(47, 73, 160, 0.24)"
      }
    }
  },
  plugins: []
};

export default config;
