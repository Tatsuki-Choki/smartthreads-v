# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🚨 絶対ルール - 設計ドキュメント.mdの遵守

**重要**: このプロジェクトの実装は「設計ドキュメント.md」に記載された仕様を絶対ルールとして従う必要があります。設計ドキュメントに記載された内容から逸脱することは許可されません。

## 🇯🇵 日本語対応の必須要件

### 開発時の日本語使用
- **ToDo管理**: TodoWriteツールを使用する際は、すべて日本語で記載
- **コメント応答**: ユーザーへの応答は日本語で行う
- **コミットメッセージ**: 日本語での記載を推奨

### アプリケーション実装での日本語対応
- **エラーメッセージ**: すべてのエラーメッセージは日本語で表示
- **UIテキスト**: ボタン、ラベル、プレースホルダーなどすべて日本語
- **バリデーションメッセージ**: フォーム検証メッセージは日本語で表示
- **通知メッセージ**: 成功・警告・情報などの通知はすべて日本語
- **ログメッセージ**: ユーザー向けログは日本語（開発者向けは英語可）

### エラーメッセージ例
```typescript
// ❌ 悪い例
throw new Error("Workspace not found");

// ✅ 良い例
throw new Error("ワークスペースが見つかりません");
```

### UIテキスト例
```tsx
// ❌ 悪い例
<button>Submit</button>
<input placeholder="Enter your email" />

// ✅ 良い例
<button>送信</button>
<input placeholder="メールアドレスを入力" />
```

## Project Overview

SmartThreads v0.2 - A Threads auto-management web application for automating posts, scheduling, and comment responses on Meta's Threads platform. Multi-tenant SaaS architecture with workspace-based isolation.

## Technology Stack

- **Frontend**: Next.js (React-based)
- **Backend**: Vercel Functions (serverless)
- **Database**: Supabase PostgreSQL with Row Level Security (RLS)
- **Deployment**: Vercel Pro
- **Authentication**: Supabase Auth with Threads OAuth 2.0
- **Background Jobs**: Vercel Cron Jobs

## Development Commands

Since the project is in design phase, these commands will be relevant once implementation begins:

```bash
# Installation (once package.json exists)
npm install

# Development server
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Lint code
npm run lint

# Type checking
npm run type-check
```

## High-Level Architecture

### Core Components

1. **API Structure** (`/api/*`)
   - `/api/auth/*` - Threads OAuth and session management
   - `/api/posts/*` - CRUD operations for posts and scheduling
   - `/api/comments/*` - Auto-reply configuration and webhook processing
   - `/api/workspaces/*` - Multi-tenant workspace management
   - `/api/admin/*` - System administration endpoints

2. **Database Schema**
   - **Multi-tenant isolation**: All tables include `workspace_id` with RLS policies
   - **Key tables**: users, workspaces, posts, comments, auto_reply_rules, scheduled_posts
   - **Security**: Row Level Security enforces workspace boundaries at database level

3. **Security Architecture**
   - All database access through RLS policies based on `auth.uid()` and workspace membership
   - API routes validate workspace access before any operations
   - Threads access tokens encrypted using Supabase Vault

4. **Rate Limiting**
   - Token bucket algorithm implementation for Threads API compliance
   - Per-workspace limits with burst capacity
   - Automatic retry with exponential backoff

5. **Webhook Processing**
   - Real-time comment monitoring via Threads webhooks
   - Queue-based processing to prevent blocking
   - Automatic response matching using configured rules

## Critical Implementation Notes

### Threads API Integration
- Use official Threads API v2.0
- Handle rate limits: 60 requests/hour for posting
- Implement proper error handling for API failures
- Store access tokens securely in Supabase Vault

### Multi-tenant Data Isolation
- ALWAYS include workspace_id in queries
- Never expose data across workspace boundaries
- Validate workspace membership before any operation
- Use RLS policies as primary security layer

### Scheduled Posting System
- Vercel Cron runs every 5 minutes
- Check scheduled_posts table for due posts
- Implement retry logic with exponential backoff
- Update post status after successful/failed delivery

### Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
THREADS_APP_ID=
THREADS_APP_SECRET=
THREADS_REDIRECT_URI=
CRON_SECRET=
WEBHOOK_SECRET=
```

## Development Workflow

1. **Feature Implementation**
   - Start with database schema/migrations
   - Implement RLS policies for new tables
   - Create API routes with proper validation
   - Build UI components with error handling
   - Add comprehensive testing

2. **Testing Approach**
   - Unit tests for utility functions
   - Integration tests for API routes
   - E2E tests for critical user flows
   - Mock Threads API responses in tests

3. **Database Migrations**
   - Use Supabase migrations for schema changes
   - Test RLS policies thoroughly
   - Ensure backward compatibility

## MCP Tools Recommendations

When developing with Claude Code, enable these MCP servers:
- **Supabase MCP**: For database operations and migrations
- **HTTP/REST MCP**: For API testing and Threads API integration
- **Process/Command MCP**: For running development commands

## Key Design Decisions

1. **Serverless Architecture**: Chosen for scalability and cost-efficiency
2. **Supabase RLS**: Database-level security for multi-tenancy
3. **Webhook-based Updates**: Real-time comment processing without polling
4. **Queue Processing**: Prevents webhook timeout issues
5. **Token Bucket Rate Limiting**: Complies with Threads API limits while maximizing throughput

## 設計ドキュメントの主要仕様

### システム構成
- **フロントエンド**: Next.js (Vercel)
- **バックエンド**: Vercel Functions (サーバーレス)
- **データベース**: Supabase Postgres with RLS
- **ストレージ**: Supabase Storage (privateバケット)
- **認証**: Supabase Auth + Threads OAuth
- **バックグラウンドジョブ**: Vercel Cron Jobs

### 主要機能実装要件

#### 投稿機能
- 即時投稿: テキスト、画像、動画、カルーセル対応
- 予約投稿: 指定時刻での自動送出
- ツリー投稿: 親投稿への連続返信でスレッド化
- 引用投稿: 既存投稿の引用機能

#### コメント自動返信
- Webhookによる新着コメント受信
- キーワードルールマッチングによる自動返信
- テンプレートベースの返信生成

#### レート制限の実装
- トークンバケットアルゴリズム使用
- 投稿: 60リクエスト/時間
- 日次制限と短時間スロット制限の併用
- ヘッダー残量による動的補正

### セキュリティ要件

#### マルチテナント分離
- すべてのテーブルに`workspace_id`を含める
- RLSポリシーによる完全なデータ分離
- JWTの`current_workspace_id`を活用
- APIレベルでの`x-workspace-id`ヘッダー検証必須

#### データ保護
- Threads アクセストークンは暗号化保存
- Supabase Vaultを使用したトークン管理
- 監査対象操作はevent_logテーブルに記録

### エラーハンドリング
- 一時障害: エクスポネンシャルバックオフで最大N回再試行
- 永続障害: 即座にfailedステータス設定と通知

### パフォーマンス目標
- Webhook処理: p95 1秒未満
- 投稿API呼び出し: p95 3秒未満
- Cronジョブ間隔: 1-5分（設定可能）

### 日本語化要件（追加仕様）
- すべてのユーザー向けメッセージは日本語
- エラーメッセージ、バリデーション、通知はすべて日本語
- 管理UIのテキストはすべて日本語
- APIレスポンスのメッセージも日本語