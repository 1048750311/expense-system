import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(daysAgo: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - randomInt(0, daysAgo));
  return d;
}

async function main() {
  console.log('🌱 ランダム精算データを生成します...');

  const users = await prisma.user.findMany();
  if (users.length === 0) {
    console.error('❌ ユーザーが存在しません');
    process.exit(1);
  }

  const categories = await prisma.expenseCategory.findMany({ where: { isActive: true } });
  if (categories.length === 0) {
    console.error('❌ カテゴリが存在しません。先に npm run db:seed を実行してください');
    process.exit(1);
  }

  const descriptions: Record<string, string[]> = {
    TRANS:       ['東京→新宿 電車代', '渋谷→品川 電車往復', '新幹線 東京→大阪', 'バス 羽田空港→都内', '電車 客先訪問'],
    HIGHWAY:     ['首都高速 往復', '東名高速 東京→名古屋', '外環道 通行料', '圏央道 往復利用'],
    PARKING:     ['コインパーキング 3時間', '客先駐車場 1日', '商業施設駐車場', '空港駐車場 2泊'],
    HOTEL:       ['出張 東京ビジネスホテル 1泊', '大阪出張 ホテル 2泊', '名古屋 シングル 1泊'],
    MEAL:        ['出張中昼食', '会議中の軽食', '客先訪問後の夕食', 'コンビニ 昼食代'],
    ENTERTAIN:   ['クライアント接待 会食', '取引先懇親会', '顧客向け昼食会'],
    MEETING:     ['会議室 半日利用', '会議備品購入', 'オンライン会議 ツール代'],
    TRAINING:    ['セミナー参加費', '社外研修費', 'オンライン講座 受講料'],
    TELECOM:     ['携帯電話 業務利用分', 'ポケットWi-Fi レンタル', '海外ローミング代'],
    SOFTWARE:    ['クラウドツール 月額', 'ライセンス更新費', 'ソフトウェア購入'],
    OFFICE:      ['文具 まとめ買い', 'コピー用紙 購入', '印刷代 資料作成'],
    CELEBRATION: ['慶弔 御祝儀', '社員 結婚祝い', '弔事 香典'],
    WELFARE:     ['社員懇親会費', '部署飲み会', 'チームビルディング費用'],
    OTHER:       ['その他 業務関連費用', '雑費', '業務用品購入'],
  };

  const statuses = ['draft', 'submitted', 'approved', 'rejected'] as const;
  const statusWeights = [20, 40, 30, 10]; // 割合（%）
  const transportTypes = ['train', 'bus', 'car', 'other'];

  function weightedStatus() {
    const r = randomInt(1, 100);
    let cum = 0;
    for (let i = 0; i < statuses.length; i++) {
      cum += statusWeights[i];
      if (r <= cum) return statuses[i];
    }
    return 'draft';
  }

  const COUNT = 30;
  let created = 0;

  for (let i = 0; i < COUNT; i++) {
    const user     = randomItem(users);
    const category = randomItem(categories);
    const status   = weightedStatus();
    const descs    = descriptions[category.code] ?? ['業務経費'];
    const date     = randomDate(180); // 過去180日以内

    const amountRanges: Record<string, [number, number]> = {
      TRANS: [200, 15000], HIGHWAY: [500, 5000], PARKING: [300, 3000],
      HOTEL: [6000, 20000], MEAL: [500, 3000], ENTERTAIN: [5000, 50000],
      MEETING: [1000, 30000], TRAINING: [5000, 80000], TELECOM: [1000, 10000],
      SOFTWARE: [3000, 50000], OFFICE: [500, 10000], CELEBRATION: [3000, 30000],
      WELFARE: [2000, 15000], OTHER: [500, 20000],
    };
    const [minA, maxA] = amountRanges[category.code] ?? [500, 10000];
    const amount = randomInt(minA / 100, maxA / 100) * 100;

    const data: Parameters<typeof prisma.expense.create>[0]['data'] = {
      userId:        user.id,
      categoryId:    category.id,
      description:   randomItem(descs),
      amount,
      expenseDate:   date,
      transportType: randomItem(transportTypes),
      roundTrip:     Math.random() > 0.5,
      receiptStatus: Math.random() > 0.4 ? 'available' : 'none',
      status,
    };

    if (status === 'submitted') {
      data.submittedAt = date;
    } else if (status === 'approved') {
      data.submittedAt   = date;
      data.approvalDate  = new Date(date.getTime() + randomInt(1, 5) * 86400000);
      data.approverUserId = user.id;
    } else if (status === 'rejected') {
      data.submittedAt   = date;
      data.approvalDate  = new Date(date.getTime() + randomInt(1, 3) * 86400000);
      data.approverUserId = user.id;
      data.rejectReason  = '証憑が不十分です。再提出してください。';
    }

    await prisma.expense.create({ data });
    created++;
    process.stdout.write(`\r  作成中... ${created}/${COUNT}`);
  }

  console.log(`\n✅ ${created}件のランダム精算データを作成しました`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
