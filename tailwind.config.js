/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        background:    "hsl(var(--color-background) / <alpha-value>)",
        surface:       "hsl(var(--color-surface) / <alpha-value>)",
        surfaceHover:  "hsl(var(--color-surfaceHover) / <alpha-value>)",
        border:        "hsl(var(--color-border) / <alpha-value>)",
        muted:         "hsl(var(--color-muted) / <alpha-value>)",
        text:          "hsl(var(--color-text) / <alpha-value>)",
        accent:        "hsl(var(--color-accent) / <alpha-value>)",
        accentText:    "hsl(var(--color-accent-text) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px 0 hsl(var(--color-shadow) / 0.04), 0 1px 3px 0 hsl(var(--color-shadow) / 0.06)",
        soft: "0 4px 12px -2px hsl(var(--color-shadow) / 0.08)",
      },
    },
  },
  plugins: [],
};
