import { test as setup, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

const authFile = path.join(__dirname, "../playwright/.auth/user.json");

setup("認証セットアップ: テストユーザーでログイン", async ({ page }) => {
  // playwright/.auth ディレクトリを作成
  const authDir = path.dirname(authFile);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // CSRFトークンを取得
  const csrfRes = await page.request.get("/api/auth/csrf");
  const { csrfToken } = await csrfRes.json();

  // E2Eテスト用 CredentialsProvider でサインイン
  await page.request.post("/api/auth/callback/e2e-credentials", {
    form: {
      csrfToken,
      email: "e2e-test@example.com",
      name: "E2Eテストユーザー",
      callbackUrl: "http://localhost:3000/dashboard",
      json: "true",
    },
  });

  // ダッシュボードにアクセスしてログイン状態を確認
  await page.goto("/dashboard");
  await expect(page).toHaveURL("/dashboard");
  await expect(page.locator("h1")).toContainText("Bridge System");

  // 認証状態を保存
  await page.context().storageState({ path: authFile });
});
