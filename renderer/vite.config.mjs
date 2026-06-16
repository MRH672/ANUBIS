import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

function dataMiddleware() {
  return {
    name: "anubis-data-middleware",
    configureServer(server) {
      server.middlewares.use("/data", (request, response, next) => {
        const pathname = new URL(request.url || "", "http://localhost").pathname
          .replace(/^\/data\/?/, "")
          .replace(/^\/+/, "");
        const dataPath = path.resolve(projectRoot, "data", pathname);
        const dataRoot = path.join(projectRoot, "data");

        if (!dataPath.startsWith(`${dataRoot}${path.sep}`)) {
          response.statusCode = 403;
          response.end("Forbidden");
          return;
        }

        fs.createReadStream(dataPath)
          .on("error", next)
          .pipe(response);
      });
    }
  };
}

export default defineConfig({
  root: __dirname,
  base: "./",
  plugins: [react(), dataMiddleware()],
  build: {
    outDir: "dist",
    emptyOutDir: true
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src")
    }
  }
});
