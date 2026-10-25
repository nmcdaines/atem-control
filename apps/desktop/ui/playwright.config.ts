import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:1421",
    viewport: { width: 1360, height: 900 },
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command:
        "cargo run -p control-server -- --demo --port 3849 --database ../../../.local/e2e.sqlite3",
      url: "http://127.0.0.1:3849/api/snapshot",
      timeout: 120000,
      reuseExistingServer: false,
    },
    {
      command: "npm run dev -- --port 1421",
      url: "http://127.0.0.1:1421",
      env: { VITE_CONTROL_API: "http://127.0.0.1:3849" },
      reuseExistingServer: false,
    },
  ],
});
