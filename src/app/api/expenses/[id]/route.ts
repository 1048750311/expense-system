import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// バリデーションスキーマ（更新用）
const updateExpenseSchema = z.object({
  categoryId: z.string().min(1).optional(),
  description: z.string().min(1).max(1000).optional(),
  amount: z.number().positive().optional(),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  receiptStatus: z.enum(['none', 'available', 'uploaded']).optional(),
  receiptPath: z.string().optional(),
  transportType: z.enum(['train', 'bus', 'car', 'other']).optional(),
  roundTrip: z.boolean().optional(),
  status: z.enum(['draft', 'submitted', 'approved', 'rejected']).optional(),
  approvalComments: z.string().optional(),
  rejectReason: z.string().optional(),
});

// ステータス遷移ルール
const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['submitted'],
  submitted: ['approved', 'rejected'],
  approved: [],
  rejected: ['draft'],
};

// PUT /api/expenses/[id] - 経費更新
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 認証チェック
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: '認証が必要です', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const sessionUser = session.user as { id?: string };
    if (!sessionUser.id) {
      return NextResponse.json(
        { success: false, error: 'ユーザー情報が見つかりません', code: 'USER_NOT_FOUND' },
        { status: 401 }
      );
    }

    const { id } = params;
    const body = await request.json();

    // バリデーション
    const validationResult = updateExpenseSchema.safeParse(body);
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

    const input = validationResult.data;

    // 経費の存在チェック
    const existingExpense = await prisma.expense.findUnique({ where: { id } });
    if (!existingExpense) {
      return NextResponse.json(
        { success: false, error: '経費が見つかりません', code: 'EXPENSE_NOT_FOUND' },
        { status: 404 }
      );
    }

    // 認可チェック：承認/却下はどのユーザーも可。内容変更は本人のみ
    const isOwner = existingExpense.userId === sessionUser.id;
    const isStatusChange = input.status !== undefined;
    const hasContentChange = Object.keys(input).some(k => k !== 'status' && k !== 'approvalComments' && k !== 'rejectReason');

    if (hasContentChange && !isOwner) {
      return NextResponse.json(
        { success: false, error: 'この経費を編集する権限がありません', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    // ステータス遷移のバリデーション
    if (isStatusChange) {
      const currentStatus = existingExpense.status;
      const newStatus = input.status as string;
      const allowed = VALID_TRANSITIONS[currentStatus] ?? [];

      if (!allowed.includes(newStatus)) {
        return NextResponse.json(
          {
            success: false,
            error: `ステータスを "${currentStatus}" から "${newStatus}" に変更することはできません`,
            code: 'INVALID_STATUS_TRANSITION',
          },
          { status: 400 }
        );
      }
    }

    // カテゴリの存在チェック（更新する場合）
    if (input.categoryId) {
      const category = await prisma.expenseCategory.findUnique({
        where: { id: input.categoryId },
      });
      if (!category) {
        return NextResponse.json(
          { success: false, error: '指定されたカテゴリが見つかりません', code: 'CATEGORY_NOT_FOUND' },
          { status: 400 }
        );
      }
    }

    // DB更新データの構築（ステータス遷移に応じた付加情報を設定）
    const updateData: Record<string, unknown> = {
      ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.amount !== undefined && { amount: input.amount }),
      ...(input.expenseDate !== undefined && { expenseDate: new Date(input.expenseDate) }),
      ...(input.receiptStatus !== undefined && { receiptStatus: input.receiptStatus }),
      ...(input.receiptPath !== undefined && { receiptPath: input.receiptPath }),
      ...(input.transportType !== undefined && { transportType: input.transportType }),
      ...(input.roundTrip !== undefined && { roundTrip: input.roundTrip }),
      ...(input.approvalComments !== undefined && { approvalComments: input.approvalComments }),
      ...(input.rejectReason !== undefined && { rejectReason: input.rejectReason }),
    };

    if (input.status) {
      updateData.status = input.status;

      if (input.status === 'submitted') {
        updateData.submittedAt = new Date();
      }

      if (input.status === 'approved' || input.status === 'rejected') {
        updateData.approverUserId = sessionUser.id;
        updateData.approvalDate = new Date();
      }
    }

    // 経費の更新
    const updatedExpense = await prisma.expense.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        category: {
          select: { id: true, name: true, code: true },
        },
        approver: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedExpense,
      message: '経費が正常に更新されました',
    });
  } catch (error) {
    console.error('PUT /api/expenses/[id] error:', error);
    return NextResponse.json(
      { success: false, error: 'サーバーエラーが発生しました', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

// DELETE /api/expenses/[id] - 経費削除
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 認証チェック
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: '認証が必要です', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const sessionUser = session.user as { id?: string };
    if (!sessionUser.id) {
      return NextResponse.json(
        { success: false, error: 'ユーザー情報が見つかりません', code: 'USER_NOT_FOUND' },
        { status: 401 }
      );
    }

    const { id } = params;

    // 経費の存在チェック
    const existingExpense = await prisma.expense.findUnique({ where: { id } });
    if (!existingExpense) {
      return NextResponse.json(
        { success: false, error: '経費が見つかりません', code: 'EXPENSE_NOT_FOUND' },
        { status: 404 }
      );
    }

    // 認可チェック：本人のみ削除可
    if (existingExpense.userId !== sessionUser.id) {
      return NextResponse.json(
        { success: false, error: 'この経費を削除する権限がありません', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    // 承認済みの経費は削除不可
    if (existingExpense.status === 'approved') {
      return NextResponse.json(
        { success: false, error: '承認済みの経費は削除できません', code: 'CANNOT_DELETE_APPROVED' },
        { status: 403 }
      );
    }

    await prisma.expense.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: '経費が正常に削除されました',
    });
  } catch (error) {
    console.error('DELETE /api/expenses/[id] error:', error);
    return NextResponse.json(
      { success: false, error: 'サーバーエラーが発生しました', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
