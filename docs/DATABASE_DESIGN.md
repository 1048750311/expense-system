# 経費精算システム - データベース設計書

## 概要
Bridge Systemの経費精算機能向けのデータベース設計ドキュメントです。
システムでは、ユーザー情報、精算データ、精算項目マスタを管理します。

## テーブル設計

### 1. `users` テーブル

ユーザー情報を管理するテーブルです。Azure AD（NextAuth.js）と連携します。

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| `id` | UUID | PK | ユーザーID（一意識別子） |
| `email` | String | UNIQUE, NOT NULL | メールアドレス |
| `name` | String | NOT NULL | ユーザー名 |
| `displayName` | String | - | 表示名 |
| `department` | String | - | 部門名 |
| `role` | Enum | NOT NULL, DEFAULT: 'user' | ロール（user, manager, admin） |
| `status` | Enum | NOT NULL, DEFAULT: 'active' | ステータス（active, inactive） |
| `image` | String | - | プロフィール画像URL（Azure ADから取得） |
| `azureId` | String | UNIQUE | Azure AD Object ID |
| `createdAt` | DateTime | NOT NULL, DEFAULT: NOW() | 作成日時 |
| `updatedAt` | DateTime | NOT NULL, DEFAULT: NOW() | 更新日時 |

**インデックス:**
- `email` (UNIQUE)
- `azureId` (UNIQUE)
- `status`
- `department`

**制約:**
- PK: `id`

---

### 2. `expense_categories` テーブル

精算項目のマスタテーブルです。精算の種類を定義します。

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| `id` | UUID | PK | カテゴリID |
| `name` | String | UNIQUE, NOT NULL | カテゴリ名（例: 交通費、食事代、宿泊費） |
| `code` | String | UNIQUE, NOT NULL | カテゴリコード（例: `TRANS`, `MEAL`, `HOTEL`） |
| `description` | String | - | 説明 |
| `isActive` | Boolean | NOT NULL, DEFAULT: true | 有効フラグ |
| `createdAt` | DateTime | NOT NULL, DEFAULT: NOW() | 作成日時 |
| `updatedAt` | DateTime | NOT NULL, DEFAULT: NOW() | 更新日時 |

**インデックス:**
- `code` (UNIQUE)
- `name` (UNIQUE)
- `isActive`

**制約:**
- PK: `id`

**初期値データ:**
```
- 交通費 (TRANS)
- 食事代 (MEAL)
- 宿泊費 (HOTEL)
- office用品 (OFFICE)
- その他 (OTHER)
```

---

### 3. `expenses` テーブル

精算データを管理するテーブルです。ユーザーが申請した精算情報を記録します。

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| `id` | UUID | PK | 精算ID |
| `userId` | UUID | FK(users.id), NOT NULL | 申請者ユーザーID |
| `categoryId` | UUID | FK(expense_categories.id), NOT NULL | 精算項目カテゴリID |
| `description` | String | NOT NULL | 使用用途（例: 訪問先への交通費） |
| `amount` | Decimal(10,2) | NOT NULL | 金額（0以上） |
| `expenseDate` | Date | NOT NULL | 使用日 |
| `receiptStatus` | Enum | NOT NULL, DEFAULT: 'none' | 領収書状態（none, available, uploaded） |
| `receiptPath` | String | - | 領収書ファイルパス（S3等） |
| `transportType` | Enum | - | 交通手段（train, bus, car, other）※交通費カテゴリのみ |
| `roundTrip` | Boolean | DEFAULT: false | 往復フラグ（true: 往復, false: 片道） |
| `status` | Enum | NOT NULL, DEFAULT: 'draft' | ステータス（draft, submitted, approved, rejected） |
| `approverUserId` | UUID | FK(users.id) | 承認者ユーザーID |
| `approvalDate` | DateTime | - | 承認日時 |
| `approvalComments` | Text | - | 承認コメント |
| `rejectReason` | Text | - | 却下理由 |
| `createdAt` | DateTime | NOT NULL, DEFAULT: NOW() | 作成日時 |
| `submittedAt` | DateTime | - | 提出日時 |
| `updatedAt` | DateTime | NOT NULL, DEFAULT: NOW() | 更新日時 |

**インデックス:**
- `userId`
- `categoryId`
- `status`
- `expenseDate`
- `approverUserId`
- `createdAt`
- 複合インデックス: `(userId, status, createdAt)`

**外部キー:**
- `userId` → `users.id`
- `categoryId` → `expense_categories.id`
- `approverUserId` → `users.id`

**制約:**
- PK: `id`
- `amount >= 0`

---

## 関連図（ER図）

```
┌─────────────────────┐
│      users          │
├─────────────────────┤
│ id (PK)             │
│ email               │
│ name                │
│ department          │
│ role                │
│ status              │
│ ...                 │
└─────────────────────┘
        ▲ 1:N       ▲ 1:N
        │           │
        │ userId    │ approverUserId
┌───────┴───────────┴─────────┐
│      expenses                │
├──────────────────────────────┤
│ id (PK)                      │
│ userId (FK)                  │
│ categoryId (FK) ──────┐      │
│ description           │      │
│ amount                │      │
│ expenseDate           │      │
│ status                │      │
│ approverUserId (FK)   │      │
│ ...                   │      │
└──────────────────────┼───────┘
                       │ 1:N
┌──────────────────────┴─────────┐
│   expense_categories            │
├─────────────────────────────────┤
│ id (PK)                         │
│ name                            │
│ code                            │
│ description                     │
│ isActive                        │
│ ...                             │
└─────────────────────────────────┘
```

---

## Prismaスキーマ定義

ファイル: `prisma/schema.prisma`

