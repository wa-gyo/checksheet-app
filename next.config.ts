import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export', // ← 静的HTML（outフォルダ）を出力する設定
  images: {
    unoptimized: true, // 静的エクスポート時の画像最適化エラー防止
  },
};

export default nextConfig;