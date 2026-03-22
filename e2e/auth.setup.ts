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

  // テスト専用APIでセッションCookieを生成
  const res = await page.request.post("/api/test-session");
  if (!res.ok()) {
    throw new Error(`テストセッション生成失敗: ${res.status()} ${await res.text()}`);
  }

  // CSRF Cookieも初期化しておく（ログアウト時に必要）
  await page.request.get("/api/auth/csrf");

  // ダッシュボードにアクセスしてログイン状態を確認
  await page.goto("/dashboard");
  await expect(page).toHaveURL("/dashboard");
  await expect(page.locator("h1")).toContainText("Bridge System");

  // 認証状態（セッション + CSRF Cookie）を保存
  await page.context().storageState({ path: authFile });
});
