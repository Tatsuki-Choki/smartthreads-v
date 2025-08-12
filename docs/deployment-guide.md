# SmartThreads 本番環境デプロイガイド

## 📋 前提条件

- Vercel Pro アカウント（Cronジョブ用）
- Supabase プロジェクト
- Threads App（Meta for Developers）
- ドメイン名（オプション）

## 🔐 ステップ1: 環境変数の設定

### 1.1 Supabase設定

1. [Supabase Dashboard](https://app.supabase.com)にログイン
2. プロジェクトを選択
3. **Settings > API** から以下を取得：
   - `NEXT_PUBLIC_SUPABASE_URL`: プロジェクトURL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: anon/public キー
   - `SUPABASE_SERVICE_ROLE_KEY`: service_role キー（秘密にする）

### 1.2 Threads API設定

1. [Meta for Developers](https://developers.facebook.com)にログイン
2. アプリを作成または選択
3. **Threads > 基本設定** から以下を取得：
   - `THREADS_APP_ID`: アプリID
   - `THREADS_APP_SECRET`: アプリシークレット

### 1.3 セキュリティキーの生成

```bash
# 暗号化キーの生成（32バイト）
openssl rand -base64 32
# 結果を THREADS_TOKEN_ENC_KEY に設定

# Cronシークレットの生成
openssl rand -hex 32
# 結果を CRON_SECRET に設定

# Webhookシークレットの生成
openssl rand -hex 32
# 結果を WEBHOOK_SECRET に設定
```

### 1.4 環境変数チェックリスト

| 変数名 | 説明 | 必須 | 例 |
|--------|------|------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | SupabaseプロジェクトURL | ✅ | https://xxx.supabase.co |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase公開キー | ✅ | eyJhbG... |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabaseサービスキー | ✅ | eyJhbG... |
| `APP_URL` | アプリケーションURL | ✅ | https://smartthreads.example.com |
| `THREADS_APP_ID` | Threads アプリID | ✅ | 123456789 |
| `THREADS_APP_SECRET` | Threads アプリシークレット | ✅ | abc123... |
| `THREADS_REDIRECT_URI` | OAuth リダイレクトURI | ✅ | https://smartthreads.example.com/api/auth/threads/callback |
| `THREADS_TOKEN_ENC_KEY` | トークン暗号化キー | ✅ | base64文字列 |
| `CRON_SECRET` | Cronジョブ認証用 | ✅ | ランダム文字列 |
| `WEBHOOK_SECRET` | Webhook認証用 | ✅ | ランダム文字列 |
| `THREADS_WEBHOOK_SECRET` | Threads Webhook用 | ⚠️ | ランダム文字列 |

## 🗄️ ステップ2: データベースマイグレーション

### 2.1 Supabase Storage設定

1. Supabaseダッシュボードで **Storage** を開く
2. **New bucket** をクリック
3. 以下の設定でバケットを作成：
   - Name: `media`
   - Public bucket: ✅ チェック
   - File size limit: 10MB
   - Allowed MIME types: `image/*,video/mp4,video/quicktime`

### 2.2 マイグレーション実行順序

以下の順序でSQLを実行してください：

1. **初期スキーマ** (`001_add_owner_and_slug.sql`)
2. **RLS修正** (`003_fix_rls_recursion.sql`)
3. **包括的修正** (`004_comprehensive_database_fix.sql`)
4. **自動返信機能** (`006_auto_reply_feature.sql`)
5. **スレッドフィールド** (`20250112_add_thread_fields.sql`)
6. **テンプレート削除** (`020_remove_template_and_pool.sql`)
7. **メディアカラム** (`021_add_media_columns_to_posts.sql`)
8. **メディアアップロード** (`022_create_media_uploads_table.sql`)

実行方法：
```bash
# Supabase CLIを使用
supabase db push

# または、Supabaseダッシュボードから
# SQL Editor > New query > 各SQLファイルの内容をペーストして実行
```

### 2.3 データベース権限確認

```sql
-- RLSが有効になっているか確認
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

-- 全テーブルでRLSが有効であることを確認
```

## 🚀 ステップ3: Vercelデプロイ

### 3.1 Vercel プロジェクト作成

```bash
# Vercel CLIインストール（未インストールの場合）
npm i -g vercel

# プロジェクトをVercelにリンク
vercel link

# 環境変数を設定
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
# ... 他の環境変数も同様に追加
```

### 3.2 vercel.json設定確認

```json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "crons": [
    {
      "path": "/api/cron/scheduled-posts",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/auto-reply/queue/process",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

### 3.3 デプロイ実行

```bash
# プロダクションデプロイ
vercel --prod
```

## 🔒 ステップ4: セキュリティ設定

### 4.1 Threads OAuth設定

1. Meta for Developersで以下を設定：
   - **有効なOAuthリダイレクトURI**: 
     - `https://your-domain.com/api/auth/threads/callback`
   - **アプリドメイン**: `your-domain.com`
   - **プライバシーポリシーURL**: 設定推奨
   - **利用規約URL**: 設定推奨

### 4.2 Content Security Policy

next.config.jsで設定済み：
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin

### 4.3 Rate Limiting確認

- Threads API: 60リクエスト/時間
- 実装済みのトークンバケットアルゴリズムで制御

## ✅ ステップ5: 動作確認

### 5.1 基本機能テスト

1. **認証フロー**
   - [ ] ログイン/ログアウト
   - [ ] Threads連携
   - [ ] ワークスペース切り替え

2. **投稿機能**
   - [ ] テキスト投稿
   - [ ] 画像付き投稿
   - [ ] 予約投稿
   - [ ] スレッド投稿

3. **自動返信**
   - [ ] ルール作成
   - [ ] Webhookテスト
   - [ ] 返信履歴確認

### 5.2 Cronジョブ確認

Vercelダッシュボードで確認：
- Functions > Cron > 実行履歴を確認

### 5.3 ログ監視

```bash
# Vercel CLIでログ確認
vercel logs --follow
```

## 🔧 トラブルシューティング

### 問題: 環境変数が反映されない
- Vercelダッシュボードで環境変数を確認
- 再デプロイを実行: `vercel --prod --force`

### 問題: データベース接続エラー
- Supabase接続プーリング設定を確認
- サービスキーの権限を確認

### 問題: Threads API エラー
- アプリの承認状態を確認
- レート制限を確認
- アクセストークンの有効期限を確認

### 問題: Cronジョブが実行されない
- Vercel Proプランであることを確認
- CRON_SECRETが正しく設定されているか確認
- Functionログでエラーを確認

## 📱 モバイル対応確認

- [ ] レスポンシブデザインの動作確認
- [ ] ハンバーガーメニューの動作
- [ ] ボトムナビゲーションの表示
- [ ] 画像アップロードのタッチ操作

## 🎉 デプロイ完了

以上でSmartThreadsの本番環境デプロイが完了です。
問題が発生した場合は、上記のトラブルシューティングを参照してください。