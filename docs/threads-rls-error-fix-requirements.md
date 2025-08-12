# Threads連携RLSエラー修正要件定義

## 問題の概要
Threads連携でユーザー情報取得は成功するが、データベース保存時にRLSポリシーエラーが発生し、実際には連携が完了していない。しかし、フロントエンドには成功表示がされる重大な不整合がある。

## 現状分析

### 1. 症状
- ✅ Threads APIからユーザー情報取得は成功（username: tatsuki_ch）
- ❌ threads_accountsテーブルへの保存でRLSエラー
- ❌ フロントエンドは成功表示するが、実際には連携されていない
- ❌ ダッシュボード・設定ページで連携アカウントが表示されない

### 2. エラー詳細
```
アカウント作成エラー: {
  code: '42501',
  message: 'new row violates row-level security policy for table "threads_accounts"'
}
```

### 3. 根本原因
`/api/auth/threads/verify/route.ts`が：
- 通常のSupabaseクライアント（`createRouteHandlerClient`）を使用
- RLSポリシーの制約を受ける
- threads_accountsテーブルに書き込めない
- **エラーが発生しても成功レスポンスを返している**（163-168行）

### 4. コードの問題箇所
```typescript
// 現在の問題のあるコード（verify/route.ts 153-168行）
const { error: insertError } = await supabase  // 通常のクライアント
  .from('threads_accounts')
  .insert({
    workspace_id: workspaceId,
    threads_user_id: userData.id,
    username: userData.username,
    access_token: access_token,
  })

if (insertError) {
  console.error('アカウント作成エラー:', insertError)
  return NextResponse.json(  // エラーレスポンスを返すべきだが...
    { error: 'アカウント情報の保存に失敗しました' },
    { status: 500 }
  )
}
// ↑このreturnが実行されていない？または別の場所で成功レスポンスが返されている
```

## ユーザー影響
1. **信頼性の喪失**: 「連携成功」と表示されるが実際は失敗
2. **機能不全**: Threads投稿機能が使えない
3. **混乱**: 何度試しても連携できない
4. **データ不整合**: フロントエンドとバックエンドの状態が一致しない

## 改修方針

### Phase 1: Service Roleキーを使った修正
1. **Adminクライアントの追加**
   ```typescript
   import { createClient } from '@supabase/supabase-js'
   
   const supabaseAdmin = createClient(
     process.env.NEXT_PUBLIC_SUPABASE_URL!,
     process.env.SUPABASE_SERVICE_ROLE_KEY!
   )
   ```

2. **データベース操作をAdminクライアントに変更**
   - SELECT操作: 通常クライアント（現状維持）
   - INSERT/UPDATE操作: Adminクライアント（変更必要）

### Phase 2: エラーハンドリングの改善
1. **エラー発生時は必ずエラーレスポンスを返す**
2. **成功レスポンスは保存成功後のみ返す**
3. **詳細なログ出力**

### Phase 3: トランザクション処理（オプション）
1. **原子性の保証**
2. **ロールバック機能**

## 実装計画

### 1. verify APIの修正（優先度: 最高）
```typescript
// 修正後のコード
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// データ保存（Adminクライアント使用）
const { data: newAccount, error: insertError } = await supabaseAdmin
  .from('threads_accounts')
  .insert({
    workspace_id: workspaceId,
    threads_user_id: userData.id,
    username: userData.username,
    access_token: access_token,
  })
  .select()
  .single()

if (insertError) {
  console.error('アカウント作成エラー:', insertError)
  return NextResponse.json(
    { error: 'アカウント情報の保存に失敗しました' },
    { status: 500 }
  )
}

console.log('Account created successfully:', newAccount)
// 成功レスポンスはここで返す
```

### 2. エラーレスポンスの統一（優先度: 高）
- すべてのエラーケースで適切なHTTPステータスコード
- 日本語のエラーメッセージ
- フロントエンドで適切にエラー表示

### 3. テスト手順
1. 既存のThreads連携データを削除（もしあれば）
2. verify APIを修正
3. Threads連携フローを最初から実行
4. データベースに保存されることを確認
5. ダッシュボードで連携表示を確認

## 成功基準
1. ✅ Threads APIでユーザー情報取得成功
2. ✅ データベースにthreads_accountsレコードが作成される
3. ✅ エラー時は適切なエラーメッセージが表示される
4. ✅ 成功時のみ成功メッセージが表示される
5. ✅ ダッシュボード・設定ページで連携アカウントが表示される
6. ✅ 再度連携を試みると「既に連携済み」と表示される

## リスク管理
1. **Service Roleキーの取り扱い**
   - 環境変数で管理
   - クライアント側に露出させない
   - 最小限の操作のみに使用

2. **既存データへの影響**
   - 既存の連携データがある場合の処理
   - マイグレーション不要（新規保存のみ）