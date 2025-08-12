#!/usr/bin/env node

/**
 * Threads API連携テストスクリプト
 * 実際にThreadsへの投稿をテストします
 */

const readline = require('readline');

// カラー出力用
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

console.log(`${colors.cyan}=====================================`);
console.log('Threads API 連携テスト');
console.log(`=====================================${colors.reset}\n`);

/**
 * APIリクエストを送信
 */
async function makeRequest(method, url, data = null, token = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    }
  };

  if (token) {
    options.headers['Authorization'] = `Bearer ${token}`;
  }

  if (data) {
    options.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(url, options);
    const result = await response.json();
    
    return {
      ok: response.ok,
      status: response.status,
      data: result
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error.message
    };
  }
}

/**
 * ログイン状態の確認
 */
async function checkAuth() {
  console.log(`${colors.blue}1. 認証状態を確認中...${colors.reset}`);
  
  const response = await makeRequest('GET', 'http://localhost:3000/api/auth/session');
  
  if (response.ok && response.data.user) {
    console.log(`${colors.green}✅ ログイン済み: ${response.data.user.email}${colors.reset}`);
    return response.data.user;
  } else {
    console.log(`${colors.red}❌ ログインが必要です${colors.reset}`);
    console.log('ブラウザで http://localhost:3000/login にアクセスしてログインしてください');
    return null;
  }
}

/**
 * ワークスペース情報の取得
 */
async function getWorkspace() {
  console.log(`\n${colors.blue}2. ワークスペース情報を取得中...${colors.reset}`);
  
  const response = await makeRequest('GET', 'http://localhost:3000/api/workspaces');
  
  if (response.ok && response.data.workspaces?.length > 0) {
    const workspace = response.data.workspaces[0];
    console.log(`${colors.green}✅ ワークスペース: ${workspace.name}${colors.reset}`);
    return workspace;
  } else {
    console.log(`${colors.red}❌ ワークスペースが見つかりません${colors.reset}`);
    return null;
  }
}

/**
 * Threadsアカウントの確認
 */
async function getThreadsAccount(workspaceId) {
  console.log(`\n${colors.blue}3. Threadsアカウントを確認中...${colors.reset}`);
  
  const response = await makeRequest(
    'GET',
    `http://localhost:3000/api/workspaces/${workspaceId}/threads-accounts`
  );
  
  if (response.ok && response.data.accounts?.length > 0) {
    const account = response.data.accounts[0];
    console.log(`${colors.green}✅ Threadsアカウント: @${account.username}${colors.reset}`);
    return account;
  } else {
    console.log(`${colors.red}❌ Threadsアカウントが連携されていません${colors.reset}`);
    console.log('設定画面からThreadsアカウントを連携してください');
    return null;
  }
}

/**
 * テスト投稿の作成
 */
async function createTestPost(workspaceId, accountId, content, mediaType = 'TEXT', scheduled = false) {
  console.log(`\n${colors.blue}4. テスト投稿を作成中...${colors.reset}`);
  
  const postData = {
    workspace_id: workspaceId,
    threads_account_id: accountId,
    content: content,
    // media_type, media_urls, carousel_itemsは一時的に除外
    scheduled_at: scheduled ? new Date(Date.now() + 10 * 60 * 1000).toISOString() : null // 10分後に予約
  };

  const response = await makeRequest('POST', 'http://localhost:3000/api/posts', postData);
  
  if (response.ok && response.data.post) {
    console.log(`${colors.green}✅ ${scheduled ? '予約' : ''}投稿を作成しました: ${response.data.post.id}${colors.reset}`);
    if (scheduled) {
      console.log(`   予約時刻: ${new Date(response.data.post.scheduled_at).toLocaleString('ja-JP')}`);
    }
    return response.data.post;
  } else {
    console.log(`${colors.red}❌ 投稿の作成に失敗しました: ${response.data.error}${colors.reset}`);
    if (response.data.details) {
      console.log(`   詳細: ${response.data.details}`);
    }
    return null;
  }
}

/**
 * 投稿をThreadsに公開
 */
