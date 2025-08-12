// 簡単な複製機能テスト

const { chromium } = require('playwright');

async function testDuplicateSimple() {
  let browser;
  let context;
  let page;

  try {
    console.log('📄 簡単複製テスト開始...');
    
    browser = await chromium.launch({ 
      headless: false,
      slowMo: 1500
    });
    context = await browser.newContext();
    page = await context.newPage();

    // ログインページへ
    await page.goto('http://localhost:3000/login');
    await page.waitForTimeout(2000);

    // ログイン
    await page.fill('input[type="email"]', 'tsukichiyo.inc@gmail.com');
    await page.fill('input[type="password"]', 'Chouki0926');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(5000);

    // 投稿履歴ページへ移動
    await page.goto('http://localhost:3000/posts/history');
    await page.waitForTimeout(3000);
    
    console.log('✅ 投稿履歴ページにアクセスしました');

    // 複製ボタンを探してクリック（最初の複製ボタン）
    const duplicateButton = page.locator('button:has-text("複製")').first();
    
    if (await duplicateButton.isVisible()) {
      console.log('✅ 複製ボタンが見つかりました');
      
      // コンソールログを監視
      page.on('console', msg => {
        console.log('🖥️ ブラウザコンソール:', msg.text());
      });
      
      // 複製ボタンをクリック
      console.log('🔄 複製ボタンをクリック...');
      await duplicateButton.click();
      await page.waitForTimeout(3000);
      
      // URLが変わったか確認
      const currentUrl = page.url();
      console.log('📍 現在のURL:', currentUrl);
      
      if (currentUrl.includes('/posts/new?mode=duplicate')) {
        console.log('✅ 複製モードで新規投稿ページに移動しました');
        
        // テキストエリアの内容を確認
        const textarea = page.locator('textarea').first();
        if (await textarea.isVisible()) {
          // 少し待ってから内容を確認（LocalStorageからの読み込み時間）
          await page.waitForTimeout(2000);
          const content = await textarea.inputValue();
          console.log('📝 テキストエリアの内容:', content ? content.substring(0, 100) + '...' : '(空)');
          
          if (content && content.length > 0) {
            console.log('🎉 複製機能が正常に動作しています！');
          } else {
            console.log('❌ テキストエリアが空です。LocalStorageから読み込めていない可能性があります。');
          }
        }
        
        // Toast通知を確認
        const toast = page.locator('[class*="toast"], [role="alert"]').first();
        if (await toast.isVisible()) {
          const toastText = await toast.textContent();
          console.log('📢 Toast通知:', toastText);
        }
      } else if (currentUrl.includes('/posts/new')) {
        console.log('⚠️ 新規投稿ページに移動しましたが、duplicateモードではありません');
      } else {
        console.log('❌ 新規投稿ページに移動していません');
      }
    } else {
      console.log('❌ 複製ボタンが見つかりません');
    }

    // スクリーンショット
    await page.screenshot({ path: 'duplicate-test-simple.png', fullPage: true });
    console.log('📸 スクリーンショット: duplicate-test-simple.png');

  } catch (error) {
    console.error('❌ エラー:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

testDuplicateSimple();