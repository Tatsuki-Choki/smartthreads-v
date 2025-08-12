import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { logSystemEvent } from '@/lib/monitoring/events';

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const body = await req.json();
    const {
      error,
      errorInfo,
      url,
      userAgent,
      timestamp
    } = body;

    // 現在のユーザー情報を取得
    const { data: { user } } = await supabase.auth.getUser();
    
    // 現在のワークスペースIDを取得
    const workspaceId = req.headers.get('x-workspace-id') || undefined;

    // クライアントサイドエラーをログに記録
    await logSystemEvent({
      eventType: 'system_error',
      title: `クライアントエラー: ${error.message}`,
      description: `URL: ${url}\nUser Agent: ${userAgent}`,
      severity: 'error',
      workspaceId,
      userId: user?.id,
      errorMessage: error.message,
      stackTrace: error.stack,
      metadata: {
        errorName: error.name,
        componentStack: errorInfo,
        url,
        userAgent,
        clientTimestamp: timestamp
      }
    });

    return NextResponse.json({ 
      success: true,
      message: 'エラーログを記録しました' 
    });

  } catch (error) {
    console.error('エラーログ記録失敗:', error);
    return NextResponse.json(
      { error: 'エラーログの記録に失敗しました' },
      { status: 500 }
    );
  }
}