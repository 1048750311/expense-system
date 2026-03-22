import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// バリデーションスキーマ
const createExpenseSchema = z.object({
  categoryId: z.string().min(1, 'カテゴリIDは必須です'),
  description: z.string().min(1, '説明は必須です').max(1000, '説明は1000文字以内で入力してください'),
  amount: z.number().positive('金額は0より大きい値を入力してください'),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日付形式が正しくありません'),
  receiptStatus: z.enum(['none', 'available', 'uploaded']).optional().default('none'),
  receiptPath: z.string().optional(),
  transportType: z.enum(['train', 'bus', 'car', 'other']).optional(),
  roundTrip: z.boolean().optional().default(false),
});

// GET /api/expenses - 経費一覧取得
export async function GET(request: NextRequest) {
  try {
    // 認証チェック
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: '認証が必要です', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);

    // クエリパラメータの取得
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status');
    const categoryId = searchParams.get('categoryId');
    const userId = searchParams.get('userId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // フィルタ条件の構築
    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (userId) {
      where.userId = userId;
    }

    if (startDate || endDate) {
      where.expenseDate = {};
      if (startDate) {
        where.expenseDate.gte = new Date(startDate);
      }
      if (endDate) {
        where.expenseDate.lte = new Date(endDate);
      }
    }

    // ソート条件
    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;

    // 総件数取得
    const total = await prisma.expense.count({ where });

    // データ取得
    const expenses = await prisma.expense.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        approver: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    });

    // 集計データ
    const summary = await prisma.expense.aggregate({
      where,
      _sum: {
        amount: true,
      },
      _count: true,
    });

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      data: {
        expenses,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
        summary: {
          totalAmount: summary._sum.amount || 0,
          count: summary._count,
        },
      },
    });

  } catch (error) {
    console.error('GET /api/expenses error:', error);
    return NextResponse.json(
      { success: false, error: 'サーバーエラーが発生しました', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

// POST /api/expenses - 経費新規登録
export async function POST(request: NextRequest) {
  try {
    // 認証チェック
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: '認証が必要です', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // バリデーション
    const validationResult = createExpenseSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'バリデーションエラー',
          code: 'VALIDATION_ERROR',
          details: validationResult.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // カテゴリの存在チェック
    const category = await prisma.expenseCategory.findUnique({
      where: { id: data.categoryId },
    });

    if (!category) {
      return NextResponse.json(
        { success: false, error: '指定されたカテゴリが見つかりません', code: 'CATEGORY_NOT_FOUND' },
        { status: 400 }
      );
    }

    // ユーザーの取得（Azure AD IDから）
    // TODO: セッションからユーザーIDを取得する方法を実装
    // 現時点では仮のユーザーIDを使用
    const userId = 'user_' + Date.now(); // 仮実装

    // 経費の作成
    const expense = await prisma.expense.create({
      data: {
        userId,
        categoryId: data.categoryId,
        description: data.description,
        amount: data.amount,
        expenseDate: new Date(data.expenseDate),
        receiptStatus: data.receiptStatus,
        receiptPath: data.receiptPath,
        transportType: data.transportType,
        roundTrip: data.roundTrip,
        status: 'draft',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: expense,
        message: '経費が正常に登録されました',
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('POST /api/expenses error:', error);
    return NextResponse.json(
      { success: false, error: 'サーバーエラーが発生しました', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}