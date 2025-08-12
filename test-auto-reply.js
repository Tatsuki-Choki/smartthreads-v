// 自動返信機能テスト

const { chromium } = require('playwright');

async function testAutoReply() {
  let browser;
  let context;
  let page;

  try {
    console.log('🤖 自動返信機能テスト開始...');
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
      
      // 自動返信ルールページへ移動
      console.log('\n🤖 自動返信ルールページへ移動...');
      
      // サイドバーの自動返信ルールリンクをクリック
      const autoReplyLink = page.locator('a[href="/auto-reply/rules"]');
      if (await autoReplyLink.isVisible()) {
        await autoReplyLink.click();
        await page.waitForTimeout(3000);
        
        // スクリーンショット
        await page.screenshot({ path: 'auto-reply-rules-page.png', fullPage: true });
        console.log('📸 自動返信ルールページ: auto-reply-rules-page.png');
        
        // ページタイトルを確認
        const pageTitle = page.locator('h1');
        if (await pageTitle.isVisible()) {
          const titleText = await pageTitle.textContent();
          console.log('📄 ページタイトル:', titleText);
          
          if (titleText?.includes('自動返信ルール')) {
            console.log('✅ 自動返信ルールページが正常に表示されました');
            
            // 新規ルール作成ボタンを確認
            const newRuleButton = page.locator('button').filter({ hasText: '新規ルール作成' });
            if (await newRuleButton.isVisible()) {
              console.log('✅ 新規ルール作成ボタンが表示されています');
            }
            
            // テンプレートページもテスト
            console.log('\n📝 テンプレートページへ移動...');
            const templateLink = page.locator('a[href="/auto-reply/templates"]');
            if (await templateLink.isVisible()) {
              await templateLink.click();
              await page.waitForTimeout(3000);
              
              // スクリーンショット
              await page.screenshot({ path: 'auto-reply-templates-page.png', fullPage: true });
              console.log('📸 テンプレートページ: auto-reply-templates-page.png');
              
              // ページタイトルを確認
              const templatePageTitle = page.locator('h1');
              if (await templatePageTitle.isVisible()) {
                const templateTitleText = await templatePageTitle.textContent();
                console.log('📄 テンプレートページタイトル:', templateTitleText);
                
                if (templateTitleText?.includes('テンプレート')) {
                  console.log('✅ テンプレートページが正常に表示されました');
                  
                  // 新規テンプレート作成ボタンを確認
                  const newTemplateButton = page.locator('button').filter({ hasText: '新規テンプレート' });
                  if (await newTemplateButton.isVisible()) {
                    console.log('✅ 新規テンプレート作成ボタンが表示されています');
                  }
                }
              }
            }
          }
        }
      } else {
        console.log('❌ 自動返信ルールリンクが見つかりません');
        
        // 利用可能なリンクをリストアップ
        const allLinks = await page.locator('a').all();
        console.log('利用可能なリンク:');
        for (let i = 0; i < Math.min(allLinks.length, 10); i++) {
          const link = allLinks[i];
          const href = await link.getAttribute('href');
          const text = await link.textContent();
          if (href && text?.trim()) {
            console.log(`  - ${text.trim()}: ${href}`);
          }
        }
      }
    } else {
      console.log('❌ ダッシュボードへのログインに失敗しました');
    }

    console.log('\n=====================================');
    console.log('✅ 自動返信機能テスト完了');
    console.log('=====================================\n');

  } catch (error) {
    console.error('❌ エラー:', error.message);
    
    if (page) {
      await page.screenshot({ path: 'auto-reply-test-error.png', fullPage: true });
      console.log('📸 エラースクリーンショット: auto-reply-test-error.png');
    }
  } finally {
    if (browser) {
      await browser.close();
      console.log('🔚 ブラウザを閉じました');
    }
  }
}

testAutoReply();