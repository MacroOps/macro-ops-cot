import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { loadPublicPortfolioSnapshot } from "./src/lib/portfolio/parse";

function portfolioDevApi(): Plugin {
  return {
    name: "portfolio-snapshot-dev",
    configureServer(server) {
      server.middlewares.use("/api/portfolio-snapshot", (req, res, next) => {
        if (req.method !== "GET" && req.method !== "POST") return next();
        void (async () => {
          try {
            const payload = await loadPublicPortfolioSnapshot();
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(payload));
          } catch (e) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: (e as Error).message }));
          }
        })();
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    // Cursor Cloud preview uses *.cursorvm.com proxy hostnames
    allowedHosts: [".cursorvm.com", "localhost"],
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger(), mode === "development" && portfolioDevApi()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Package barrel re-exports createClient in a way Vite/esbuild cannot parse.
      "@outseta/react": path.resolve(__dirname, "node_modules/@outseta/react/src/components/index.ts"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
