import { test, expect } from "@playwright/test";

/**
 * E2Eテスト: 精算システム 主要フロー
 *
 * テストシナリオ:
 *  1. ログイン画面の確認
 *  2. 認証後ダッシュボードへのアクセス（Microsoftログインモック）
 *  3. 新規精算データの登録
 *  4. 一覧への表示確認
 *  5. ログアウト
 */

const TEST_EXPENSE = {
  description: "E2Eテスト_新幹線代_東京大阪",
  amount: "12340",
};

// -----------------------------------------------------------------
// 1. ログイン画面の確認（未認証状態でテスト）
// -----------------------------------------------------------------
test.describe("ログイン画面", () => {
  // このdescribeブロックは認証状態を使わない
  test.use({ storageState: { cookies: [], origins: [] } });

  test("1. ログイン画面にアクセスできる", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL("/login");

    // Bridge System タイトルが表示される
    await expect(page.locator("h1")).toContainText("Bridge System");

    // Microsoftログインボタンが表示される
    await expect(
      page.getByRole("button", { name: /Microsoft/i })
    ).toBeVisible();
  });

  test("1b. 未認証でダッシュボードにアクセスするとログインにリダイレクト", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});

// -----------------------------------------------------------------
// 2〜5. 認証済みのテスト
// -----------------------------------------------------------------
test.describe("精算システム E2Eテスト（認証済み）", () => {
  test("2. 認証後にダッシュボードが表示される", async ({ page }) => {
    await page.goto("/dashboard");

    // ダッシュボードのヘッダーが表示される
    await expect(page.locator("h1")).toContainText("Bridge System");
    await expect(page.getByText("精算一覧")).toBeVisible();

    // 新規登録ボタンが表示される
    await expect(page.getByRole("button", { name: "新規登録" })).toBeVisible();

    // ログアウトボタンが表示される
    await expect(
      page.getByRole("button", { name: "ログアウト" })
    ).toBeVisible();
  });

  test("3. 新規精算データを登録でき、一覧に表示される", async ({ page }) => {
    await page.goto("/dashboard");

    // 新規登録ボタンをクリック
    await page.getByRole("button", { name: "新規登録" }).click();

    // モーダルが開く
    await expect(page.getByText("交通費精算登録")).toBeVisible();

    // 日付を入力
    const today = new Date().toISOString().split("T")[0];
    await page.locator("#date").fill(today);

    // 金額を入力
    await page.locator("#amount").fill(TEST_EXPENSE.amount);

    // 内容を入力
    await page.locator("#description").fill(TEST_EXPENSE.description);

    // 登録ボタンをクリック（"新規登録"ボタンと区別するため exact: true）
    await page.getByRole("button", { name: "登録", exact: true }).click();

    // モーダルが閉じる
    await expect(page.getByText("交通費精算登録")).not.toBeVisible();

    // 登録したデータが一覧に表示されている
    await expect(
      page.getByRole("cell", { name: TEST_EXPENSE.description })
    ).toBeVisible();

    // 金額が表示されている（カンマ区切り）
    await expect(page.getByRole("cell", { name: "¥12,340" })).toBeVisible();
  });

  test("4. ログアウトするとログイン画面にリダイレクトされる", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    // ログアウトボタンをクリック
    await page.getByRole("button", { name: "ログアウト" }).click();

    // ログインページにリダイレクトされる
    await expect(page).toHaveURL(/\/login/);

    // Microsoftログインボタンが表示される
    await expect(
      page.getByRole("button", { name: /Microsoft/i })
    ).toBeVisible();
  });
});
