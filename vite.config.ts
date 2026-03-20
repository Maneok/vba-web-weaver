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
  // OPT-V1: Faster dev rebuilds — skip full dependency pre-bundling on change
  optimizeDeps: {
    include: ["react", "react-dom", "react-router-dom", "@tanstack/react-query"],
  },
  build: {
    // OPT-V2: Target modern browsers for smaller output (no legacy polyfills)
    target: "es2020",
    // OPT-V3: CSS code splitting for better caching
    cssCodeSplit: true,
    // OPT-V4: Warn on large chunks (250KB)
    chunkSizeWarningLimit: 250,
    // OPT-V5: Hidden sourcemaps in production (available for debugging but not exposed)
    sourcemap: mode === "production" ? "hidden" : true,
    // OPT-V6: Minification options — strip console.log/debug in production
    minify: "esbuild",
    esbuild: mode === "production" ? {
      drop: ["debugger"],
      pure: ["console.log", "console.debug"],
    } : undefined,
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
            if (id.includes("jspdf")) {
              return "pdf-gen";
            }
            if (id.includes("docx") || id.includes("file-saver")) {
              return "docx-gen";
            }
            if (id.includes("@radix-ui")) {
              return "radix-ui";
            }
            if (id.includes("@dnd-kit")) {
              return "dnd-kit";
            }
            // OPT-V7: Split form libraries into own chunk
            if (id.includes("react-hook-form") || id.includes("@hookform")) {
              return "forms";
            }
            // OPT-V8: Split zod validation into own chunk
            if (id.includes("zod")) {
              return "validation";
            }
            // OPT-V9: Split Lucide icons into own chunk (large tree-shakeable lib)
            if (id.includes("lucide-react")) {
              return "icons";
            }
            // OPT-V10: Split class-variance-authority + clsx + tailwind-merge
            if (id.includes("class-variance-authority") || id.includes("clsx") || id.includes("tailwind-merge")) {
              return "styling";
            }
            // OPT-V11: Split html2canvas (200KB+ — used only for PDF screenshots)
            if (id.includes("html2canvas")) {
              return "html2canvas";
            }
            // OPT-V12: Split DOMPurify (used for sanitization)
            if (id.includes("dompurify") || id.includes("purify")) {
              return "sanitize";
            }
          }
        },
      },
    },
  },
}));
