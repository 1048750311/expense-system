import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: "http://localhost:3001",
    trace: "on-first-retry",
  },
  projects: [
    // 認証セットアッププロジェクト（ログインして storage state を保存）
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
    },
    // メインテストプロジェクト（保存した認証状態を使用）
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: "next dev -p 3001",
    url: "http://localhost:3001",
    reuseExistingServer: false,
    env: {
      E2E_TEST: "true",
      NEXTAUTH_URL: "http://localhost:3001",
    },
  },
});