async function publishPost(postId) {
  console.log(`\n${colors.blue}5. Threadsに投稿を公開中...${colors.reset}`);
  console.log(`${colors.yellow}⚠️  実際にThreadsに投稿されます${colors.reset}`);
  
  const response = await makeRequest(
    'POST',
    `http://localhost:3000/api/posts/${postId}/publish`
  );
  
  if (response.ok && response.data.threads_post_id) {
    console.log(`${colors.green}✅ 投稿が公開されました！${colors.reset}`);
    console.log(`   Threads投稿ID: ${response.data.threads_post_id}`);
    if (response.data.threads_url) {
      console.log(`   URL: ${response.data.threads_url}`);
    }
    return true;
  } else {
    console.log(`${colors.red}❌ 投稿の公開に失敗しました: ${response.data.error || response.data}${colors.reset}`);
    if (response.data.details) {
      console.log(`   詳細: ${JSON.stringify(response.data.details, null, 2)}`);
    }
    return false;
  }
}

/**
 * メインテスト実行
 */
async function runTest() {
  try {
    // 1. 認証確認
    const user = await checkAuth();
    if (!user) {
      console.log(`\n${colors.red}テストを中止します${colors.reset}`);
      return;
    }

    // 2. ワークスペース取得
    const workspace = await getWorkspace();
    if (!workspace) {
      console.log(`\n${colors.red}テストを中止します${colors.reset}`);
      return;
    }

    // 3. Threadsアカウント確認
    const account = await getThreadsAccount(workspace.id);
    if (!account) {
      console.log(`\n${colors.red}テストを中止します${colors.reset}`);
      return;
    }

    // 4. テスト内容の入力
    console.log(`\n${colors.cyan}=====================================${colors.reset}`);
    console.log('テスト投稿の内容を入力してください');
    console.log(`${colors.cyan}=====================================${colors.reset}`);
    
    const content = await question('投稿内容 (Enterでデフォルト): ') || 
      `SmartThreadsからのテスト投稿 🚀\n\n日時: ${new Date().toLocaleString('ja-JP')}\n\n#SmartThreads #テスト`;

    console.log(`\n${colors.yellow}以下の内容で投稿します:${colors.reset}`);
    console.log('---');
    console.log(content);
    console.log('---');

    const confirm = await question(`\n${colors.yellow}本当にThreadsに投稿しますか？ (yes/no): ${colors.reset}`);
    
    if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
      console.log(`${colors.yellow}投稿をキャンセルしました${colors.reset}`);
      return;
    }

    // 5. 投稿作成
    const post = await createTestPost(workspace.id, account.id, content);
    if (!post) {
      console.log(`\n${colors.red}テストを中止します${colors.reset}`);
      return;
    }

    // 6. Threadsに公開
    const published = await publishPost(post.id);

    // 結果サマリー
    console.log(`\n${colors.cyan}=====================================${colors.reset}`);
    console.log('テスト結果');
    console.log(`${colors.cyan}=====================================${colors.reset}`);
    
    if (published) {
      console.log(`${colors.green}✅ Threads API連携テスト成功！${colors.reset}`);
      console.log('\n以下の機能が正常に動作しています:');
      console.log('  ✅ ユーザー認証');
      console.log('  ✅ ワークスペース管理');
      console.log('  ✅ Threadsアカウント連携');
      console.log('  ✅ 投稿作成');
      console.log('  ✅ Threads API呼び出し');
    } else {
      console.log(`${colors.red}❌ テストが失敗しました${colors.reset}`);
      console.log('\n以下を確認してください:');
      console.log('  - Threadsアクセストークンが有効か');
      console.log('  - 環境変数が正しく設定されているか');
      console.log('  - ネットワーク接続が正常か');
    }

  } catch (error) {
    console.error(`\n${colors.red}エラーが発生しました: ${error.message}${colors.reset}`);
  } finally {
    rl.close();
  }
}

// テスト実行
console.log('開発サーバーが起動していることを確認してください (npm run dev)');
console.log('');

runTest();