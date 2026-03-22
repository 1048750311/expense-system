# 経費精算システム - データベースセットアップガイド

## 概要

このガイドでは、SQLiteを用いた経費精算システムのデータベースセットアップについて説明します。

**Database**: SQLite
**ORM**: Prisma
**Version**: Prisma v5.22.0

---

## 前提条件

- Node.js 18.0 以上
- npm または yarn

---

## セットアップ手順

### 1. Prismaパッケージのインストール

```bash
npm install
```

このコマンドで `@prisma/client` と `prisma` が自動的にインストールされます。

### 2. 環境変数の設定

`.env.local` ファイルに以下の環境変数を設定してください：

```env
# Database
DATABASE_URL="file:./dev.db"

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here

# Azure AD
AZURE_AD_CLIENT_ID=your-client-id
AZURE_AD_CLIENT_SECRET=your-client-secret
AZURE_AD_TENANT_ID=your-tenant-id
```

### 3. Prismaスキーマの同期

Prismaスキーマをデータベースに同期します：

```bash
npm run db:push
```

このコマンドで以下が自動的に実行されます：
- SQLiteデータベース (`dev.db`) の作成
- 全テーブルとインデックスの作成
- Prismaクライアントの生成

**出力例:**
```
Your database is now in sync with your Prisma schema. Done in 105ms
✔ Generated Prisma Client (v5.22.0) to ./node_modules/@prisma/client in 83ms
```

### 4. データベースシードの実行（オプション）

初期データ（精算項目カテゴリ）をDBに挿入します：

```bash
npm run db:seed
```

### 5. Prisma Studio で確認（オプション）

ブラウザベースのGUIでデータベースを管理できます：

```bash
npm run db:studio
```

すると `http://localhost:5555` でPrisma Studioが開きます。

---

## データベーススキーマ

### 1. Users テーブル - ユーザー情報

|カラム名|型|制約|説明|
|---|---|---|---|
|id|String|PRIMARY KEY, unique|一意識別子 (CUID)|
|email|String|UNIQUE|メールアドレス|
|name|String|NOT NULL|ユーザー名|
|displayName|String|nullable|表示名|
|department|String|nullable|所属部門|
|role|String|default: "user"|ロール (user\|manager\|admin)|
|status|String|default: "active"|ステータス (active\|inactive)|
|image|String|nullable|プロフィール画像URL|
|azureId|String|UNIQUE, nullable|Azure AD オブジェクトID|
|createdAt|DateTime|default: now()|作成日時|
|updatedAt|DateTime|auto-update|更新日時|

**インデックス:**
- `status` - ステータス検索の高速化
- `department` - 部門検索の高速化

**関連テーブル:**
- `Expense` - 経費提出者との関連 (ExpenseSubmitter)
- `Expense` - 経費承認者との関連 (ExpenseApprover)

**使用例:**
```sql
-- Azure AD ユーザーを作成
INSERT INTO users (id, email, name, azureId, role, status)
VALUES ('user_abc123', 'user@example.com', '田中太郎', 'azure_id_xyz', 'user', 'active');
```

---

### 2. ExpenseCategories テーブル - 経費カテゴリマスタ

|カラム名|型|制約|説明|
|---|---|---|---|
|id|String|PRIMARY KEY, unique|一意識別子 (CUID)|
|name|String|UNIQUE|カテゴリ名|
|code|String|UNIQUE|カテゴリコード|
|description|String|nullable|説明|
|isActive|Boolean|default: true|有効/無効|
|createdAt|DateTime|default: now()|作成日時|
|updatedAt|DateTime|auto-update|更新日時|

**インデックス:**
- `isActive` - アクティブなカテゴリの検索

**関連テーブル:**
- `Expense` - 経費データとの関連

**標準カテゴリ:**
|name|code|説明|
|---|---|---|
|交通費|transportation|電車、バス、タクシーなどの交通費|
|食事代|meal|出張時の食事代|
|宿泊費|accommodation|出張時の宿泊費|
|会議費|meeting|会議室利用料など|
|その他|other|その他経費|

---

### 3. Expenses テーブル - 経費精算データ

