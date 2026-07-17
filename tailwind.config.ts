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
        ink: "#17140f",
        paper: "#f2eee3",
        obsidian: "#0b0f0d",
        graphite: "#171e1a",
        gold: "#d0aa66",
        cyan: "#8bc7b0",
        ember: "#c9784f",
        mint: "#b9dbc9",
        spruce: "#3f7b67",
        coral: "#c9784f"
      },
      boxShadow: {
        soft: "0 18px 50px rgba(0, 0, 0, 0.2)",
        glow: "0 20px 48px rgba(0, 0, 0, 0.22)"
      }
    }
  },
  plugins: []
};

export default config;
