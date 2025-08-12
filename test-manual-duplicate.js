// 手動確認用複製機能テスト

const { chromium } = require('playwright');

async function testManualDuplicate() {
  let browser;
  let context;
  let page;

  try {
    console.log('🔍 手動複製機能テスト開始...');
    console.log('ユーザーの手動操作待ちモード');
    console.log('=====================================\n');
    
    browser = await chromium.launch({ 
      headless: false,
      slowMo: 1000
    });
    context = await browser.newContext();
    page = await context.newPage();

    // コンソールログを監視
    page.on('console', msg => {
      console.log('🖥️  ブラウザコンソール:', msg.text());
    });

    page.on('response', async (response) => {
      if (response.url().includes('/api/posts')) {
        console.log(`📡 API: ${response.method()} ${response.url()} - ${response.status()}`);
        if (!response.ok()) {
          try {
            const text = await response.text();
            console.log(`   ❌ エラーレスポンス: ${text}`);
          } catch (e) {
            console.log('   ❌ レスポンス読み取りエラー');
          }
        }
      }
    });

    // ログインページへ
    console.log('🔐 ログインページに移動...');
    await page.goto('http://localhost:3000/login');
    console.log('✅ ログインしてから投稿履歴ページに移動してください');
    console.log('✅ 複製ボタンをクリックして動作を確認してください');
    console.log('⏳ Enterキーを押すまで待機中...');

    // ユーザー入力待ち
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', (key) => {
      if (key[0] === 13) { // Enter key
        console.log('\n✅ テスト終了');
        process.stdin.setRawMode(false);
        process.stdin.pause();
        if (browser) browser.close();
        process.exit(0);
      }
    });

    // 30分間待機
    await page.waitForTimeout(30 * 60 * 1000);

  } catch (error) {
    console.error('❌ エラー:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

testManualDuplicate();