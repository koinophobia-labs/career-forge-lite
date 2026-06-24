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
        ink: "#17202a",
        paper: "#fbfaf7",
        mint: "#d7f2e3",
        spruce: "#0d6b5f",
        coral: "#e56b4f"
      },
      boxShadow: {
        soft: "0 18px 50px rgba(23, 32, 42, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
