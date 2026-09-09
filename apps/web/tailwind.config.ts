import type { Config } from "tailwindcss";
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: { extend: { colors: { ink: "#17212b", brand: "#4263eb", surface: "#f7f8fb" } } },
  plugins: []
} satisfies Config;
