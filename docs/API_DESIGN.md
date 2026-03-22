# 経費精算システム API 設計書

## 概要

このドキュメントでは、経費精算システムのREST APIについて説明します。Next.js App Routerを使用したAPI Routesとして実装されています。

**ベースURL**: `http://localhost:3000/api`

**認証**: NextAuth.jsを使用したJWT認証（将来実装予定）

---

## 共通仕様

### HTTPステータスコード

| ステータスコード | 説明 |
|------------------|------|
| 200 | 成功 |
| 201 | 作成成功 |
| 400 | リクエストエラー |
| 401 | 認証エラー（未実装） |
| 403 | 権限エラー |
| 404 | リソースが見つからない |
| 500 | サーバーエラー |

### レスポンス形式

```json
{
  "success": true,
  "data": { ... },
  "message": "操作が成功しました"
}
```

### エラーレスポンス形式

```json
{
  "success": false,
  "error": "エラーメッセージ",
  "code": "ERROR_CODE"
}
```

---

## 1. 経費一覧取得 API

### エンドポイント
```
GET /api/expenses
```

### 概要
経費データのリストを取得します。フィルタリング、ソート、ページネーションに対応しています。

### クエリパラメータ

| パラメータ | 型 | 必須 | 説明 | 例 |
|------------|----|------|------|----|
| `page` | number | いいえ | ページ番号（1始まり） | `?page=1` |
| `limit` | number | いいえ | 1ページあたりの件数（デフォルト: 10） | `?limit=20` |
| `status` | string | いいえ | ステータスフィルタ | `?status=draft` |
| `categoryId` | string | いいえ | カテゴリIDフィルタ | `?categoryId=abc123` |
| `userId` | string | いいえ | ユーザーIDフィルタ | `?userId=user123` |
| `startDate` | string | いいえ | 開始日（YYYY-MM-DD） | `?startDate=2024-01-01` |
| `endDate` | string | いいえ | 終了日（YYYY-MM-DD） | `?endDate=2024-12-31` |
| `sortBy` | string | いいえ | ソートフィールド | `?sortBy=createdAt` |
| `sortOrder` | string | いいえ | ソート順（asc/desc） | `?sortOrder=desc` |

### ステータス値
- `draft` - 下書き
- `submitted` - 提出済み
- `approved` - 承認済み
- `rejected` - 却下

### レスポンス

```json
{
  "success": true,
  "data": {
    "expenses": [
      {
        "id": "exp_123456",
        "userId": "user_123",
        "user": {
          "id": "user_123",
          "name": "田中太郎",
          "email": "tanaka@example.com"
        },
        "categoryId": "cat_456",
        "category": {
          "id": "cat_456",
          "name": "交通費",
          "code": "TRANS"
        },
        "description": "東京駅から新大阪駅まで新幹線",
        "amount": 15000,
        "expenseDate": "2024-03-15T00:00:00.000Z",
        "receiptStatus": "uploaded",
        "receiptPath": "/uploads/receipts/receipt_123.pdf",
        "transportType": "train",
        "roundTrip": false,
        "status": "submitted",
        "approverUserId": null,
        "approvalDate": null,
        "approvalComments": null,
        "rejectReason": null,
        "createdAt": "2024-03-15T10:30:00.000Z",
        "submittedAt": "2024-03-15T10:30:00.000Z",
        "updatedAt": "2024-03-15T10:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 1,
      "totalPages": 1
    },
    "summary": {
      "totalAmount": 15000,
      "count": 1
    }
  }
}
```

### 使用例

```bash
# 全経費取得
GET /api/expenses

# 提出済み経費のみ取得
GET /api/expenses?status=submitted

# 特定のユーザーの経費を取得（ページネーション）
GET /api/expenses?userId=user123&page=1&limit=20

# 日付範囲でフィルタリング
GET /api/expenses?startDate=2024-03-01&endDate=2024-03-31

# ソート（作成日降順）
GET /api/expenses?sortBy=createdAt&sortOrder=desc
```

---

## 2. 経費新規登録 API

### エンドポイント
```
POST /api/expenses
```

### 概要
新しい経費データを登録します。

### リクエストボディ

```json
{
  "categoryId": "string (必須)",
  "description": "string (必須)",
  "amount": "number (必須)",
  "expenseDate": "string (必須, YYYY-MM-DD)",
  "receiptStatus": "string (オプション, デフォルト: 'none')",
  "receiptPath": "string (オプション)",
  "transportType": "string (オプション)",
  "roundTrip": "boolean (オプション, デフォルト: false)"
}
```

### フィールド説明

| フィールド | 型 | 必須 | 説明 | 例 |
|------------|----|------|------|----|
| `categoryId` | string | ✅ | 経費カテゴリID | `"cat_123"` |
| `description` | string | ✅ | 経費の詳細説明 | `"東京駅から新大阪駅まで新幹線"` |
| `amount` | number | ✅ | 金額（円） | `15000` |
| `expenseDate` | string | ✅ | 経費発生日 | `"2024-03-15"` |
| `receiptStatus` | string | ❌ | 領収書状態 | `"none"`, `"available"`, `"uploaded"` |
| `receiptPath` | string | ❌ | 領収書ファイルパス | `"/uploads/receipts/receipt_123.pdf"` |
| `transportType` | string | ❌ | 交通手段 | `"train"`, `"bus"`, `"car"`, `"other"` |
| `roundTrip` | boolean | ❌ | 往復フラグ | `false` |