|カラム名|型|制約|説明|
|---|---|---|---|
|id|String|PRIMARY KEY, unique|一意識別子 (CUID)|
|userId|String|FOREIGN KEY|提出者ユーザーID|
|categoryId|String|FOREIGN KEY|カテゴリID|
|description|String|NOT NULL|摘要・説明|
|amount|Float|NOT NULL|金額|
|expenseDate|DateTime|NOT NULL|経費発生日|
|receiptStatus|String|default: "none"|領収書状態 (none\|available\|uploaded)|
|receiptPath|String|nullable|領収書ファイルパス|
|transportType|String|nullable|交通手段 (train\|bus\|car\|other)|
|roundTrip|Boolean|default: false|往復フラグ|
|status|String|default: "draft"|ステータス (draft\|submitted\|approved\|rejected)|
|approverUserId|String|FOREIGN KEY, nullable|承認者ユーザーID|
|approvalDate|DateTime|nullable|承認日時|
|approvalComments|String|nullable|承認者コメント|
|rejectReason|String|nullable|却下理由|
|createdAt|DateTime|default: now()|作成日時|
|submittedAt|DateTime|nullable|提出日時|
|updatedAt|DateTime|auto-update|更新日時|

**インデックス:**
- `userId` - ユーザー別経費検索
- `categoryId` - カテゴリ別検索
- `status` - ステータス別検索
- `expenseDate` - 日付別検索
- `approverUserId` - 承認者別検索
- `(userId, status, createdAt)` - 複合インデックス（ダッシュボード表示用）

**外部キー制約:**
- `userId` → Users.id (CASCADE削除: ユーザー削除時に関連経費も削除)
- `categoryId` → ExpenseCategories.id (RESTRICT: カテゴリ削除を制限)
- `approverUserId` → Users.id (SET NULL: 承認者削除時に NULL に設定)

**ステータス遷移:**
```
draft → submitted → approved (成功)
              ↓
           rejected (却下)
```

---

## 開発ワークフロー

### スキーマの変更時

1. `prisma/schema.prisma` を編集
2. スキーマを同期：
   ```bash
   npm run db:push
   ```
3. 変更をコミット：
   ```bash
   git add prisma/schema.prisma
   git commit -m "Update database schema"
   ```

### 新しいカテゴリの追加

`prisma/seed.ts`を編集して、新しいカテゴリを`data`配列に追加：

```typescript
{
  name: '新しいカテゴリ',
  code: 'NEW_CATEGORY',
  description: '説明',
  isActive: true,
}
```

その後、シードを再実行：

```bash
npm run db:seed
```

---

## 便利なコマンド

| コマンド | 説明 |
|--------|------|
| `npm run db:push` | スキーマをDBに反映 |
| `npm run db:seed` | シードスクリプトを実行 |
| `npm run db:studio` | ブラウザでDB管理画面を開く |
| `npm run db:migrate` | マイグレーション履歴を確認 |

---

## トラブルシューティング

### Q: `DATABASE_URL not found` エラーが出る場合

**A:** `.env.local` ファイルが正しく設定されているか確認してください。

**確認コマンド:**
```bash
# Windows PowerShell
Get-Content .env.local | grep DATABASE_URL

# macOS/Linux
cat .env.local | grep DATABASE_URL
```

**必要な設定:**
```env
DATABASE_URL="file:./dev.db"
```

### Q: データベースがロックされている場合

**A:** 他のプロセスがデータベースを使用中の可能性があります。

**解決方法:**
1. dev server を停止（Ctrl+C）
2. Prisma Studio を閉じる（存在する場合）
3. 再度実行

### Q: スキーマの変更がデータベースに反映されない

**A:** Prismaスキーマを修正後、以下を実行してください：

```bash
npm run db:push  # スキーマの同期
```

### Q: 既存データを失わずにリセットしたい

**A:** データベースファイルを削除して再初期化：

```bash
# ファイル削除
rm dev.db    # macOS/Linux
del dev.db   # Windows PowerShell

# 再初期化
npm run db:push
npm run db:seed  # 初期データ投入（オプション）
```

---

## バックアップ

SQLiteはファイルベースのため、バックアップは簡単です：

```bash
# バックアップ作成
cp dev.db dev.db.backup      # macOS/Linux
Copy-Item dev.db dev.db.backup  # Windows PowerShell

# バックアップからの復元
cp dev.db.backup dev.db      # macOS/Linux
Copy-Item dev.db.backup dev.db  # Windows PowerShell
```

---

## セキュリティに関する注意

- `.env.local` は **絶対にGitにコミットしないでください** (.gitignore に登録済み)
- 本番環境では強力な `NEXTAUTH_SECRET` を使用してください
- Azure AD 認証情報は安全に管理してください
- SQLiteファイル (`dev.db`) は本番環境では適切なバックアップを取ってください

---

## 参考資料

- [Prisma ドキュメント](https://www.prisma.io/docs/)
- [Prisma SQLite ガイド](https://www.prisma.io/docs/reference/database-reference/connection-urls)
- [SQLite 公式](https://www.sqlite.org/)
- [NextAuth.js ドキュメント](https://next-auth.js.org/)

