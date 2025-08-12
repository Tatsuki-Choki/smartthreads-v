# Supabase セットアップガイド

## 📋 前提条件
- Supabaseアカウント（[supabase.com](https://supabase.com)で作成）
- Node.js 18以上
- Supabase CLI（オプション）

## 🚀 セットアップ手順

### 1. Supabaseプロジェクトの作成

1. [Supabase Dashboard](https://app.supabase.com)にログイン
2. 「New Project」をクリック
3. 以下の情報を入力：
   - **Project name**: SmartThreads-V
   - **Database Password**: 強力なパスワードを生成（保存しておく）
   - **Region**: Tokyo (Northeast Asia)を推奨
   - **Pricing Plan**: Free（開発時）/ Pro（本番推奨）

### 2. データベースの初期化

#### 方法A: Supabase Dashboard経由（推奨）

1. プロジェクトダッシュボードの「SQL Editor」を開く
2. 以下のSQLファイルを順番に実行：
   - `/supabase/migrations/20250112_initial_schema.sql`
   - `/supabase/migrations/20250112_rls_policies.sql`

```sql
-- 各ファイルの内容をコピー＆ペーストして実行
```

#### 方法B: Supabase CLI経由

```bash
# Supabase CLIのインストール
npm install -g supabase

# ログイン
supabase login

# プロジェクトとリンク
supabase link --project-ref your-project-ref

# マイグレーション実行
supabase db push
```

### 3. 認証設定

1. Supabase Dashboardの「Authentication」→「Providers」を開く
2. 「Email」プロバイダーを有効化：
   - **Enable Email Signup**: ON
   - **Confirm Email**: ON（本番環境推奨）
   - **Secure Email Change**: ON

3. 「Authentication」→「URL Configuration」で設定：
   - **Site URL**: `https://your-domain.com`
   - **Redirect URLs**:
     ```
     https://your-domain.com/dashboard
     https://your-domain.com/threads-setup
     https://your-domain.com/api/auth/callback
     ```

### 4. ストレージ設定（オプション）

メディアファイルを扱う場合：

1. 「Storage」→「Create Bucket」
2. バケット名: `media`
3. Public bucket: OFF（プライベート推奨）
4. Allowed MIME types:
   ```
   image/jpeg
   image/png
   image/gif
   image/webp
   video/mp4
   video/quicktime
   ```

### 5. 環境変数の取得

1. 「Settings」→「API」を開く
2. 以下の値をコピー：
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** → `SUPABASE_SERVICE_ROLE_KEY`（秘密にする）

### 6. ローカル環境設定

`.env.local`ファイルを作成：

```bash
cp .env.production.example .env.local
```

取得した値を設定：

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 🔒 セキュリティ設定

### Row Level Security (RLS) の確認

SQLエディタで以下を実行して、RLSが有効になっていることを確認：

```sql
-- RLSステータス確認
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```

すべてのテーブルで`rowsecurity = true`であることを確認。

### Service Role Keyの保護

⚠️ **重要**: `SUPABASE_SERVICE_ROLE_KEY`は絶対に公開しないでください。
- クライアントサイドコードに含めない
- GitHubにコミットしない
- 環境変数として安全に管理

## 🧪 接続テスト

### 1. データベース接続テスト

```javascript
// test-supabase.js
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function testConnection() {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .single()
    
    if (error) throw error
    console.log('✅ Supabase接続成功')
  } catch (error) {
    console.error('❌ Supabase接続失敗:', error.message)
  }
}

testConnection()
```

実行：
```bash
node test-supabase.js
```

### 2. 認証テスト

```javascript
async function testAuth() {
  const { data, error } = await supabase.auth.signUp({
    email: 'test@example.com',
    password: 'testpassword123'
  })
  
  if (error) {
    console.error('認証エラー:', error)
  } else {
    console.log('認証成功:', data)
  }
}
```

## 📊 管理とモニタリング

### Supabase Dashboard

- **Table Editor**: データの閲覧・編集
- **SQL Editor**: カスタムクエリの実行
- **Auth Users**: ユーザー管理
- **Logs**: エラーログの確認

### 推奨される監視項目

1. **Database**:
   - 接続数
   - クエリパフォーマンス
   - ストレージ使用量

2. **Auth**:
   - 登録ユーザー数
   - ログイン失敗率
   - セッション数

3. **API**:
   - リクエスト数
   - レスポンスタイム
   - エラー率

## 🚨 トラブルシューティング

### よくある問題と解決方法

#### 1. RLSポリシーエラー
```
new row violates row-level security policy
```
**解決**: 
- ユーザーが認証されているか確認
- RLSポリシーが正しく設定されているか確認
- Service Role Keyを使用しているか確認

#### 2. 認証エラー
```
Invalid JWT
```
**解決**:
- 環境変数が正しく設定されているか確認
- トークンの有効期限を確認
- Supabase URLとキーのペアが一致しているか確認

#### 3. CORS エラー
**解決**:
- Supabase DashboardでURLが許可リストに追加されているか確認
- `NEXT_PUBLIC_SUPABASE_URL`が正しいか確認

## 📚 参考リンク

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase CLI](https://supabase.com/docs/guides/cli)