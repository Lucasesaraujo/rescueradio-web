import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary"],
      thresholds: {
        statements: 50,
        branches: 50,
        functions: 50,
        lines: 50,
      },
      include: [
        "src/components/ConfirmDialog.tsx",
        "src/components/StatusBadge.tsx",
        "src/lib/geo.ts",
        "src/lib/notifications.ts",
        "src/lib/rescueradio.ts",
      ],
    },
  },
});
