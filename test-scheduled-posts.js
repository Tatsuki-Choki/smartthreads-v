const { chromium } = require('playwright');

async function testScheduledPosts() {
  const browser = await chromium.launch({ 
    headless: false,
    devtools: true 
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Enable console logging
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('❌ Console Error:', msg.text());
    }
  });

  page.on('pageerror', err => {
    console.log('❌ Page Error:', err.message);
  });

  try {
    // 1. ログイン
    console.log('1. ログインページへアクセス...');
    await page.goto('http://localhost:3000/login');
    await page.waitForTimeout(2000);
    
    // 既にログインしている場合はダッシュボードへリダイレクトされる
    if (page.url().includes('/dashboard')) {
      console.log('✅ 既にログイン済み');
    } else {
      console.log('ログインが必要です。手動でログインしてください。');
      await page.waitForTimeout(10000);
    }

    // 2. 予約投稿ページへ移動
    console.log('\n2. 予約投稿ページへアクセス...');
    await page.goto('http://localhost:3000/posts/scheduled');
    await page.waitForTimeout(3000);

    // 3. 予約投稿の編集ボタンを確認
    console.log('\n3. 予約投稿の操作ボタンを確認...');
    
    // テーブル内のボタンを検査
    const editButtons = await page.$$('button:has-text("編集")');
    const duplicateButtons = await page.$$('button:has-text("複製")');
    const publishButtons = await page.$$('button:has-text("今すぐ投稿")');
    const deleteButtons = await page.$$('button:has-text("削除")');
    
    console.log(`  編集ボタン: ${editButtons.length}個`);
    console.log(`  複製ボタン: ${duplicateButtons.length}個`);
    console.log(`  今すぐ投稿ボタン: ${publishButtons.length}個`);
    console.log(`  削除ボタン: ${deleteButtons.length}個`);

    // 4. 編集ボタンをクリックしてみる
    if (editButtons.length > 0) {
      console.log('\n4. 編集ボタンをクリック...');
      await editButtons[0].click();
      await page.waitForTimeout(2000);
      
      // URLが変わったか確認
      console.log(`  現在のURL: ${page.url()}`);
      
      // エラーメッセージが表示されているか確認
      const errorMessages = await page.$$('.text-red-500, .text-destructive, [role="alert"]');
      if (errorMessages.length > 0) {
        console.log('  ❌ エラーメッセージが表示されています');
        for (const msg of errorMessages) {
          const text = await msg.textContent();
          console.log(`    - ${text}`);
        }
      }
      
      // 予約投稿ページに戻る
      await page.goto('http://localhost:3000/posts/scheduled');
      await page.waitForTimeout(2000);
    }

    // 5. 複製ボタンをクリックしてみる
    if (duplicateButtons.length > 0) {
      console.log('\n5. 複製ボタンをクリック...');
      await duplicateButtons[0].click();
      await page.waitForTimeout(2000);
      
      // トーストメッセージを確認
      const toasts = await page.$$('[data-sonner-toast], [data-toast]');
      if (toasts.length > 0) {
        console.log('  トーストメッセージ:');
        for (const toast of toasts) {
          const text = await toast.textContent();
          console.log(`    - ${text}`);
        }
      }
    }

    // 6. 自動返信ルールページへアクセス
    console.log('\n6. 自動返信ルールページへアクセス...');
    
    const response = await page.goto('http://localhost:3000/auto-reply/rules', {
      waitUntil: 'networkidle'
    });
    
    console.log(`  ステータスコード: ${response?.status()}`);
    console.log(`  現在のURL: ${page.url()}`);
    
    if (response?.status() === 404) {
      console.log('  ❌ 404エラーが発生しています');
      
      // ページ内容を確認
      const pageContent = await page.textContent('body');
      console.log(`  ページ内容: ${pageContent.substring(0, 200)}...`);
    } else if (page.url().includes('/login')) {
      console.log('  ⚠️ ログインページにリダイレクトされました');
    } else {
      console.log('  ✅ ページが正常に表示されました');
    }

    // 7. 開発者ツールでネットワークエラーを確認
    console.log('\n7. ネットワークリクエストを監視...');
    
    // ネットワークリクエストを監視
    page.on('response', response => {
      if (response.status() >= 400) {
        console.log(`  ❌ エラーレスポンス: ${response.url()} - ${response.status()}`);
      }
    });
    
    // 再度自動返信ルールページへアクセス
    await page.goto('http://localhost:3000/auto-reply/rules');
    await page.waitForTimeout(3000);

    console.log('\n=== テスト完了 ===');
    console.log('ブラウザを開いたままにしています。手動で確認してください。');
    console.log('終了するにはCtrl+Cを押してください。');
    
    // ブラウザを開いたままにする
    await page.waitForTimeout(60000);

  } catch (error) {
    console.error('テストエラー:', error);
  }
}

testScheduledPosts().catch(console.error);