import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'application/pdf': 'pdf',
};

// POST /api/expenses/upload - 領収書アップロード
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

    // multipart/form-data の解析
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: 'ファイルが指定されていません', code: 'FILE_REQUIRED' },
        { status: 400 }
      );
    }

    // ファイルサイズチェック（5MB上限）
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: `ファイルサイズは5MB以下にしてください（現在: ${(file.size / 1024 / 1024).toFixed(1)}MB）`,
          code: 'FILE_TOO_LARGE',
        },
        { status: 400 }
      );
    }

    // ファイル形式チェック（MIMEタイプ）
    const extension = ALLOWED_MIME_TYPES[file.type];
    if (!extension) {
      return NextResponse.json(
        {
          success: false,
          error: 'jpg、png、pdf のみアップロードできます',
          code: 'INVALID_FILE_TYPE',
        },
        { status: 400 }
      );
    }

    // 保存先ディレクトリ: public/uploads/YYYY/MM/
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const uploadDir = join(process.cwd(), 'public', 'uploads', year, month);

    await mkdir(uploadDir, { recursive: true });

    // ファイル名: UUID.拡張子（パストラバーサル対策）
    const filename = `${randomUUID()}.${extension}`;
    const filePath = join(uploadDir, filename);

    // ファイル書き込み
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    // クライアントから参照できるパス（/uploads/YYYY/MM/filename）
    const publicPath = `/uploads/${year}/${month}/${filename}`;

    return NextResponse.json(
      {
        success: true,
        data: {
          path: publicPath,
          filename,
          originalName: file.name,
          size: file.size,
          mimeType: file.type,
        },
        message: '領収書が正常にアップロードされました',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/expenses/upload error:', error);
    return NextResponse.json(
      { success: false, error: 'サーバーエラーが発生しました', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
