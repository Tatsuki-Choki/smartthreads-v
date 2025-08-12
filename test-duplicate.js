// 複製機能テスト

const { chromium } = require('playwright');

async function testDuplicateFeature() {
  let browser;
  let context;
  let page;

  try {
    console.log('📄 複製機能テスト開始...');
    console.log('=====================================\n');
    
    browser = await chromium.launch({ 
      headless: false,
      slowMo: 1000
    });
    context = await browser.newContext();
    page = await context.newPage();

    // ログインページへ
    console.log('🔐 ログインページへアクセス...');
    await page.goto('http://localhost:3000/login');
    await page.waitForTimeout(2000);

    // ログイン
    console.log('📝 ログイン情報を入力...');
    await page.fill('input[type="email"]', 'tsukichiyo.inc@gmail.com');
    await page.fill('input[type="password"]', 'Chouki0926');
    
    console.log('🚀 ログイン実行...');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(5000);

    // ダッシュボードが表示されているか確認
    const dashboardTitle = page.locator('h1').filter({ hasText: 'ダッシュボード' });
    if (await dashboardTitle.isVisible()) {
      console.log('✅ ダッシュボードにログイン成功');
      
      // 投稿履歴ページへ移動
      console.log('\n📋 投稿履歴ページへ移動...');
      await page.goto('http://localhost:3000/posts/history');
      await page.waitForTimeout(3000);
      
      // スクリーンショット
      await page.screenshot({ path: 'posts-history-page.png', fullPage: true });
      console.log('📸 投稿履歴ページ: posts-history-page.png');
      
      // 投稿が存在するか確認（Cardコンポーネントを探す）
      const postItems = page.locator('[class*="bg-white"][class*="rounded"]');
      const postCount = await postItems.count();
      console.log(`📊 投稿数: ${postCount}`);
      
      if (postCount > 0) {
        console.log('✅ 投稿が見つかりました');
        
        // 最初の投稿の複製ボタンを探す（より具体的なセレクター）
        const duplicateButton = page.locator('button').filter({ hasText: '複製' }).first();
        
        if (await duplicateButton.isVisible()) {
          console.log('✅ 複製ボタンが見つかりました');
          
          // コンソールログを監視
          page.on('console', msg => {
            if (msg.type() === 'error') {
              console.log('❌ ブラウザエラー:', msg.text());
            } else if (msg.text().includes('複製') || msg.text().includes('エラー')) {
              console.log('📝 複製ログ:', msg.text());
            }
          });
          
          // 複製ボタンをクリック
          console.log('\n🔄 複製ボタンをクリック...');
          await duplicateButton.click();
          await page.waitForTimeout(3000);
          
          // 現在のURLを確認
          const currentUrl = page.url();
          console.log('📍 現在のURL:', currentUrl);
          
          if (currentUrl.includes('/posts/new')) {
            console.log('✅ 新規投稿ページに遷移しました');
            
            // スクリーンショット
            await page.screenshot({ path: 'duplicate-new-post-page.png', fullPage: true });
            console.log('📸 複製後の新規投稿ページ: duplicate-new-post-page.png');
            
            // テキストエリアに内容が入力されているか確認
            const textarea = page.locator('textarea').first();
            if (await textarea.isVisible()) {
              const content = await textarea.inputValue();
              if (content && content.length > 0) {
                console.log('✅ 複製された内容が入力されています');
                console.log('📝 複製内容 (最初の50文字):', content.substring(0, 50) + '...');
              } else {
                console.log('❌ テキストエリアが空です');
              }
            }
            
            // 成功メッセージ（toast）を確認
            const toast = page.locator('.toast, [role="alert"]').first();
            if (await toast.isVisible()) {
              const toastText = await toast.textContent();
              console.log('📢 Toastメッセージ:', toastText);
            }
          } else {
            console.log('❌ 新規投稿ページに遷移しませんでした');
            console.log('現在のURL:', currentUrl);
          }
        } else {
          console.log('❌ 複製ボタンが見つかりません');
          
          // 利用可能なボタンをリストアップ
          const buttons = await firstPost.locator('button').all();
          console.log('利用可能なボタン:');
          for (const button of buttons) {
            const text = await button.textContent();
            if (text?.trim()) {
              console.log(`  - ${text.trim()}`);
            }
          }
        }
      } else {
        console.log('❌ 投稿が見つかりません。まず投稿を作成してください。');
      }
    } else {
      console.log('❌ ダッシュボードへのログインに失敗しました');
    }

    console.log('\n=====================================');
    console.log('✅ 複製機能テスト完了');
    console.log('=====================================\n');

  } catch (error) {
    console.error('❌ エラー:', error.message);
    
    if (page) {
      await page.screenshot({ path: 'duplicate-test-error.png', fullPage: true });
      console.log('📸 エラースクリーンショット: duplicate-test-error.png');
    }
  } finally {
    if (browser) {
      await browser.close();
      console.log('🔚 ブラウザを閉じました');
    }
  }
}

testDuplicateFeature();