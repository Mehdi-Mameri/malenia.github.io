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
  build: {
    // Split heavy vendors into their own chunks so the browser can fetch them
    // in parallel and cache them across deploys (recharts is the biggest one).
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom"],
          recharts: ["recharts"],
          icons: ["lucide-react"],
        },
      },
    },
  },
});
