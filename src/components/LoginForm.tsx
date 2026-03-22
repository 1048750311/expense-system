"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export default function LoginForm() {
  const [isLoading, setIsLoading] = useState(false);

  const handleMicrosoftLogin = async () => {
    setIsLoading(true);
    try {
      await signIn("azure-ad", { callbackUrl: "/dashboard" });
    } catch (error) {
      console.error("ログインエラー:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* 左側：グリーングラデーション背景とロゴ */}
      <div className="w-full md:w-1/2 bg-gradient-to-br from-green-400 via-green-500 to-green-600 flex items-center justify-center p-6 md:p-12">
        <div className="text-center">
          {/* ロゴ */}
          <div className="mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 md:w-24 md:h-24 bg-white/20 backdrop-blur-md rounded-full">
              <svg
                className="w-12 h-12 md:w-14 md:h-14 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
          </div>

          {/* テキスト */}
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-3">
            Bridge System
          </h1>
          <p className="text-white/90 text-sm md:text-base lg:text-lg">
            支出管理システム
          </p>

          {/* デコレーション要素 */}
          <div className="mt-16 space-y-3">
            <div className="h-1 w-12 bg-white/30 mx-auto rounded-full"></div>
            <p className="text-white/70 text-xs md:text-sm">
              効率的な支出管理を実現する
            </p>
          </div>
        </div>
      </div>

      {/* 右側：ログインフォーム */}
      <div className="w-full md:w-1/2 bg-white flex flex-col items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-sm">
          <div className="mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">
              ようこそ
            </h2>
            <p className="text-gray-600 text-sm md:text-base">
              Bridge Systemにログインしてください
            </p>
          </div>

          {/* ログインフォーム */}
          <div className="space-y-4">
            {/* Microsoftでログインボタン */}
            <button
              onClick={handleMicrosoftLogin}
              disabled={isLoading}
              className="w-full py-3 px-4 bg-white border-2 border-gray-300 hover:border-gray-400 hover:shadow-lg rounded-lg font-semibold text-gray-700 text-sm md:text-base transition-all duration-200 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {/* Microsoftロゴ */}
              <svg
                className="w-5 h-5"
                viewBox="0 0 23 23"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect x="1" y="1" width="9" height="9" fill="#F25022" />
                <rect x="13" y="1" width="9" height="9" fill="#7FBA00" />
                <rect x="1" y="13" width="9" height="9" fill="#00A4EF" />
                <rect x="13" y="13" width="9" height="9" fill="#FFB900" />
              </svg>
              {isLoading ? "ログイン中..." : "Microsoftでログイン"}
            </button>

            {/* または区切り */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-600">または</span>
              </div>
            </div>

            {/* メールでログイン */}
            <div className="space-y-3">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  メールアドレス
                </label>
                <input
                  type="email"
                  id="email"
                  placeholder="your@example.com"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm md:text-base"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  パスワード
                </label>
                <input
                  type="password"
                  id="password"
                  placeholder="••••••••"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm md:text-base"
                />
              </div>

              <button
                className="w-full py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold rounded-lg transition-all duration-200 text-sm md:text-base"
              >
                ログイン
              </button>
            </div>
          </div>

          {/* フッター */}
          <div className="mt-8 text-center text-xs md:text-sm text-gray-600 space-y-2">
            <p>
              アカウントをお持ちでないですか？{" "}
              <a href="#" className="text-green-600 hover:text-green-700 font-semibold">
                登録
              </a>
            </p>
            <p>
              <a href="#" className="text-green-600 hover:text-green-700 font-semibold">
                パスワードをお忘れですか？
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
