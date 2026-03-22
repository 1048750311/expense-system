# 経費精算システム API設計書

**バージョン**: 1.0.0
**作成日**: 2026-03-23
**ベースURL**: `/api`

---

## 目次

1. [共通仕様](#共通仕様)
2. [認証](#認証)
3. [エンドポイント一覧](#エンドポイント一覧)
4. [GET /api/expenses](#get-apiexpenses)
5. [POST /api/expenses](#post-apiexpenses)
6. [PUT /api/expenses/[id]](#put-apiexpensesid)
7. [DELETE /api/expenses/[id]](#delete-apiexpensesid)
8. [データモデル](#データモデル)
9. [エラーコード一覧](#エラーコード一覧)

---

## 共通仕様

### レスポンス形式

すべてのAPIは JSON 形式でレスポンスを返す。

#### 成功時

```json
{
  "success": true,
  "data": { ... },
  "message": "操作の説明"
}
```

#### エラー時

```json
{
  "success": false,
  "error": "エラーメッセージ",
  "code": "ERROR_CODE"
}
```

#### バリデーションエラー時

```json
{
  "success": false,
  "error": "バリデーションエラー",
  "code": "VALIDATION_ERROR",
  "details": [
    {
      "field": "フィールド名",
      "message": "エラーメッセージ"
    }
  ]
}
```

### HTTPステータスコード

| コード | 説明 |
|--------|------|
| 200 | 成功（GET, PUT, DELETE） |
| 201 | 作成成功（POST） |
| 400 | リクエスト不正（バリデーションエラー、存在しないカテゴリ等） |
| 401 | 認証エラー |
| 403 | 権限エラー |
| 404 | リソースが見つからない |
| 500 | サーバーエラー |

---

## 認証

すべてのエンドポイントは **NextAuth.js セッション認証** が必要。

- 未認証の場合: `401 Unauthorized` を返す
- セッションは Cookie ベースで管理される

---

## エンドポイント一覧

| メソッド | パス | 説明 |
|----------|------|------|
| GET | `/api/expenses` | 経費一覧取得 |
| POST | `/api/expenses` | 経費新規登録 |
| PUT | `/api/expenses/[id]` | 経費更新 |
| DELETE | `/api/expenses/[id]` | 経費削除 |

---

## GET /api/expenses

経費の一覧を取得する。フィルタリング・ページネーション・ソートに対応。

### リクエスト

**メソッド**: `GET`
**パス**: `/api/expenses`

#### クエリパラメータ

| パラメータ | 型 | 必須 | デフォルト | 説明 |
|-----------|-----|------|-----------|------|
| `page` | integer | - | `1` | ページ番号 |
| `limit` | integer | - | `10` | 1ページあたりの件数 |
| `status` | string | - | - | ステータスでフィルタ (`draft` / `submitted` / `approved` / `rejected`) |
| `categoryId` | string | - | - | カテゴリIDでフィルタ |
| `userId` | string | - | - | ユーザーIDでフィルタ |
| `startDate` | string | - | - | 精算日の開始日（`YYYY-MM-DD`） |
| `endDate` | string | - | - | 精算日の終了日（`YYYY-MM-DD`） |
| `sortBy` | string | - | `createdAt` | ソート対象フィールド |
| `sortOrder` | string | - | `desc` | ソート順 (`asc` / `desc`) |

#### リクエスト例

```
GET /api/expenses?page=1&limit=20&status=submitted&startDate=2026-01-01&endDate=2026-03-31
```

### レスポンス

**ステータス**: `200 OK`

```json
{
  "success": true,
  "data": {
    "expenses": [
      {
        "id": "clxxxxxxxxxxxxxxx",
        "userId": "clxxxxxxxxxxxxxxx",
        "categoryId": "clxxxxxxxxxxxxxxx",
        "description": "東京-大阪 出張交通費",
        "amount": 13000,
        "expenseDate": "2026-03-15T00:00:00.000Z",
        "status": "submitted",
        "receiptStatus": "uploaded",
        "receiptPath": "/receipts/2026/03/receipt_001.pdf",
        "transportType": "train",
        "roundTrip": true,
        "submittedAt": "2026-03-16T10:00:00.000Z",
        "approvalDate": null,
        "approvalComments": null,
        "rejectReason": null,
        "createdAt": "2026-03-16T09:30:00.000Z",
        "updatedAt": "2026-03-16T10:00:00.000Z",
        "user": {
          "id": "clxxxxxxxxxxxxxxx",
          "name": "山田 太郎",
          "email": "yamada@example.com"
        },
        "category": {
          "id": "clxxxxxxxxxxxxxxx",
          "name": "交通費",
          "code": "TRANSPORT"
        },
        "approver": null
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 42,
      "totalPages": 3
    },
    "summary": {
      "totalAmount": 358000,
      "count": 42
    }
  }
}
```

### エラーレスポンス

| ステータス | コード | 説明 |
|-----------|--------|------|
| 401 | `UNAUTHORIZED` | 未認証 |
| 500 | `INTERNAL_ERROR` | サーバーエラー |

---

## POST /api/expenses

新規経費を登録する。登録直後のステータスは `draft`（下書き）となる。

### リクエスト

**メソッド**: `POST`
**パス**: `/api/expenses`
**Content-Type**: `application/json`

#### リクエストボディ

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `categoryId` | string | ✓ | カテゴリID |
| `description` | string | ✓ | 説明（1〜1000文字） |
| `amount` | number | ✓ | 金額（0より大きい値） |
| `expenseDate` | string | ✓ | 精算日（`YYYY-MM-DD`形式） |
| `receiptStatus` | string | - | 領収書状態（`none` / `available` / `uploaded`）デフォルト: `none` |
| `receiptPath` | string | - | 領収書ファイルパス |
| `transportType` | string | - | 交通手段（`train` / `bus` / `car` / `other`） |
| `roundTrip` | boolean | - | 往復かどうか。デフォルト: `false` |

#### リクエスト例

```json
{
  "categoryId": "clxxxxxxxxxxxxxxx",
  "description": "東京-大阪 出張交通費",
  "amount": 13000,
  "expenseDate": "2026-03-15",
  "receiptStatus": "uploaded",
  "receiptPath": "/receipts/2026/03/receipt_001.pdf",
  "transportType": "train",
  "roundTrip": true
}
```

### レスポンス

**ステータス**: `201 Created`

```json
{
  "success": true,
  "data": {
    "id": "clxxxxxxxxxxxxxxx",
    "userId": "clxxxxxxxxxxxxxxx",
    "categoryId": "clxxxxxxxxxxxxxxx",
    "description": "東京-大阪 出張交通費",
    "amount": 13000,
    "expenseDate": "2026-03-15T00:00:00.000Z",
    "status": "draft",
    "receiptStatus": "uploaded",
    "receiptPath": "/receipts/2026/03/receipt_001.pdf",
    "transportType": "train",
    "roundTrip": true,
    "submittedAt": null,
    "approvalDate": null,
    "approvalComments": null,
    "rejectReason": null,
    "createdAt": "2026-03-23T09:00:00.000Z",
    "updatedAt": "2026-03-23T09:00:00.000Z",
    "user": {
      "id": "clxxxxxxxxxxxxxxx",
      "name": "山田 太郎",
      "email": "yamada@example.com"
    },
    "category": {
      "id": "clxxxxxxxxxxxxxxx",
      "name": "交通費",
      "code": "TRANSPORT"
    }
  },
  "message": "経費が正常に登録されました"
}
```

### エラーレスポンス

| ステータス | コード | 説明 |
|-----------|--------|------|
| 400 | `VALIDATION_ERROR` | バリデーションエラー |
| 400 | `CATEGORY_NOT_FOUND` | 指定カテゴリが存在しない |
| 401 | `UNAUTHORIZED` | 未認証 |
| 401 | `USER_NOT_FOUND` | セッションにユーザー情報がない |
| 500 | `INTERNAL_ERROR` | サーバーエラー |

---

## PUT /api/expenses/[id]

指定した経費を更新する。ステータス変更時は遷移ルールに従う。

### リクエスト

**メソッド**: `PUT`
**パス**: `/api/expenses/{id}`
**Content-Type**: `application/json`

#### パスパラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `id` | string | ✓ | 経費ID |

#### リクエストボディ（すべて任意）

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `categoryId` | string | カテゴリID |
| `description` | string | 説明（1〜1000文字） |
| `amount` | number | 金額（0より大きい値） |
| `expenseDate` | string | 精算日（`YYYY-MM-DD`形式） |
| `receiptStatus` | string | 領収書状態（`none` / `available` / `uploaded`） |
| `receiptPath` | string | 領収書ファイルパス |
| `transportType` | string | 交通手段（`train` / `bus` / `car` / `other`） |
| `roundTrip` | boolean | 往復かどうか |
| `status` | string | ステータス（`draft` / `submitted` / `approved` / `rejected`） |
| `approvalComments` | string | 承認コメント |
| `rejectReason` | string | 却下理由 |

#### ステータス遷移ルール

```
draft → submitted（申請）
submitted → approved（承認）
submitted → rejected（却下）
rejected → draft（差し戻し後の再編集）
approved → ※変更不可
```

| 現在のステータス | 変更可能なステータス |
|-----------------|-------------------|
| `draft` | `submitted` |
| `submitted` | `approved`, `rejected` |
| `approved` | なし（変更不可） |
| `rejected` | `draft` |

#### リクエスト例（申請）

```json
{
  "status": "submitted"
}
```

#### リクエスト例（内容更新）

```json
{
  "description": "東京-大阪 往復 出張交通費",
  "amount": 26000,
  "roundTrip": true
}
```

#### リクエスト例（却下）

```json
{
  "status": "rejected",
  "rejectReason": "領収書が不鮮明なため再提出してください"
}
```

### レスポンス

**ステータス**: `200 OK`

```json
{
  "success": true,
  "data": {
    "id": "clxxxxxxxxxxxxxxx",
    "userId": "clxxxxxxxxxxxxxxx",
    "categoryId": "clxxxxxxxxxxxxxxx",
    "description": "東京-大阪 出張交通費",
    "amount": 13000,
    "expenseDate": "2026-03-15T00:00:00.000Z",
    "status": "submitted",
    "receiptStatus": "uploaded",
    "receiptPath": "/receipts/2026/03/receipt_001.pdf",
    "transportType": "train",
    "roundTrip": true,
    "submittedAt": "2026-03-23T10:00:00.000Z",
    "approvalDate": null,
    "approvalComments": null,
    "rejectReason": null,
    "createdAt": "2026-03-23T09:00:00.000Z",
    "updatedAt": "2026-03-23T10:00:00.000Z",
    "user": {
      "id": "clxxxxxxxxxxxxxxx",
      "name": "山田 太郎",
      "email": "yamada@example.com"
    },
    "category": {
      "id": "clxxxxxxxxxxxxxxx",
      "name": "交通費",
      "code": "TRANSPORT"
    },
    "approver": null
  },
  "message": "経費が正常に更新されました"
}
```

### エラーレスポンス

| ステータス | コード | 説明 |
|-----------|--------|------|
| 400 | `VALIDATION_ERROR` | バリデーションエラー |
| 400 | `INVALID_STATUS_TRANSITION` | 不正なステータス遷移 |
| 400 | `CATEGORY_NOT_FOUND` | 指定カテゴリが存在しない |
| 401 | `UNAUTHORIZED` | 未認証 |
| 404 | `EXPENSE_NOT_FOUND` | 経費が存在しない |
| 500 | `INTERNAL_ERROR` | サーバーエラー |

---

## DELETE /api/expenses/[id]

指定した経費を削除する。承認済み（`approved`）の経費は削除不可。

### リクエスト

**メソッド**: `DELETE`
**パス**: `/api/expenses/{id}`

#### パスパラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `id` | string | ✓ | 経費ID |

#### リクエスト例

```
DELETE /api/expenses/clxxxxxxxxxxxxxxx
```

### レスポンス

**ステータス**: `200 OK`

```json
{
  "success": true,
  "message": "経費が正常に削除されました"
}
```

### エラーレスポンス

| ステータス | コード | 説明 |
|-----------|--------|------|
| 401 | `UNAUTHORIZED` | 未認証 |
| 403 | `CANNOT_DELETE_APPROVED` | 承認済み経費は削除不可 |
| 404 | `EXPENSE_NOT_FOUND` | 経費が存在しない |
| 500 | `INTERNAL_ERROR` | サーバーエラー |

---

## データモデル

### Expense（経費）

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `id` | string | 経費ID（CUID） |
| `userId` | string | 申請者ユーザーID |
| `categoryId` | string | カテゴリID |
| `description` | string | 説明（最大1000文字） |
| `amount` | number | 金額（円） |
| `expenseDate` | datetime | 精算日 |
| `status` | string | ステータス（後述） |
| `receiptStatus` | string | 領収書状態（後述） |
| `receiptPath` | string \| null | 領収書ファイルパス |
| `transportType` | string \| null | 交通手段（後述） |
| `roundTrip` | boolean | 往復フラグ |
| `submittedAt` | datetime \| null | 申請日時 |
| `approvalDate` | datetime \| null | 承認・却下日時 |
| `approvalComments` | string \| null | 承認コメント |
| `rejectReason` | string \| null | 却下理由 |
| `createdAt` | datetime | 作成日時 |
| `updatedAt` | datetime | 最終更新日時 |
| `user` | User | 申請者情報 |
| `category` | Category | カテゴリ情報 |
| `approver` | User \| null | 承認者情報 |

### ステータス一覧

| 値 | 説明 |
|----|------|
| `draft` | 下書き（初期状態） |
| `submitted` | 申請済み |
| `approved` | 承認済み |
| `rejected` | 却下 |

### 領収書ステータス（receiptStatus）

| 値 | 説明 |
|----|------|
| `none` | なし（デフォルト） |
| `available` | 手元にあり |
| `uploaded` | アップロード済み |

### 交通手段（transportType）

| 値 | 説明 |
|----|------|
| `train` | 電車 |
| `bus` | バス |
| `car` | 車 |
| `other` | その他 |

---

## エラーコード一覧

| コード | HTTPステータス | 説明 |
|--------|--------------|------|
| `UNAUTHORIZED` | 401 | 認証されていない |
| `USER_NOT_FOUND` | 401 | セッションにユーザー情報がない |
| `VALIDATION_ERROR` | 400 | リクエストボディのバリデーションエラー |
| `CATEGORY_NOT_FOUND` | 400 | 指定したカテゴリが存在しない |
| `EXPENSE_NOT_FOUND` | 404 | 指定した経費が存在しない |
| `INVALID_STATUS_TRANSITION` | 400 | 許可されていないステータス変更 |
| `CANNOT_DELETE_APPROVED` | 403 | 承認済み経費は削除不可 |
| `INTERNAL_ERROR` | 500 | サーバー内部エラー |
