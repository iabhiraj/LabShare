/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["'DM Sans'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      colors: {
        surface: {
          950: "#070d1a",
          900: "#0a1020",
          800: "#0f1a2e",
          700: "#172035",
          600: "#1e2a42",
          500: "#263354",
        },
      },
      animation: {
        "pulse-slow": "pulse 2.5s cubic-bezier(0.4,0,0.6,1) infinite",
        "slide-up"  : "slideUp 0.25s ease both",
        "fade-in"   : "fadeIn 0.2s ease both",
      },
      keyframes: {
        slideUp : { from: { opacity: 0, transform: "translateY(10px)" }, to: { opacity: 1, transform: "translateY(0)" } },
        fadeIn  : { from: { opacity: 0 }, to: { opacity: 1 } },
      },
    },
  },
  plugins: [],
};
