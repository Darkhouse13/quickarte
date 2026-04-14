import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        base: "#FAFAFA",
        ink: "#0A0A0A",
        accent: "#C4653A",
        outline: "#E5E5E5",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "sans-serif"],
        mono: ["var(--font-space-mono)", "Space Mono", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
