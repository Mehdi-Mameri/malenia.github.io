import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/malenia.github.io/", // <-- CHANGE if your repo has a different name
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
