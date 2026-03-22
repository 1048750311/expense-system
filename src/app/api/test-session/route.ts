// E2Eテスト専用セッション作成エンドポイント
// E2E_TEST=true のときのみ有効
import { NextResponse } from "next/server";
import { encode } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";

export async function POST() {
  if (process.env.E2E_TEST !== "true") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  // テストユーザーを作成または取得
  const user = await prisma.user.upsert({
    where: { email: "e2e-test@example.com" },
    update: { name: "E2Eテストユーザー" },
    create: { email: "e2e-test@example.com", name: "E2Eテストユーザー" },
  });

  // NextAuth互換のJWTトークンを生成
  const token = await encode({
    token: {
      id: user.id,
      name: user.name,
      email: user.email,
      sub: user.id,
    },
    secret: process.env.NEXTAUTH_SECRET || "test-secret-e2e",
  });

  // セッションCookieをセット
  const response = NextResponse.json({ success: true });
  response.cookies.set("next-auth.session-token", token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  return response;
}
