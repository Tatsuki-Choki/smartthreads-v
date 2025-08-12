import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

// Admin client for storage operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  
  try {
    // 認証チェック
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    }

    // FormDataからファイルを取得
    const formData = await request.formData()
    const file = formData.get('file') as File
    const mediaType = formData.get('mediaType') as string || 'threads'

    if (!file) {
      return NextResponse.json({ error: 'ファイルが選択されていません' }, { status: 400 })
    }

    // ファイルサイズチェック（10MB以下）
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'ファイルサイズは10MB以下にしてください' }, { status: 400 })
    }

    // MIMEタイプチェック
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: 'サポートされていないファイル形式です。JPEG, PNG, GIF, WebP, MP4, MOVのみ対応しています' 
      }, { status: 400 })
    }

    // ファイル名を生成（ユーザーID + タイムスタンプ + 元のファイル名）
    const timestamp = Date.now()
    const fileExt = file.name.split('.').pop()
    const fileName = `${user.id}/${mediaType}/${timestamp}.${fileExt}`

    console.log('メディアアップロード開始:', {
      fileName,
      fileSize: file.size,
      fileType: file.type,
      userId: user.id
    })

    // Supabase Storageにアップロード
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('media')
      .upload(fileName, file, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      console.error('アップロードエラー:', uploadError)
      return NextResponse.json({ 
        error: 'ファイルのアップロードに失敗しました' 
      }, { status: 500 })
    }

    // 公開URLを取得
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('media')
      .getPublicUrl(fileName)

    console.log('メディアアップロード成功:', {
      fileName,
      publicUrl
    })

    // メディア情報をデータベースに保存（オプション）
    const { data: mediaRecord, error: dbError } = await supabaseAdmin
      .from('media_uploads')
      .insert({
        user_id: user.id,
        file_name: file.name,
        file_path: fileName,
        file_size: file.size,
        mime_type: file.type,
        public_url: publicUrl,
        storage_bucket: 'media',
        media_type: mediaType,
      })
      .select()
      .single()

    if (dbError) {
      console.warn('メディア情報のDB保存に失敗:', dbError)
      // DBへの保存に失敗してもアップロードは成功として扱う
    }

    return NextResponse.json({
      success: true,
      upload: {
        id: mediaRecord?.id || timestamp.toString(),
        file_name: file.name,
        file_path: fileName,
        mime_type: file.type,
        public_url: publicUrl,
      },
      publicUrl
    })
    
  } catch (error) {
    console.error('メディアアップロードAPIエラー:', error)
    return NextResponse.json({ 
      error: 'アップロード処理中にエラーが発生しました' 
    }, { status: 500 })
  }
}