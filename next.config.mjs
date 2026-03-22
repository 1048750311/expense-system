/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // テストファイルはビルド時のESLintチェック対象から除外
    dirs: ['src/app', 'src/components', 'src/lib'],
  },
};

export default nextConfig;
