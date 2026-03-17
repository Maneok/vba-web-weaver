import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // OPT-11: Aggressive code-splitting for better caching & smaller initial bundle
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("react") || id.includes("react-dom") || id.includes("react-router-dom") || id.includes("scheduler")) {
              return "vendor";
            }
            if (id.includes("recharts") || id.includes("d3-")) {
              return "charts";
            }
            if (id.includes("@supabase/supabase-js")) {
              return "supabase";
            }
            if (id.includes("jspdf") || id.includes("docx") || id.includes("file-saver")) {
              return "generation";
            }
            if (id.includes("@radix-ui")) {
              return "radix-ui";
            }
            if (id.includes("@dnd-kit")) {
              return "dnd-kit";
            }
          }
        },
      },
    },
  },
}));
