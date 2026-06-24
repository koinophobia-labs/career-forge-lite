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
        ink: "#111318",
        paper: "#f2f5fa",
        obsidian: "#07090d",
        graphite: "#161b22",
        gold: "#d4af37",
        cyan: "#00e5ff",
        ember: "#ff6a2b",
        mint: "#d7f2e3",
        spruce: "#0d6b5f",
        coral: "#e56b4f"
      },
      boxShadow: {
        soft: "0 18px 50px rgba(0, 0, 0, 0.2)",
        glow: "0 24px 80px rgba(0, 229, 255, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
