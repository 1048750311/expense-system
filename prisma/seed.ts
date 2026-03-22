import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 経費精算システム - データベースシードを開始します...');

  // 既存のカテゴリを削除（必要に応じて）
  await prisma.expenseCategory.deleteMany({});
  console.log('✓ 既存カテゴリを削除しました');

  // 精算項目カテゴリの初期化
  const categories = await prisma.expenseCategory.createMany({
    data: [
      // 交通費関連
      {
        name: '交通費',
        code: 'TRANS',
        description: '電車、バス、タクシー、飛行機等の交通費',
        isActive: true,
      },
      {
        name: '高速料金',
        code: 'HIGHWAY',
        description: '高速道路通行料金',
        isActive: true,
      },
      {
        name: '駐車場代',
        code: 'PARKING',
        description: '駐車場利用料金',
        isActive: true,
      },

      // 宿泊・出張関連
      {
        name: '宿泊費',
        code: 'HOTEL',
        description: '出張時のホテル宿泊費',
        isActive: true,
      },

      // 飲食関連
      {
        name: '食事代',
        code: 'MEAL',
        description: '出張中の食事代、会議時の軽食代',
        isActive: true,
      },
      {
        name: '接待交際費',
        code: 'ENTERTAIN',
        description: 'クライアント接待、会食費',
        isActive: true,
      },

      // 会議・研修関連
      {
        name: '会議費',
        code: 'MEETING',
        description: '会議室利用料、備品代',
        isActive: true,
      },
      {
        name: '研修・セミナー費',
        code: 'TRAINING',
        description: '研修参加費、セミナー参加費',
        isActive: true,
      },

      // 通信・OA関連
      {
        name: '通信費',
        code: 'TELECOM',
        description: '携帯電話料金、インターネット料金',
        isActive: true,
      },
      {
        name: 'OA機器・ソフト',
        code: 'SOFTWARE',
        description: 'ソフトウェアライセンス、OA機器購入費',
        isActive: true,
      },

      // 文具・事務用品関連
      {
        name: '文具・事務用品',
        code: 'OFFICE',
        description: '文具、プリント代、事務用品',
        isActive: true,
      },

      // 福利厚生関連
      {
        name: '慶弔費',
        code: 'CELEBRATION',
        description: '慶事・弔事関連費用',
        isActive: true,
      },
      {
        name: '福利厚生費',
        code: 'WELFARE',
        description: '社員旅行、懇親会費用',
        isActive: true,
      },

      // その他
      {
        name: 'その他',
        code: 'OTHER',
        description: '上記に該当しない経費',
        isActive: true,
      },
    ],
  });

  console.log(`✓ ${categories.count}個の精算項目カテゴリを作成しました`);

  // カテゴリ一覧を表示
  console.log('\n📋 作成されたカテゴリ一覧:');
  const createdCategories = await prisma.expenseCategory.findMany({
    select: {
      name: true,
      code: true,
      description: true,
    },
    orderBy: {
      name: 'asc',
    },
  });

  createdCategories.forEach((category, index) => {
    console.log(`${index + 1}. ${category.name} (${category.code})`);
    console.log(`   ${category.description}`);
  });

  console.log('\n🌱 シード処理が完了しました！');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('🚨 エラーが発生しました:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
