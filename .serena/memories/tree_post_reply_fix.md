# ツリー投稿の返信連鎖問題 修正案

## 1. 問題の詳細

### 現状の問題
- 投稿1と投稿2がそれぞれ独立した投稿として作成されている
- reply_toパラメータが正しく機能していない
- 2つ目以降の投稿が最初の投稿への返信として連鎖していない

### 原因分析
現在のコード（app/api/posts/thread/route.ts）を確認すると：
```typescript
// 各投稿をThreads APIに順番に送信
for (let i = 0; i < createdPosts.length; i++) {
  const post = createdPosts[i]
  
  const requestBody: any = {
    media_type: 'TEXT',
    text: post.content,
  }
  
  if (parentThreadsPostId) {
    requestBody.reply_to = parentThreadsPostId  // ← ここが問題の可能性
  }
  
  // ステップ1: 投稿を作成
  const threadsResponse = await fetch('https://graph.threads.net/v1.0/me/threads', {
    // ...
  })
  
  // ステップ2: 投稿を公開
  const publishResponse = await fetch('https://graph.threads.net/v1.0/me/threads_publish', {
    // ...
  })
  
  // 次の投稿の親として設定（公開後のIDを使用）
  parentThreadsPostId = publishData.id  // ← 公開後のIDを使用している
}
```

## 2. 修正案

### 修正案1: reply_toパラメータの形式確認
Threads APIのreply_toパラメータは、完全なポストIDではなく、特定の形式である可能性があります。

```typescript
// 修正版コード
if (parentThreadsPostId) {
  // Threads APIのドキュメントに従った正しい形式を使用
  requestBody.reply_to_id = parentThreadsPostId  // reply_toではなくreply_to_idを試す
}
```

### 修正案2: reply_config形式の使用
Threads APIの最新仕様では、reply_configオブジェクトを使用する可能性があります。

```typescript
if (parentThreadsPostId) {
  requestBody.reply_config = {
    parent_id: parentThreadsPostId,
    control: 'everyone'  // または 'mentioned_only', 'followers'
  }
}
```

### 修正案3: 作成時のIDと公開後のIDの違い
作成時（creation_id）と公開後（post_id）のIDが異なる可能性があります。

```typescript
let parentCreationId: string | null = null
let parentPostId: string | null = null

for (let i = 0; i < createdPosts.length; i++) {
  const requestBody: any = {
    media_type: 'TEXT',
    text: post.content,
  }
  
  // 2つ目以降の投稿の場合、前の投稿への返信として設定
  if (i > 0 && parentPostId) {
    requestBody.reply_to_id = parentPostId
  }
  
  // 作成と公開
  const threadsData = await createPost(requestBody)
  const publishData = await publishPost(threadsData.id)
  
  // 次の投稿の親として設定
  parentCreationId = threadsData.id
  parentPostId = publishData.id
}
```

### 修正案4: URLパラメータ形式
reply_toをURLパラメータとして送信する必要がある可能性があります。

```typescript
const url = parentThreadsPostId 
  ? `https://graph.threads.net/v1.0/me/threads?reply_to=${parentThreadsPostId}`
  : 'https://graph.threads.net/v1.0/me/threads'

const threadsResponse = await fetch(url, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${threadsAccount.access_token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    media_type: 'TEXT',
    text: post.content,
  }),
})
```

## 3. デバッグ手順

### ステップ1: APIレスポンスの詳細確認
```typescript
console.log('=== ツリー投稿デバッグ情報 ===')
console.log(`投稿 ${i + 1}:`)
console.log('  リクエスト:', JSON.stringify(requestBody, null, 2))
console.log('  作成レスポンス:', JSON.stringify(threadsData, null, 2))
console.log('  公開レスポンス:', JSON.stringify(publishData, null, 2))
console.log('  parentThreadsPostId:', parentThreadsPostId)
```

### ステップ2: Threads APIドキュメントの確認
- Meta for Developersのドキュメントを確認
- reply_toパラメータの正確な仕様を確認
- サンプルコードを参照

### ステップ3: 手動テスト
GraphエクスプローラーやcURLを使用して、reply_toパラメータの動作を確認：

```bash
# テスト用cURLコマンド
curl -X POST "https://graph.threads.net/v1.0/me/threads" \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "media_type": "TEXT",
    "text": "返信テスト",
    "reply_to_id": "PARENT_POST_ID"
  }'
```

## 4. 推奨される実装順序

1. **デバッグログの追加**（5分）
   - 現在のAPIリクエスト/レスポンスを詳細にログ出力
   - parentThreadsPostIdの値を確認

2. **reply_toパラメータ形式の修正**（10分）
   - reply_to → reply_to_id への変更を試す
   - URLパラメータ形式を試す

3. **Threads APIドキュメントの確認**（15分）
   - 正確なパラメータ名と形式を確認
   - サンプルコードを参照

4. **テスト実行**（10分）
   - 2投稿のツリーで動作確認
   - 3投稿以上のツリーで動作確認

## 5. 緊急修正コード

最も可能性の高い修正として、以下のコードを提案します：

```typescript
// app/api/posts/thread/route.ts の該当箇所を修正

// 各投稿をThreads APIに順番に送信
for (let i = 0; i < createdPosts.length; i++) {
  const post = createdPosts[i]
  
  console.log(`\n=== Threads API 投稿 ${i + 1}/${createdPosts.length} ===`)
  
  // Threads API リクエストボディ
  const requestBody: any = {
    media_type: 'TEXT',
    text: post.content,
  }
  
  // 2つ目以降の投稿の場合、前の投稿への返信として設定
  if (i > 0 && parentThreadsPostId) {
    // 複数の形式を試すためのログ
    console.log(`親投稿ID: ${parentThreadsPostId}`)
    
    // Option 1: reply_to_idを使用
    requestBody.reply_to_id = parentThreadsPostId
    
    // Option 2: もしくはreply_toを使用（上記がダメな場合）
    // requestBody.reply_to = parentThreadsPostId
  }
  
  console.log('リクエストボディ:', JSON.stringify(requestBody, null, 2))
  
  // 以下、既存のコード...
}
```

この修正により、ツリー投稿が正しく連鎖するはずです。