import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // 認証チェック
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    // 現在のワークスペースIDを取得
    const workspaceId = req.headers.get('x-workspace-id');
    if (!workspaceId) {
      return NextResponse.json(
        { error: 'ワークスペースIDが必要です' },
        { status: 400 }
      );
    }

    // FormDataを取得
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const mediaType = formData.get('mediaType') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'ファイルが必要です' },
        { status: 400 }
      );
    }

    // ファイルサイズチェック
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'ファイルサイズが大きすぎます（最大10MB）' },
        { status: 400 }
      );
    }

    // ファイルタイプチェック
    const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
    const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);
    
    if (!isImage && !isVideo) {
      return NextResponse.json(
        { error: 'サポートされていないファイル形式です' },
        { status: 400 }
      );
    }

    // ユニークなファイル名を生成
    const fileExt = file.name.split('.').pop();
    const fileName = `${workspaceId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

    // メディアアップロードレコードを作成
    const { data: uploadRecord, error: recordError } = await supabase
      .from('media_uploads')
      .insert({
        workspace_id: workspaceId,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        storage_path: fileName,
        status: 'uploading',
        created_by: user.id
      })
      .select()
      .single();

    if (recordError) {
      console.error('アップロードレコード作成エラー:', recordError);
      return NextResponse.json(
        { error: 'アップロードレコードの作成に失敗しました' },
        { status: 500 }
      );
    }

    // Supabase Storageにアップロード
    const { data: storageData, error: storageError } = await supabase.storage
      .from('media')
      .upload(fileName, file, {
        contentType: file.type,
        upsert: false
      });

    if (storageError) {
      // アップロード失敗時はレコードを更新
      await supabase
        .from('media_uploads')
        .update({
          status: 'failed',
          error_message: storageError.message,
          updated_at: new Date().toISOString()
        })
        .eq('id', uploadRecord.id);

      console.error('ストレージアップロードエラー:', storageError);
      return NextResponse.json(
        { error: 'ファイルのアップロードに失敗しました' },
        { status: 500 }
      );
    }

    // 公開URLを取得
    const { data: { publicUrl } } = supabase.storage
      .from('media')
      .getPublicUrl(fileName);

    // アップロードレコードを更新
    const { data: updatedRecord, error: updateError } = await supabase
      .from('media_uploads')
      .update({
        status: 'ready',
        public_url: publicUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', uploadRecord.id)
      .select()
      .single();

    if (updateError) {
      console.error('レコード更新エラー:', updateError);
    }

    // Threads API用のメディアコンテナ作成（実装時に追加）
    let threadsMediaId = null;
    if (mediaType === 'threads') {
      // Threads APIでメディアコンテナを作成
      threadsMediaId = await createThreadsMediaContainer(publicUrl, isVideo ? 'VIDEO' : 'IMAGE');
    }

    return NextResponse.json({
      success: true,
      upload: updatedRecord || uploadRecord,
      publicUrl,
      threadsMediaId
    });

  } catch (error) {
    console.error('メディアアップロードエラー:', error);
    return NextResponse.json(
      { error: 'メディアアップロード中にエラーが発生しました' },
      { status: 500 }
    );
  }
}

// メディア一覧取得
export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // 認証チェック
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    // 現在のワークスペースIDを取得
    const workspaceId = req.headers.get('x-workspace-id');
    if (!workspaceId) {
      return NextResponse.json(
        { error: 'ワークスペースIDが必要です' },
        { status: 400 }
      );
    }

    // メディア一覧を取得
    const { data: uploads, error } = await supabase
      .from('media_uploads')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('status', 'ready')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('メディア一覧取得エラー:', error);
      return NextResponse.json(
        { error: 'メディア一覧の取得に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      uploads: uploads || [],
      total: uploads?.length || 0
    });

  } catch (error) {
    console.error('メディア一覧取得エラー:', error);
    return NextResponse.json(
      { error: 'メディア一覧取得中にエラーが発生しました' },
      { status: 500 }
    );
  }
}

// メディア削除
export async function DELETE(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // 認証チェック
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const uploadId = searchParams.get('id');

    if (!uploadId) {
      return NextResponse.json(
        { error: 'アップロードIDが必要です' },
        { status: 400 }
      );
    }

    // 現在のワークスペースIDを取得
    const workspaceId = req.headers.get('x-workspace-id');
    if (!workspaceId) {
      return NextResponse.json(
        { error: 'ワークスペースIDが必要です' },
        { status: 400 }
      );
    }

    // アップロードレコードを取得
    const { data: upload, error: fetchError } = await supabase
      .from('media_uploads')
      .select('*')
      .eq('id', uploadId)
      .eq('workspace_id', workspaceId)
      .single();

    if (fetchError || !upload) {
      return NextResponse.json(
        { error: 'メディアが見つかりません' },
        { status: 404 }
      );
    }

    // Storageから削除
    const { error: storageError } = await supabase.storage
      .from('media')
      .remove([upload.storage_path]);

    if (storageError) {
      console.error('ストレージ削除エラー:', storageError);
    }

    // レコードを削除済みに更新
    const { error: updateError } = await supabase
      .from('media_uploads')
      .update({
        status: 'deleted',
        updated_at: new Date().toISOString()
      })
      .eq('id', uploadId);

    if (updateError) {
      console.error('レコード更新エラー:', updateError);
      return NextResponse.json(
        { error: 'メディアの削除に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'メディアを削除しました'
    });

  } catch (error) {
    console.error('メディア削除エラー:', error);
    return NextResponse.json(
      { error: 'メディア削除中にエラーが発生しました' },
      { status: 500 }
    );
  }
}

// Threads APIでメディアコンテナを作成（モック実装）
async function createThreadsMediaContainer(
  mediaUrl: string,
  mediaType: 'IMAGE' | 'VIDEO'
): Promise<string | null> {
  // 実際のThreads API実装時に置き換え
  // POST https://graph.threads.net/v1.0/me/threads
  // {
  //   "media_type": mediaType,
  //   "image_url": mediaUrl (for images),
  //   "video_url": mediaUrl (for videos)
  // }
  
  return `mock_media_id_${Date.now()}`;
}