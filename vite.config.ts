import fs from "node:fs";
import path from "node:path";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import { componentTagger } from "lovable-tagger";

const githubPagesBase = "/sistema-control-flota/";
const developmentLogPath = path.resolve(__dirname, "development.log");

const appendDevelopmentLog = (line: string) => {
  fs.appendFile(developmentLogPath, `${line}\n`, (error) => {
    if (error) {
      console.error("[devlog] Failed to append log:", error.message);
    }
  });
};

const createDevelopmentLogPlugin = (enabled: boolean): Plugin => ({
  name: "development-log-plugin",
  configureServer(server) {
    if (!enabled) return;

    const header = [
      "======================================",
      "FlotaControl Development Log",
      `Started: ${new Date().toISOString()}`,
      "======================================",
      "",
    ].join("\n");

    if (!fs.existsSync(developmentLogPath)) {
      fs.writeFileSync(developmentLogPath, header);
    } else {
      appendDevelopmentLog(`\n--- Restart ${new Date().toISOString()} ---`);
    }

    server.middlewares.use((req, res, next) => {
      if (!req.url?.startsWith("/supabase/")) {
        next();
        return;
      }

      const startedAt = Date.now();
      const method = req.method ?? "GET";
      const url = req.url;

      res.on("finish", () => {
        const durationMs = Date.now() - startedAt;
        appendDevelopmentLog(
          `[${new Date().toISOString()}] API ${method} ${url} -> ${res.statusCode} (${durationMs}ms)`,
        );
      });

      next();
    });

    server.middlewares.use("/__devlog", (req, res, next) => {
      if (req.method !== "POST") {
        next();
        return;
      }

      const chunks: Buffer[] = [];
      req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      req.on("end", () => {
        const rawBody = Buffer.concat(chunks).toString("utf-8");
        let parsedBody: { timestamp?: string; event?: string; details?: Record<string, unknown> } = {};

        try {
          parsedBody = rawBody ? JSON.parse(rawBody) : {};
        } catch {
          parsedBody = { event: "ui.raw", details: { rawBody } };
        }

        const timestamp = parsedBody.timestamp ?? new Date().toISOString();
        const event = parsedBody.event ?? "ui.unknown";
        const details = parsedBody.details ?? {};
        appendDevelopmentLog(
          `[${timestamp}] UI ${event} ${JSON.stringify(details)}`,
        );

        res.statusCode = 204;
        res.end();
      });
    });
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const supabaseUrl = env.VITE_SUPABASE_URL;
  const isDevelopment = mode === "development";

  return {
    base: mode === "production" ? githubPagesBase : "/",
    server: {
      host: "::",
      port: 8080,
      headers: {
        "Cache-Control": "no-store",
      },
      hmr: {
        overlay: false,
      },
      proxy: supabaseUrl
        ? {
            "/supabase": {
              target: supabaseUrl,
              changeOrigin: true,
              secure: true,
              rewrite: (pathName) => pathName.replace(/^\/supabase/, ""),
            },
          }
        : undefined,
    },
    plugins: [react(), isDevelopment && componentTagger(), createDevelopmentLogPlugin(isDevelopment)].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
    },
  };
});
