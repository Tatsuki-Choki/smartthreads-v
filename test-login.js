const { chromium } = require('playwright');

async function testLogin() {
  const browser = await chromium.launch({ 
    headless: false,
    devtools: false 
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('1. ログインページへアクセス...');
    await page.goto('http://localhost:3000/login');
    await page.waitForTimeout(2000);
    
    // 既にログインしている場合はダッシュボードへリダイレクトされる
    if (page.url().includes('/dashboard')) {
      console.log('✅ 既にログイン済みです');
      
      // Cookieを取得
      const cookies = await context.cookies();
      console.log('\n=== ログイン情報 ===');
      console.log('セッションCookie数:', cookies.length);
      
      // ダッシュボードの内容を確認
      const welcomeText = await page.textContent('h1');
      console.log('ダッシュボードタイトル:', welcomeText);
      
      // ワークスペース情報を確認
      const workspaceInfo = await page.textContent('body');
      if (workspaceInfo.includes('ワークスペース')) {
        console.log('✅ ワークスペース情報が表示されています');
      }
      
    } else {
      console.log('ログインが必要です');
      console.log('\n手動でログインしてください:');
      console.log('1. メールアドレスを入力');
      console.log('2. パスワードを入力');
      console.log('3. ログインボタンをクリック');
      console.log('\n30秒待機します...');
      
      // ログインを待つ
      await page.waitForURL('**/dashboard', { timeout: 30000 }).catch(() => {
        console.log('ログインタイムアウト');
      });
      
      if (page.url().includes('/dashboard')) {
        console.log('✅ ログイン成功！');
      }
    }
    
    // 各ページへのアクセステスト
    console.log('\n=== 各ページへのアクセステスト ===');
    
    // 新規投稿ページ
    await page.goto('http://localhost:3000/posts/new');
    await page.waitForTimeout(1000);
    if (page.url().includes('/posts/new')) {
      console.log('✅ 新規投稿ページ: アクセス可能');
    }
    
    // 予約投稿ページ
    await page.goto('http://localhost:3000/posts/scheduled');
    await page.waitForTimeout(1000);
    if (page.url().includes('/posts/scheduled')) {
      console.log('✅ 予約投稿ページ: アクセス可能');
    }
    
    // 投稿履歴ページ
    await page.goto('http://localhost:3000/posts/history');
    await page.waitForTimeout(1000);
    if (page.url().includes('/posts/history')) {
      console.log('✅ 投稿履歴ページ: アクセス可能');
    }
    
    // 自動返信ルールページ
    await page.goto('http://localhost:3000/auto-reply/rules');
    await page.waitForTimeout(1000);
    if (page.url().includes('/auto-reply/rules')) {
      console.log('✅ 自動返信ルールページ: アクセス可能');
    } else {
      console.log('❌ 自動返信ルールページ: アクセス不可');
    }
    
    // 設定ページ
    await page.goto('http://localhost:3000/settings');
    await page.waitForTimeout(1000);
    if (page.url().includes('/settings')) {
      console.log('✅ 設定ページ: アクセス可能');
    }
    
    console.log('\n=== テスト完了 ===');
    console.log('ブラウザを開いたままにしています。');
    console.log('終了するにはCtrl+Cを押してください。');
    
    // ブラウザを開いたままにする
    await page.waitForTimeout(60000);

  } catch (error) {
    console.error('テストエラー:', error);
  }
}

testLogin().catch(console.error);