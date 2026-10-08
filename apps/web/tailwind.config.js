/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "rgb(var(--ink-950) / <alpha-value>)",
          900: "rgb(var(--ink-900) / <alpha-value>)",
          800: "rgb(var(--ink-800) / <alpha-value>)",
          700: "rgb(var(--ink-700) / <alpha-value>)",
          600: "rgb(var(--ink-600) / <alpha-value>)",
          500: "rgb(var(--ink-500) / <alpha-value>)",
          400: "rgb(var(--ink-400) / <alpha-value>)",
          300: "rgb(var(--ink-300) / <alpha-value>)",
          200: "rgb(var(--ink-200) / <alpha-value>)",
          100: "rgb(var(--ink-100) / <alpha-value>)",
        },
        state: {
          ok: "#22c55e",
          near: "#eab308",
          over: "#ef4444",
          quiet: "#64748b",
        },
        brand: {
          100: "#fbe6cd",
          200: "#f7c99c",
          300: "#f3a85f",
          400: "#f0913b",
          500: "#e07a24",
          600: "#c4671a",
          700: "#9e5213",
          800: "#7a3f0f",
        },
        lens: {
          visual: "rgb(var(--brand) / <alpha-value>)",
          rules: "#5eead4",
          reflect: "#c084fc",
        },
      },
      fontFamily: {
        sans: ["Inter", "Segoe UI", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        panel: "0 8px 30px rgba(0,0,0,0.35)",
      },
    },
  },
  plugins: [],
};