```prisma
// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum UserRole {
  user
  manager
  admin
}

enum UserStatus {
  active
  inactive
}

enum ReceiptStatus {
  none
  available
  uploaded
}

enum TransportType {
  train
  bus
  car
  other
}

enum ExpenseStatus {
  draft
  submitted
  approved
  rejected
}

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String
  displayName   String?
  department    String?
  role          UserRole  @default(user)
  status        UserStatus @default(active)
  image         String?
  azureId       String?   @unique

  // Relations
  expenses      Expense[]   @relation("ExpenseSubmitter")
  approvals     Expense[]   @relation("ExpenseApprover")

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@index([status])
  @@index([department])
  @@map("users")
}

model ExpenseCategory {
  id            String    @id @default(cuid())
  name          String    @unique
  code          String    @unique
  description   String?
  isActive      Boolean   @default(true)

  // Relations
  expenses      Expense[]

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@index([isActive])
  @@map("expense_categories")
}

model Expense {
  id                String        @id @default(cuid())
  userId            String
  user              User          @relation("ExpenseSubmitter", fields: [userId], references: [id])
  
  categoryId        String
  category          ExpenseCategory @relation(fields: [categoryId], references: [id])
  
  description       String
  amount            Decimal       @db.Decimal(10, 2)
  expenseDate       DateTime      @db.Date
  
  receiptStatus     ReceiptStatus @default(none)
  receiptPath       String?
  
  transportType     TransportType?
  roundTrip         Boolean       @default(false)
  
  status            ExpenseStatus @default(draft)
  
  approverUserId    String?
  approver          User?         @relation("ExpenseApprover", fields: [approverUserId], references: [id])
  approvalDate      DateTime?
  approvalComments  String?
  rejectReason      String?
  
  createdAt         DateTime      @default(now())
  submittedAt       DateTime?
  updatedAt         DateTime      @updatedAt

  @@index([userId])
  @@index([categoryId])
  @@index([status])
  @@index([expenseDate])
  @@index([approverUserId])
  @@index([userId, status, createdAt])
  @@map("expenses")
}
```

---

## マイグレーション戦略

### 初期化手順

```bash
# 1. Prismaをインストール
npm install @prisma/client
npm install -D prisma

# 2. Prismaを初期化（PostgreSQL用）
npx prisma init

# 3. .env.localにDATABASE_URLを設定
DATABASE_URL="postgresql://User:Password@localhost:5432/expense_system"

# 4. マイグレーションファイルを作成
npx prisma migrate dev --name init

# 5. Prisma Clientを生成
npx prisma generate
```

---

## データ初期化

### seed.ts ファイル

```typescript
// prisma/seed.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // カテゴリの初期化
  const categories = await prisma.expenseCategory.createMany({
    data: [
      { name: '交通費', code: 'TRANS', description: '電車、バス、タクシー等の交通費' },
      { name: '食事代', code: 'MEAL', description: '出張中の食事代' },
      { name: '宿泊費', code: 'HOTEL', description: '出張中の宿泊費' },
      { name: 'Office用品', code: 'OFFICE', description: 'Office用品の購入費' },
      { name: 'その他', code: 'OTHER', description: 'その他の経費' },
    ],
  });

  console.log(`Created ${categories.count} expense categories`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
```

---

## バックアップ・リカバリ戦略

### PostgreSQL バックアップ

```bash
# フルバックアップ
pg_dump -U username -h localhost expense_system > backup_$(date +%Y%m%d_%H%M%S).sql

# リストア
psql -U username -h localhost expense_system < backup.sql
```

---

## セキュリティ・権限設定

### データベースユーザー権限

```sql
-- アプリケーション用ユーザー（読書き権限）
CREATE USER app_user WITH PASSWORD 'secure_password';
GRANT USAGE ON SCHEMA public TO app_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO app_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- 管理者用ユーザー
CREATE USER db_admin WITH PASSWORD 'admin_password' CREATEDB CREATEROLE;
```

### アクセス制御

- ユーザーは自分の精算データのみ閲覧可能
- マネージャーは配下のユーザー数据を承認できる
- 管理者はすべてのデータにアクセス可能

---

## パフォーマンス考慮事項

### インデックス戦略

- `expenses(userId, status, createdAt)`: ユーザーごとのステータス検索
- `expenses(expenseDate)`: 日付範囲検索
- `users(status)`: アクティブユーザー検索

### クエリ最適化

```typescript
// 効率的なクエリ例
const userExpenses = await prisma.expense.findMany({
  where: {
    userId: userId,
    status: 'submitted',
  },
  include: {
    category: true,
    user: true,
    approver: true,
  },
  orderBy: { expenseDate: 'desc' },
  take: 50,
});
```

---

## 連携・手段

### NextAuth.js との連携

ユーザーテーブルは NextAuth.js で管理されるセッション情報と同期します。

```typescript
// src/lib/auth.ts
callbacks: {
  async session({ session, token }) {
    if (token) {
      // DBからユーザー情報を取得して拡張
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
      });
      session.user = { ...session.user, ...user };
    }
    return session;
  },
}
```

---

## トラブルシューティング

### よくある問題

| 問題 | 原因 | 解決方法 |
|-----|------|---------|
| Connection refused | DBが起動していない | `docker-compose up -d` でDB起動 |
| Migration failed | スキーマエラー | `npx prisma migrate reset` でリセット |
| Performance issues | インデックス不足 | スロークエリログを確認 |

---

## 今後の拡張

- [ ] 領収書画像の保存（S3/Cloudinary）
- [ ] 自動承認ルール
- [ ] 定期レポート出力
- [ ] 予算管理機能
- [ ] 複数通貨対応
- [ ] 一括承認機能

