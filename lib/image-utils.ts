/**
 * 画像ユーティリティ関数
 * 画像の最適化、サイズ調整、フォーマット変換などを行う
 */

// 画像のプロキシURL生成
export function getProxiedImageUrl(originalUrl: string): string {
  if (!originalUrl) return '/images/placeholder.png';
  
  // すでにプロキシURL、またはローカルURLの場合はそのまま返す
  if (originalUrl.startsWith('/') || originalUrl.includes('/_next/')) {
    return originalUrl;
  }

  // 外部URLの場合はプロキシを通す
  const encodedUrl = encodeURIComponent(originalUrl);
  return `/api/image-proxy?url=${encodedUrl}`;
}

// Threadsプロフィール画像の最適化URL生成
export function getOptimizedThreadsProfileUrl(
  profileUrl: string | null | undefined,
  size: 'small' | 'medium' | 'large' = 'medium'
): string {
  if (!profileUrl) {
    return '/images/default-avatar.png';
  }

  // Threadsプロフィール画像のサイズ指定
  const sizeMap = {
    small: '64',
    medium: '128', 
    large: '256'
  };

  // Threadsの画像URLにサイズパラメータを追加
  try {
    const url = new URL(profileUrl);
    url.searchParams.set('width', sizeMap[size]);
    url.searchParams.set('height', sizeMap[size]);
    return getProxiedImageUrl(url.toString());
  } catch {
    // 無効なURLの場合はプロキシURL生成
    return getProxiedImageUrl(profileUrl);
  }
}

// 画像ファイルサイズの推定
export function estimateImageSize(width: number, height: number, quality: number = 80): number {
  // JPEGの場合の大まかな推定（バイト）
  const pixels = width * height;
  const compressionRatio = quality / 100;
  return Math.round(pixels * 3 * compressionRatio * 0.1); // 大まかな推定式
}

// レスポンシブ画像のsizes属性生成
export function generateImageSizes(config: {
  mobile?: string;
  tablet?: string;
  desktop?: string;
  default?: string;
}): string {
  const { 
    mobile = '100vw',
    tablet = '50vw', 
    desktop = '33vw',
    default = '100vw'
  } = config;

  return [
    `(max-width: 768px) ${mobile}`,
    `(max-width: 1024px) ${tablet}`,
    `(min-width: 1025px) ${desktop}`,
    default
  ].join(', ');
}

// 画像の遅延読み込み設定
export function getImageLoadingStrategy(
  priority: boolean = false,
  eager: boolean = false
): 'lazy' | 'eager' {
  if (priority || eager) return 'eager';
  return 'lazy';
}

// 画像ファイルの拡張子からMIMEタイプを取得
export function getImageMimeType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop();
  
  const mimeTypes: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'avif': 'image/avif',
    'svg': 'image/svg+xml',
  };

  return mimeTypes[ext || ''] || 'image/jpeg';
}

// 画像のアスペクト比計算
export function calculateAspectRatio(width: number, height: number): string {
  const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
  const divisor = gcd(width, height);
  return `${width / divisor}/${height / divisor}`;
}

// 画像プリロード用のlink要素を生成
export function createImagePreloadLink(
  src: string, 
  sizes?: string,
  priority: 'high' | 'low' = 'low'
): string {
  const sizeAttr = sizes ? ` sizes="${sizes}"` : '';
  return `<link rel="preload" as="image" href="${src}"${sizeAttr} fetchpriority="${priority}">`;
}

// Supabase Storage URL生成
export function getSupabaseImageUrl(
  bucketName: string,
  filePath: string,
  transform?: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'webp' | 'avif' | 'jpg' | 'png';
  }
): string {
  const baseUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucketName}/${filePath}`;
  
  if (!transform) return baseUrl;

  const params = new URLSearchParams();
  if (transform.width) params.set('width', transform.width.toString());
  if (transform.height) params.set('height', transform.height.toString());
  if (transform.quality) params.set('quality', transform.quality.toString());
  if (transform.format) params.set('format', transform.format);

  return `${baseUrl}?${params.toString()}`;
}

// 画像URL検証
export function isValidImageUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    const validProtocols = ['http:', 'https:', 'data:'];
    return validProtocols.includes(parsedUrl.protocol);
  } catch {
    return false;
  }
}

// 画像のブラー用プレースホルダー生成
export function generateBlurDataUrl(
  width: number = 10, 
  height: number = 10,
  color: string = '#f3f4f6'
): string {
  // SVGベースのブラープレースホルダー
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${color}"/>
    </svg>
  `;
  
  const base64 = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

// 画像の最適化設定取得
export function getImageOptimizationConfig() {
  return {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    quality: 80,
    minimumCacheTTL: 60 * 60 * 24 * 7, // 7日間
  };
}