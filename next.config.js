/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // 画像最適化設定
  images: {
    // 許可された外部画像ドメイン
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'graph.threads.net',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.threads.net',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'scontent.cdninstagram.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'supabase.com',
        port: '',
        pathname: '/**',
      },
    ],
    // 画像フォーマット（WebP、AVIF対応）
    formats: ['image/webp', 'image/avif'],
    // 画像サイズ最適化
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // 画像の最小化キャッシュTTL（秒）
    minimumCacheTTL: 60 * 60 * 24 * 7, // 7日間
    // 危険なファイルタイプを許可しない
    dangerouslyAllowSVG: false,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // 実験的機能の有効化
  experimental: {
    // 画像最適化の改善
    optimizePackageImports: ['lucide-react'],
  },

  // パフォーマンス最適化
  poweredByHeader: false,
  
  // セキュリティヘッダー
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
      // 画像に対するキャッシュヘッダー
      {
        source: '/_next/image',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },

  // 静的ファイルの最適化
  async rewrites() {
    return [
      // Threadsプロフィール画像のプロキシ
      {
        source: '/api/image-proxy/:path*',
        destination: '/api/image-proxy/:path*',
      },
    ];
  },
};

module.exports = nextConfig;