### レスポンス

```json
{
  "success": true,
  "data": {
    "id": "exp_123456",
    "userId": "user_123",
    "categoryId": "cat_456",
    "description": "東京駅から新大阪駅まで新幹線",
    "amount": 15000,
    "expenseDate": "2024-03-15T00:00:00.000Z",
    "receiptStatus": "none",
    "receiptPath": null,
    "transportType": "train",
    "roundTrip": false,
    "status": "draft",
    "createdAt": "2024-03-15T10:30:00.000Z",
    "updatedAt": "2024-03-15T10:30:00.000Z"
  },
  "message": "経費が正常に登録されました"
}
```

### 使用例

```bash
POST /api/expenses
Content-Type: application/json

{
  "categoryId": "cat_123",
  "description": "東京駅から新大阪駅まで新幹線",
  "amount": 15000,
  "expenseDate": "2024-03-15",
  "transportType": "train",
  "roundTrip": false
}
```

---

## 3. 経費更新 API

### エンドポイント
```
PUT /api/expenses/[id]
```

### 概要
指定されたIDの経費データを更新します。

### パスパラメータ

| パラメータ | 型 | 必須 | 説明 | 例 |
|------------|----|------|------|----|
| `id` | string | ✅ | 経費ID | `exp_123456` |

### リクエストボディ

新規登録APIと同じフィールドを使用可能。部分更新にも対応しています。

```json
{
  "description": "東京駅から新大阪駅まで新幹線（修正）",
  "amount": 14500,
  "status": "submitted"
}
```

### レスポンス

```json
{
  "success": true,
  "data": {
    "id": "exp_123456",
    "userId": "user_123",
    "categoryId": "cat_456",
    "description": "東京駅から新大阪駅まで新幹線（修正）",
    "amount": 14500,
    "expenseDate": "2024-03-15T00:00:00.000Z",
    "status": "submitted",
    "submittedAt": "2024-03-15T11:00:00.000Z",
    "updatedAt": "2024-03-15T11:00:00.000Z"
  },
  "message": "経費が正常に更新されました"
}
```

### 使用例

```bash
PUT /api/expenses/exp_123456
Content-Type: application/json

{
  "description": "東京駅から新大阪駅まで新幹線（修正）",
  "amount": 14500,
  "status": "submitted"
}
```

---

## 4. 経費削除 API

### エンドポイント
```
DELETE /api/expenses/[id]
```

### 概要
指定されたIDの経費データを削除します。

### パスパラメータ

| パラメータ | 型 | 必須 | 説明 | 例 |
|------------|----|------|------|----|
| `id` | string | ✅ | 経費ID | `exp_123456` |

### レスポンス

```json
{
  "success": true,
  "message": "経費が正常に削除されました"
}
```

### 使用例

```bash
DELETE /api/expenses/exp_123456
```

---

## バリデーションルール

### 共通バリデーション

- `amount`: 0より大きい数値
- `expenseDate`: 有効な日付形式（YYYY-MM-DD）
- `categoryId`: 存在するカテゴリID
- `description`: 1文字以上、1000文字以下

### ステータス遷移ルール

| 現在のステータス | 可能な次のステータス |
|------------------|----------------------|
| `draft` | `submitted` |
| `submitted` | `approved`, `rejected` |
| `approved` | 変更不可 |
| `rejected` | `draft`（再提出） |

---

## エラーレスポンス例

### 400 Bad Request（バリデーションエラー）

```json
{
  "success": false,
  "error": "バリデーションエラー",
  "code": "VALIDATION_ERROR",
  "details": [
    {
      "field": "amount",
      "message": "金額は0より大きい値を入力してください"
    },
    {
      "field": "expenseDate",
      "message": "有効な日付形式で入力してください"
    }
  ]
}
```

### 404 Not Found

```json
{
  "success": false,
  "error": "経費が見つかりません",
  "code": "EXPENSE_NOT_FOUND"
}
```

### 403 Forbidden（権限エラー）

```json
{
  "success": false,
  "error": "この経費を編集する権限がありません",
  "code": "INSUFFICIENT_PERMISSIONS"
}
```

---

## 実装予定の機能

- 🔐 **認証・認可**: NextAuth.jsを使用したJWT認証
- 📎 **ファイルアップロード**: 領収書画像のアップロードAPI
- 📊 **統計API**: 月次/年間の集計データ取得
- 🔔 **通知API**: 承認依頼・結果通知
- 📋 **ワークフローAPI**: 承認フローの管理

---

## テスト用データ投入

開発時は以下のコマンドでテストデータを投入できます：

```bash
npm run db:seed
```

---

## 注意事項

- 現在は認証機能が未実装のため、全てのAPIが公開状態です
- 本番環境では適切な認証・認可を実装してください
- 大量データの取得時はページネーションを必ず使用してください
- ファイルアップロード時は適切なサイズ制限と形式チェックを実装してください</content>
<parameter name="filePath">c:\Users\10487\Desktop\Task\expense-system\docs\API_DESIGN.md