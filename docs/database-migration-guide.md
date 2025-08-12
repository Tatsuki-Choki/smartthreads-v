# 📋 SmartThreads データベースマイグレーションガイド

## 🎯 概要

このガイドでは、SmartThreads v0.2の包括的データベースマイグレーション（`004_comprehensive_database_fix.sql`）の実行方法と、それに伴うタイプ定義の更新について説明します。

## 🚨 重要な事前確認事項

### マイグレーション前のチェックリスト
- [ ] **データベースのバックアップ**を作成済み
- [ ] **本番環境では実行しない**（開発・テスト環境で先に検証）
- [ ] Supabase CLIがインストール済み（`supabase --version`で確認）
- [ ] プロジェクトがSupabaseにリンク済み（`supabase status`で確認）

## 📊 マイグレーション内容

### 🆕 新規作成されるテーブル
1. **`users`** - ユーザープロファイル管理
2. **`auto_reply_rules`** - 自動返信ルール管理
3. **`comments`** - コメント管理と追跡
4. **`event_logs`** - 監査ログシステム
5. **`rate_limits`** - APIレート制限管理
6. **`system_settings`** - システム全体設定

### 🔧 既存テーブルの拡張
- **`posts`**: メディア添付、ツリー投稿、引用投稿対応
- **`threads_accounts`**: ステータス管理、有効期限、レート制限情報

### 🔐 セキュリティ機能
- 完全なRLS（Row Level Security）ポリシー
- マルチテナントデータ分離
- すべての操作の監査ログ

## 🚀 実行手順

### ステップ1: マイグレーションファイルの確認

```bash
# マイグレーションファイルが存在することを確認
ls -la supabase/migrations/004_comprehensive_database_fix.sql
```

### ステップ2: データベースマイグレーションの実行

```bash
# Supabaseの状態を確認
supabase status

# マイグレーションを実行
supabase db push

# 実行結果を確認
supabase db diff
```

### ステップ3: タイプ定義の更新

```bash
# 自動更新スクリプトを実行
./scripts/update_database_types.sh

# または手動で更新
cp types/database_updated.ts types/database.ts
```

### ステップ4: TypeScriptコンパイルの確認

```bash
# TypeScriptの型チェック
npx tsc --noEmit

# エラーがある場合は修正
npm run type-check
```

### ステップ5: アプリケーションのテスト

```bash
# 開発サーバーを起動
npm run dev

# ブラウザで動作確認
# http://localhost:3000
```

## 🔍 マイグレーション後の確認事項

### データベースの確認

```sql
-- テーブル一覧の確認
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- RLSポリシーの確認
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
ORDER BY tablename, policyname;

-- インデックスの確認
SELECT indexname, tablename, indexdef 
FROM pg_indexes 
WHERE schemaname = 'public' 
ORDER BY tablename, indexname;
```

### 機能テスト

1. **ユーザー認証**: ログイン・ログアウトが正常動作するか
2. **ワークスペース作成**: 新規ワークスペースが作成できるか
3. **投稿機能**: テキスト投稿、予約投稿が動作するか
4. **Threads連携**: アカウント連携が正常に動作するか

## ⚠️ トラブルシューティング

### よくある問題と解決方法

#### 問題1: マイグレーション実行時のエラー
```bash
# エラー詳細を確認
supabase db reset --debug

# 特定のマイグレーションを再実行
supabase migration repair <timestamp>
```

#### 問題2: RLSポリシーエラー
```sql
-- ポリシーの無効化（一時的）
ALTER TABLE table_name DISABLE ROW LEVEL SECURITY;

-- ポリシーの再作成
-- マイグレーションファイルの該当部分を再実行
```

#### 問題3: TypeScript型エラー
```bash
# 型定義を再生成
supabase gen types typescript --local > types/database_generated.ts

# 手動で型定義を修正
# types/database.ts を確認
```

### エラーログの確認方法

```bash
# Supabaseログの確認
supabase logs

# 特定のテーブルの確認
supabase db inspect table_name
```

## 🔄 ロールバック手順

万が一問題が発生した場合のロールバック方法：

### 方法1: データベースリセット（開発環境のみ）
```bash
# ⚠️ 全データが削除されるため注意！
supabase db reset
```

### 方法2: 特定マイグレーションのロールバック
```bash
# マイグレーション履歴の確認
supabase migration list

# 特定のマイグレーションを取り消し
supabase migration repair --status reverted <timestamp>
```

### 方法3: 手動ロールバック
```sql
-- テーブルの削除（逆順で実行）
DROP TABLE IF EXISTS system_settings CASCADE;
DROP TABLE IF EXISTS rate_limits CASCADE;
DROP TABLE IF EXISTS event_logs CASCADE;
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS auto_reply_rules CASCADE;

-- カラムの削除（既存テーブル）
ALTER TABLE posts DROP COLUMN IF EXISTS parent_post_id CASCADE;
ALTER TABLE posts DROP COLUMN IF EXISTS quoted_post_id CASCADE;
-- ... その他のカラム
```

## 📈 パフォーマンス監視

マイグレーション後は以下を監視：

1. **クエリパフォーマンス**: 遅いクエリがないか
2. **インデックス使用率**: インデックスが適切に使われているか
3. **RLSポリシー**: セキュリティポリシーがパフォーマンスに影響していないか

```sql
-- 遅いクエリの確認
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;
```

## ✅ 完了チェックリスト

マイグレーション完了後、以下を確認：

- [ ] 全テーブルが正常に作成されている
- [ ] RLSポリシーが適切に設定されている  
- [ ] インデックスが作成されている
- [ ] TypeScript型定義が更新されている
- [ ] アプリケーションが正常に動作している
- [ ] テスト環境での動作確認完了
- [ ] 本番デプロイ前の最終チェック完了

## 📞 サポート

問題が発生した場合：

1. **エラーログ**を確認して原因を特定
2. **トラブルシューティング**セクションを参照
3. **ロールバック**を検討（必要に応じて）
4. 解決しない場合は開発チームに連絡

---

**注意**: このマイグレーションは包括的な変更を含むため、必ず開発環境で十分にテストしてから本番環境に適用してください。