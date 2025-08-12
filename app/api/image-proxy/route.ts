import { NextRequest, NextResponse } from 'next/server';

/**
 * 画像プロキシAPI
 * 外部画像（主にThreadsプロフィール画像）をプロキシして配信
 * CORS問題の解決とキャッシュ最適化を目的とする
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const imageUrl = searchParams.get('url');
    
    if (!imageUrl) {
      return NextResponse.json(
        { error: '画像URLが指定されていません' },
        { status: 400 }
      );
    }

    // URLの妥当性検証
    let url: URL;
    try {
      url = new URL(imageUrl);
    } catch {
      return NextResponse.json(
        { error: '無効な画像URLです' },
        { status: 400 }
      );
    }

    // 許可されたドメインかチェック
    const allowedDomains = [
      'graph.threads.net',
      'scontent.cdninstagram.com',
      'threads.net',
    ];

    const isAllowedDomain = allowedDomains.some(domain => 
      url.hostname === domain || url.hostname.endsWith(`.${domain}`)
    );

    if (!isAllowedDomain) {
      return NextResponse.json(
        { error: '許可されていないドメインです' },
        { status: 403 }
      );
    }

    // 画像を取得
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'SmartThreads/1.0',
        'Accept': 'image/*',
      },
      // タイムアウト設定
      signal: AbortSignal.timeout(10000), // 10秒
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: '画像の取得に失敗しました' },
        { status: response.status }
      );
    }

    // コンテンツタイプの検証
    const contentType = response.headers.get('content-type');
    if (!contentType?.startsWith('image/')) {
      return NextResponse.json(
        { error: '画像ファイルではありません' },
        { status: 400 }
      );
    }

    // 画像データを取得
    const imageBuffer = await response.arrayBuffer();

    // レスポンスヘッダーを設定
    const headers = new Headers({
      'Content-Type': contentType,
      'Content-Length': imageBuffer.byteLength.toString(),
      'Cache-Control': 'public, max-age=86400, s-maxage=86400', // 24時間キャッシュ
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
    });

    return new NextResponse(imageBuffer, {
      status: 200,
      headers,
    });

  } catch (error) {
    console.error('画像プロキシエラー:', error);
    
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        { error: '画像の取得がタイムアウトしました' },
        { status: 408 }
      );
    }

    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

// OPTIONSメソッドでCORSプリフライトリクエストに対応
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}