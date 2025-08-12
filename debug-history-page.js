// 投稿履歴ページのデバッグ

const { chromium } = require('playwright');

async function debugHistoryPage() {
  let browser;
  let context;
  let page;

  try {
    console.log('🔍 投稿履歴ページデバッグ開始...');
    console.log('=====================================\n');
    
    browser = await chromium.launch({ 
      headless: false,
      slowMo: 1500
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
      await page.waitForTimeout(5000);
      
      // ページタイトル確認
      const pageTitle = await page.title();
      console.log('📄 ページタイトル:', pageTitle);
      
      // ページの全てのテキストコンテンツを確認
      const bodyText = await page.locator('body').textContent();
      console.log('📝 ページテキスト (最初の500文字):');
      console.log(bodyText.substring(0, 500));
      console.log('...');
      
      // 読み込み状態確認
      const loadingText = page.locator('text=読み込み中');
      if (await loadingText.isVisible()) {
        console.log('⏳ まだ読み込み中...');
        await page.waitForTimeout(5000);
      }
      
      // エラーメッセージ確認
      const errorElements = page.locator('.text-red-600, [class*="text-red"]');
      const errorCount = await errorElements.count();
      if (errorCount > 0) {
        console.log(`❌ エラー要素が ${errorCount} 個見つかりました:`);
        for (let i = 0; i < errorCount; i++) {
          const errorText = await errorElements.nth(i).textContent();
          console.log(`  - ${errorText}`);
        }
      }
      
      // Cardコンポーネント探索
      const cards = page.locator('[class*="card"], [class*="Card"]');
      const cardCount = await cards.count();
      console.log(`📋 Card要素数: ${cardCount}`);
      
      // 様々なセレクターで要素を探す
      const selectors = [
        'button:has-text("複製")',
        'button[class*="outline"]',
        '[class*="bg-white"]',
        '.space-y-4',
        '[data-testid], [id]',
        'h1, h2, h3'
      ];
      
      for (const selector of selectors) {
        const elements = page.locator(selector);
        const count = await elements.count();
        console.log(`🔍 "${selector}": ${count} 個の要素`);
        
        if (count > 0 && count <= 5) {
          for (let i = 0; i < count; i++) {
            try {
              const text = await elements.nth(i).textContent();
              if (text && text.trim().length > 0) {
                console.log(`   [${i}]: "${text.trim().substring(0, 50)}..."`);
              }
            } catch (e) {
              console.log(`   [${i}]: (テキスト取得エラー)`);
            }
          }
        }
      }
      
      // APIリクエストを監視
      console.log('\n🔍 APIリクエストを監視中...');
      
      page.on('response', async (response) => {
        if (response.url().includes('/api/posts')) {
          console.log(`📡 API: ${response.method()} ${response.url()} - ${response.status()}`);
          try {
            const data = await response.json();
            if (data.posts) {
              console.log(`   投稿数: ${data.posts.length}`);
              data.posts.slice(0, 3).forEach((post, i) => {
                console.log(`   [${i}] ID: ${post.id}, Status: ${post.status}, Content: "${post.content?.substring(0, 30)}..."`);
              });
            }
          } catch (e) {
            console.log('   (JSONレスポンス解析エラー)');
          }
        }
      });
      
      // ページをリロード
      console.log('\n🔄 ページをリロード...');
      await page.reload();
      await page.waitForTimeout(5000);
      
      // スクリーンショット
      await page.screenshot({ path: 'debug-history-page.png', fullPage: true });
      console.log('📸 デバッグスクリーンショット: debug-history-page.png');
    }

    console.log('\n=====================================');
    console.log('✅ デバッグ完了');
    console.log('=====================================\n');

  } catch (error) {
    console.error('❌ エラー:', error.message);
    
    if (page) {
      await page.screenshot({ path: 'debug-error.png', fullPage: true });
      console.log('📸 エラースクリーンショット: debug-error.png');
    }
  } finally {
    if (browser) {
      await browser.close();
      console.log('🔚 ブラウザを閉じました');
    }
  }
}

debugHistoryPage();