import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Compila el panel a estáticos que sirve el servidor del bot (src/web/public).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "../src/web/public",
    emptyOutDir: true,
  },
  server: {
    // En desarrollo (npm run dev) reenvía /api al bot.
    proxy: { "/api": "http://localhost:8787" },
  },
});
