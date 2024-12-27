/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "selector",

  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    fontSize: {
      xs: "0.65rem",
      sm: "0.75rem",
      base: "0.875rem",
      lg: "1rem",
      xl: "1.125rem",
      "2xl": "1.25rem",
      "3xl": "1.5rem",
      "4xl": "1.875rem",
      "5xl": "2.25rem",
    },
    extend: {
      fontFamily: {
        // Override the default sans font (which is the default)
        sans: "ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace",
        // Keep inter as an option if you still want to use it somewhere
        inter:
          'Inter Variable, ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
      },
    },
  },
  plugins: [require("tailwind-scrollbar")],
};
