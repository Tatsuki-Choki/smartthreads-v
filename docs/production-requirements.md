# SmartThreads V 本番環境構築要件定義書

## 1. プロジェクト概要
SmartThreads V は、Meta Threads プラットフォームの自動投稿・管理システムです。  
本番環境を構築し、実際のThreadsアカウントと連携して運用可能な状態にします。

## 2. システム構成

### 2.1 インフラストラクチャ
- **フロントエンド/API**: Vercel (Pro プラン推奨)
- **データベース**: Supabase (PostgreSQL)
- **認証**: Supabase Auth
- **ファイルストレージ**: Supabase Storage
- **バックグラウンドジョブ**: Vercel Cron Jobs

### 2.2 技術スタック
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Supabase Client SDK
- Threads API v2.0

## 3. 必要な外部サービスアカウント

### 3.1 Meta for Developers
- [ ] Meta開発者アカウントの作成
- [ ] Threads Appの作成
- [ ] App ID, App Secretの取得
- [ ] OAuth Redirect URIの設定
- [ ] 必要な権限スコープの設定

### 3.2 Supabase
- [ ] Supabaseアカウントの作成
- [ ] 新規プロジェクトの作成
- [ ] プロジェクトURL、Anon Key、Service Role Keyの取得

### 3.3 Vercel
- [ ] Vercelアカウントの作成（Pro推奨）
- [ ] GitHubリポジトリとの連携
- [ ] ドメインの設定（オプション）

## 4. 実装タスク

### Phase 1: Supabase セットアップ (優先度: 高)

#### 4.1 データベーススキーマ
```sql
-- ユーザーテーブル
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT auth.uid(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ワークスペーステーブル
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ワークスペースメンバーテーブル
CREATE TABLE workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);

-- Threadsアカウントテーブル
CREATE TABLE threads_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  threads_user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  access_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, threads_user_id)
);

-- 投稿テーブル
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  threads_account_id UUID REFERENCES threads_accounts(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  media_urls TEXT[],
  status TEXT NOT NULL DEFAULT 'draft',
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  threads_post_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 4.2 RLS (Row Level Security) ポリシー
```sql
-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE threads_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Workspaces policies
CREATE POLICY "Users can view workspaces they belong to" ON workspaces
  FOR SELECT USING (
    owner_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM workspace_members 
      WHERE workspace_members.workspace_id = workspaces.id 
      AND workspace_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Owners can update workspaces" ON workspaces
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Users can create workspaces" ON workspaces
  FOR INSERT WITH CHECK (owner_id = auth.uid());

-- Workspace members policies
CREATE POLICY "Members can view workspace members" ON workspace_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
      AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Owners can manage workspace members" ON workspace_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workspaces
      WHERE workspaces.id = workspace_members.workspace_id
      AND workspaces.owner_id = auth.uid()
    )
  );

-- Threads accounts policies
CREATE POLICY "Members can view workspace threads accounts" ON threads_accounts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = threads_accounts.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Owners can manage threads accounts" ON threads_accounts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workspaces
      WHERE workspaces.id = threads_accounts.workspace_id
      AND workspaces.owner_id = auth.uid()
    )
  );

-- Posts policies
CREATE POLICY "Members can view workspace posts" ON posts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = posts.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can create posts" ON posts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = posts.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can update posts" ON posts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = posts.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );
```

### Phase 2: 認証システム実装 (優先度: 高)

#### 2.1 Supabase Auth設定
- [ ] メール認証の有効化
- [ ] パスワードポリシーの設定
- [ ] リダイレクトURLの設定

#### 2.2 認証フローの修正
- [ ] `/lib/auth.ts` の本番環境対応
- [ ] `SKIP_AUTH_CHECK` の削除
- [ ] 実際のSupabase認証への切り替え

### Phase 3: Threads API統合 (優先度: 高)

#### 3.1 Meta App設定
- [ ] Threads API権限の申請
- [ ] Webhook URLの設定
- [ ] テストユーザーの追加

#### 3.2 OAuth実装の本番化
- [ ] OAuth認証フローの実装
- [ ] アクセストークンの暗号化保存
- [ ] トークンリフレッシュ機能

### Phase 4: 環境変数設定 (優先度: 高)

#### 4.1 必要な環境変数
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Threads API
THREADS_APP_ID=742705564969130
THREADS_APP_SECRET=c92f143c931cfd2a23180968150392fb
THREADS_REDIRECT_URI=https://your-domain.com/api/auth/threads/callback

# Security
NEXTAUTH_SECRET=your-random-secret-key
ENCRYPTION_KEY=your-32-char-encryption-key

# Vercel Cron
CRON_SECRET=your-cron-secret

# Webhook
WEBHOOK_SECRET=your-webhook-secret
```

### Phase 5: デプロイ設定 (優先度: 中)

#### 5.1 Vercel設定
- [ ] 環境変数の設定
- [ ] ビルド設定の最適化
- [ ] Cron Jobsの設定

#### 5.2 本番用の調整
- [ ] エラーハンドリングの強化
- [ ] ログ出力の最適化
- [ ] レート制限の実装

### Phase 6: セキュリティ対策 (優先度: 高)

#### 6.1 データ保護
- [ ] アクセストークンの暗号化
- [ ] SQLインジェクション対策
- [ ] XSS対策

#### 6.2 アクセス制御
- [ ] API エンドポイントの保護
- [ ] CORS設定
- [ ] レート制限

## 5. テスト計画

### 5.1 機能テスト
- [ ] ユーザー登録・ログイン
- [ ] Threads連携フロー
- [ ] 投稿作成・公開
- [ ] 予約投稿
- [ ] ワークスペース管理

### 5.2 セキュリティテスト
- [ ] 認証バイパステスト
- [ ] データ分離テスト
- [ ] API脆弱性テスト

## 6. 運用準備

### 6.1 監視設定
- [ ] Vercel Analytics
- [ ] エラー監視（Sentry等）
- [ ] アップタイム監視

### 6.2 バックアップ
- [ ] データベースバックアップ設定
- [ ] 復旧手順の文書化

## 7. 実装優先順位

### 即座に実装すべき項目（Phase 1）
1. Supabaseプロジェクト作成
2. データベーススキーマとRLSポリシー
3. 認証システムの本番化
4. 環境変数の設定

### 次に実装すべき項目（Phase 2）
1. Threads OAuth実装
2. Vercelデプロイ
3. 基本機能のテスト

### 最後に実装すべき項目（Phase 3）
1. Cron Jobs設定
2. Webhook実装
3. 監視・ログ設定

## 8. 想定される問題と対策

### 8.1 現在判明している問題
- **問題**: 開発環境でRLSポリシー違反
- **原因**: 認証スキップによるユーザーIDの不整合
- **対策**: 本番環境では実際の認証を使用

### 8.2 注意事項
- Threads APIのレート制限（60リクエスト/時）
- アクセストークンの有効期限（60日）
- マルチテナントのデータ分離

## 9. 成功基準
- [ ] 実際のThreadsアカウントと連携可能
- [ ] 投稿の作成と公開が可能
- [ ] 予約投稿が指定時刻に自動公開
- [ ] 複数ユーザーでのデータ分離が機能
- [ ] 24時間の安定稼働

## 10. タイムライン
- **Week 1**: Supabase設定、認証実装
- **Week 2**: Threads連携、基本機能実装
- **Week 3**: デプロイ、テスト、調整
- **Week 4**: 本番運用開始、監視