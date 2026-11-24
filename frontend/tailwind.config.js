/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          darkest: "#070b14",
          darker: "#0b1120",
          card: "#111827",
          panel: "#161f33",
          border: "#1f2d47",
          borderHover: "#2d3e5e",
          teal: "#06b6d4",
          emerald: "#10b981",
          mint: "#34d399",
          cyan: "#22d3ee",
          muted: "#94a3b8",
        },
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};
