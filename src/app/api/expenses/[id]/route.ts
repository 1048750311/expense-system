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

    const updateData = validationResult.data;

    // 経費の存在チェック
    const existingExpense = await prisma.expense.findUnique({
      where: { id },
    });

    if (!existingExpense) {
      return NextResponse.json(
        { success: false, error: '経費が見つかりません', code: 'EXPENSE_NOT_FOUND' },
        { status: 404 }
      );
    }

    // ステータス遷移のバリデーション
    if (updateData.status) {
      const currentStatus = existingExpense.status;
      const newStatus = updateData.status;

      // ステータス遷移ルール
      const validTransitions: Record<string, string[]> = {
        draft: ['submitted'],
        submitted: ['approved', 'rejected'],
        approved: [], // 変更不可
        rejected: ['draft'], // 再提出可能
      };

      if (!validTransitions[currentStatus]?.includes(newStatus)) {
        return NextResponse.json(
          {
            success: false,
            error: `ステータスを ${currentStatus} から ${newStatus} に変更することはできません`,
            code: 'INVALID_STATUS_TRANSITION'
          },
          { status: 400 }
        );
      }

      // 承認/却下時の処理
      if (newStatus === 'approved' || newStatus === 'rejected') {
        updateData.approverUserId = 'approver_' + Date.now(); // 仮実装
        updateData.approvalDate = new Date();
      }

      if (newStatus === 'submitted') {
        updateData.submittedAt = new Date();
      }
    }

    // カテゴリIDの存在チェック（更新する場合）
    if (updateData.categoryId) {
      const category = await prisma.expenseCategory.findUnique({
        where: { id: updateData.categoryId },
      });

      if (!category) {
        return NextResponse.json(
          { success: false, error: '指定されたカテゴリが見つかりません', code: 'CATEGORY_NOT_FOUND' },
          { status: 400 }
        );
      }
    }

    // 日付変換
    if (updateData.expenseDate) {
      updateData.expenseDate = new Date(updateData.expenseDate);
    }

    // 経費の更新
    const updatedExpense = await prisma.expense.update({
      where: { id },
      data: updateData,
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

    const { id } = params;

    // 経費の存在チェック
    const existingExpense = await prisma.expense.findUnique({
      where: { id },
    });

    if (!existingExpense) {
      return NextResponse.json(
        { success: false, error: '経費が見つかりません', code: 'EXPENSE_NOT_FOUND' },
        { status: 404 }
      );
    }

    // 承認済みの経費は削除不可
    if (existingExpense.status === 'approved') {
      return NextResponse.json(
        { success: false, error: '承認済みの経費は削除できません', code: 'CANNOT_DELETE_APPROVED' },
        { status: 403 }
      );
    }

    // 経費の削除
    await prisma.expense.delete({
      where: { id },
    });

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