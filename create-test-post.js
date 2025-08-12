// テスト投稿作成

const { chromium } = require('playwright');

async function createTestPost() {
  let browser;
  let context;
  let page;

  try {
    console.log('📝 テスト投稿作成開始...');
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
      
      // 新規投稿ページへ
      console.log('\n📝 新規投稿ページへ移動...');
      await page.goto('http://localhost:3000/posts/new');
      await page.waitForTimeout(3000);
      
      // 投稿ページが表示されているか確認
      const postTitle = page.locator('h3');
      if (await postTitle.isVisible()) {
        console.log('✅ 新規投稿ページが表示されています');
        
        // 投稿を作成
        const timestamp = Date.now();
        const content = `複製テスト用投稿 ${timestamp}\n現在時刻: ${new Date().toLocaleString('ja-JP')}\n\nこの投稿は複製機能のテスト用に作成されました。`;
        
        console.log('\n📝 投稿内容を入力...');
        const textarea = page.locator('textarea').first();
        await textarea.fill(content);
        console.log('  内容:', content.substring(0, 50) + '...');
        
        // APIレスポンスを監視
        page.on('response', async (response) => {
          if (response.url().includes('/api/posts')) {
            console.log('\n📡 APIレスポンス:', response.status());
            try {
              const data = await response.json();
              if (data.post) {
                console.log('✅ 投稿成功:');
                console.log('  ID:', data.post.id);
                console.log('  ステータス:', data.post.status);
                if (data.post.threads_post_id) {
                  console.log('  Threads ID:', data.post.threads_post_id);
                }
              } else if (data.error) {
                console.log('❌ エラー:', data.error);
              }
            } catch (e) {
              // JSON解析エラーは無視
            }
          }
        });
        
        // 投稿実行
        console.log('\n🚀 投稿を実行...');
        const submitButton = page.locator('button[type="submit"]');
        await submitButton.click();
        
        // 結果を待つ
        await page.waitForTimeout(10000);
        
        // 成功メッセージを確認
        const successMessage = page.locator('.bg-green-50');
        if (await successMessage.isVisible()) {
          const message = await successMessage.textContent();
          console.log('✅ 成功メッセージ:', message);
        }
      }
    }

    console.log('\n=====================================');
    console.log('✅ テスト投稿作成完了');
    console.log('=====================================\n');

  } catch (error) {
    console.error('❌ エラー:', error.message);
    
    if (page) {
      await page.screenshot({ path: 'create-post-error.png', fullPage: true });
      console.log('📸 エラースクリーンショット: create-post-error.png');
    }
  } finally {
    if (browser) {
      await browser.close();
      console.log('🔚 ブラウザを閉じました');
    }
  }
}

createTestPost();