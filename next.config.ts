import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export', // これが必須です（outフォルダを生成する設定）
  images: {
    unoptimized: true, // 静的エクスポート時の画像最適化エラーを防ぐ
  },
};

export default nextConfig;
