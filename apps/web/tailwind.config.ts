import type { Config } from "tailwindcss";
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: { colors: { ink: "#202923", brand: "#315dcb", accent: "#91adff", surface: "#f3f1e9" } }
  },
  plugins: []
} satisfies Config;
