import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],

  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/ethers")) {
            return "ethers";
          }

          if (id.includes("node_modules/lucide-react")) {
            return "icons";
          }

          if (
            id.includes("node_modules/react") ||
            id.includes("node_modules/scheduler")
          ) {
            return "react";
          }

          return undefined;
        },
      },
    },
  },

  server: {
    proxy: {
      "/api": "http://127.0.0.1:8787",
    },
  },
});