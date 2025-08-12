# Supabaseスキーマキャッシュ問題の根本解決策 要件定義書

## 1. 問題の詳細分析

### 1.1 現象
- **エラーメッセージ**: "Could not find the 'parent_post_id' column of 'posts' in the schema cache"
- **影響範囲**: ツリー投稿機能（parent_post_id, thread_root_id, thread_position）
- **発生タイミング**: Supabase Admin Clientを使用したデータベース挿入/更新時

### 1.2 根本原因
1. **スキーマキャッシュの同期遅延**
   - マイグレーション実行後、Supabaseのスキーマキャッシュが即座に更新されない
   - TypeScript型定義とデータベース実態の不一致

2. **型定義の不整合**
   - `types/database.ts`に新しいカラムが反映されていない
   - Supabase CLIで生成された型定義が古い

3. **RLSポリシーの影響**
   - 新しいカラムに対するRLSポリシーが適切に設定されていない可能性

## 2. 解決策の要件

### 2.1 即時対応要件
1. **スキーマキャッシュの強制更新**
   - Supabase管理画面から手動でキャッシュをクリア
   - APIエンドポイントでのキャッシュ無効化

2. **型定義の再生成**
   - `npx supabase gen types typescript --local > types/database.ts`
   - 生成された型定義の検証と適用

### 2.2 恒久対応要件
1. **マイグレーション戦略の改善**
   - ALTER TABLEではなく、新テーブル作成アプローチ
   - データマイグレーションスクリプトの作成

2. **動的カラム検証**
   - 実行時にテーブル構造を確認するヘルパー関数
   - カラム存在チェック後の条件付き挿入

3. **フォールバック処理**
   - カラムが存在しない場合の代替処理
   - エラーハンドリングの強化

## 3. 実装方針

### 3.1 短期的解決策（1-2時間で実装可能）

#### Option A: 動的カラムチェック方式
```typescript
// lib/supabase/schema-helper.ts
export async function checkColumnExists(
  tableName: string, 
  columnName: string
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('information_schema.columns')
    .select('column_name')
    .eq('table_name', tableName)
    .eq('column_name', columnName)
    .single()
  
  return !error && !!data
}

// API実装での使用
const hasParentPostId = await checkColumnExists('posts', 'parent_post_id')
if (hasParentPostId) {
  insertData.parent_post_id = parentPostId
}
```

#### Option B: 別テーブル方式
```typescript
// thread_relationships テーブルを新規作成
interface ThreadRelationship {
  id: string
  post_id: string
  parent_post_id: string | null
  thread_root_id: string | null
  thread_position: number
  workspace_id: string
}
```

### 3.2 中期的解決策（1日で実装可能）

#### マイグレーション再実行戦略
1. **既存データのバックアップ**
   ```sql
   CREATE TABLE posts_backup AS SELECT * FROM posts;
   ```

2. **新しいpostsテーブルの作成**
   ```sql
   CREATE TABLE posts_new (
     -- 既存カラム
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     workspace_id UUID NOT NULL,
     -- 新規カラム（最初から含める）
     parent_post_id UUID REFERENCES posts_new(id),
     thread_root_id UUID REFERENCES posts_new(id),
     thread_position INTEGER DEFAULT 0,
     -- その他のカラム
   );
   ```

3. **データ移行とテーブル入れ替え**
   ```sql
   INSERT INTO posts_new SELECT * FROM posts_backup;
   ALTER TABLE posts RENAME TO posts_old;
   ALTER TABLE posts_new RENAME TO posts;
   ```

### 3.3 長期的解決策（2-3日で実装可能）

#### スキーマバージョニングシステム
1. **スキーマバージョンテーブル**
   ```sql
   CREATE TABLE schema_versions (
     version INTEGER PRIMARY KEY,
     applied_at TIMESTAMP DEFAULT NOW(),
     description TEXT
   );
   ```

2. **アプリケーション起動時チェック**
   ```typescript
   export async function validateSchema(): Promise<void> {
     const requiredVersion = 3 // parent_post_id追加版
     const currentVersion = await getCurrentSchemaVersion()
     
     if (currentVersion < requiredVersion) {
       throw new Error(`Schema version mismatch. Required: ${requiredVersion}, Current: ${currentVersion}`)
     }
   }
   ```

## 4. 実装優先順位

### Phase 1: 即座に実装（今すぐ）
1. ✅ 動的カラムチェック関数の実装
2. ✅ APIエンドポイントへの組み込み
3. ✅ エラーハンドリングの改善

### Phase 2: 本日中に実装
1. ⏳ Supabase型定義の再生成
2. ⏳ RLSポリシーの確認と修正
3. ⏳ テスト環境での動作確認

### Phase 3: 今週中に実装
1. ⏳ マイグレーション戦略の見直し
2. ⏳ スキーマバージョニングの導入
3. ⏳ CI/CDパイプラインの改善

## 5. テスト計画

### 5.1 単体テスト
- カラム存在チェック関数のテスト
- フォールバック処理のテスト
- エラーハンドリングのテスト

### 5.2 統合テスト
- ツリー投稿の作成テスト
- 既存投稿との互換性テスト
- パフォーマンステスト

### 5.3 回帰テスト
- 通常投稿機能の動作確認
- 予約投稿機能の動作確認
- 投稿履歴の表示確認

## 6. リスク評価と対策

### 6.1 リスク
1. **データ不整合**: 一部の投稿でparent_post_idが保存されない
   - 対策: 別テーブルでのリレーション管理

2. **パフォーマンス低下**: 動的チェックによる遅延
   - 対策: キャッシング機構の導入

3. **型安全性の喪失**: 動的処理による型チェックの無効化
   - 対策: ランタイム型検証の追加

## 7. 成功基準

1. **機能要件**
   - ツリー投稿が正常に作成できる
   - parent_post_id関連フィールドが保存される
   - エラーが発生しない

2. **非機能要件**
   - レスポンス時間: 3秒以内
   - エラー率: 0.1%以下
   - 可用性: 99.9%以上

## 8. 推奨実装順序

### 今すぐ実装すべき内容:

1. **動的カラムチェック実装**（15分）
2. **APIエンドポイントの修正**（30分）
3. **テスト実行**（15分）
4. **デプロイ**（10分）

この方式により、スキーマキャッシュ問題を根本的に解決し、将来的な拡張性も確保できます。