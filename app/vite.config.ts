import vike from "vike/plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { machineFilesPlugin } from "./scripts/vite-plugin-machine-files";

export default defineConfig({
  plugins: [vike(), react(), machineFilesPlugin()],
});
