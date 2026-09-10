import type { Config } from "tailwindcss";
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: { colors: { ink: "#17212b", brand: "#6d5dfc", accent: "#14b8a6", surface: "#f7f8fb" } }
  },
  plugins: []
} satisfies Config;
