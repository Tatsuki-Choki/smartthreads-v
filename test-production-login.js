// 本番環境ログイン機能の詳細テスト

const { chromium } = require('playwright');

async function testProductionLogin() {
  let browser;
  let context;
  let page;

  const PRODUCTION_URL = 'https://smartthreads-v.vercel.app';
  const TEST_EMAIL = 'tsukichiyo.inc@gmail.com';
  const TEST_PASSWORD = 'Chouki0926';

  try {
    console.log('🔐 本番環境ログインテスト開始...');
    console.log('=====================================');
    console.log(`📍 URL: ${PRODUCTION_URL}`);
    console.log('=====================================\n');
    
    browser = await chromium.launch({ 
      headless: false,
      slowMo: 2000
    });
    context = await browser.newContext();
    page = await context.newPage();

    // ネットワークとコンソールを詳細に監視
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      console.log(`🖥️  [${type}] ${text}`);
    });

    page.on('pageerror', error => {
      console.log(`❌ ページエラー: ${error.message}`);
    });

    page.on('response', async (response) => {
      const url = response.url();
      const status = response.status();
      
      if (url.includes('/api/')) {
        console.log(`📡 API: ${response.method()} ${url} - ${status} ${response.statusText()}`);
        
        if (!response.ok()) {
          try {
            const body = await response.text();
            console.log(`   ❌ エラーレスポンス: ${body.substring(0, 200)}...`);
          } catch (e) {
            console.log('   ❌ レスポンス読み取りエラー');
          }
        }
      }
    });

    page.on('request', request => {
      if (request.url().includes('/api/')) {
        console.log(`📤 APIリクエスト: ${request.method()} ${request.url()}`);
      }
    });

    // 1. ログインページへのアクセス
    console.log('🔗 ログインページにアクセス中...');
    await page.goto(`${PRODUCTION_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });
    
    // ページの基本情報
    const title = await page.title();
    const url = page.url();
    console.log(`📄 ページタイトル: "${title}"`);
    console.log(`📍 現在のURL: ${url}`);

    // フォーム要素の存在確認
    console.log('\n📋 フォーム要素の確認...');
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const submitButton = page.locator('button[type="submit"]');
    
    console.log(`📧 Emailフィールド: ${await emailInput.count() > 0 ? '✓ 存在' : '✗ なし'}`);
    console.log(`🔑 パスワードフィールド: ${await passwordInput.count() > 0 ? '✓ 存在' : '✗ なし'}`);
    console.log(`🔘 送信ボタン: ${await submitButton.count() > 0 ? '✓ 存在' : '✗ なし'}`);

    if (await emailInput.count() === 0) {
      console.log('❌ Emailフィールドが見つかりません。異なるセレクターを試します...');
      
      // 代替セレクターを試す
      const alternativeSelectors = [
        'input[name="email"]',
        'input[placeholder*="メール"]',
        'input[placeholder*="mail"]',
        'input[placeholder*="Email"]',
        'input[id*="email"]'
      ];
      
      for (const selector of alternativeSelectors) {
        const count = await page.locator(selector).count();
        console.log(`   試行: ${selector} → ${count}個`);
        if (count > 0) {
          console.log(`   ✅ 発見: ${selector}`);
          break;
        }
      }
    }

    // 3. ログイン試行
    console.log('\n🔐 ログイン試行...');
    try {
      // フォーム入力
      if (await emailInput.count() > 0 && await passwordInput.count() > 0) {
        console.log('📝 認証情報を入力中...');
        await emailInput.fill(TEST_EMAIL);
        await passwordInput.fill(TEST_PASSWORD);
        
        console.log('🚀 ログインボタンをクリック...');
        await submitButton.click();
        
        // ログイン処理の完了を待機
        console.log('⏳ ログイン処理を待機中...');
        await page.waitForTimeout(5000);
        
        const currentUrl = page.url();
        console.log(`📍 ログイン後のURL: ${currentUrl}`);
        
        if (currentUrl.includes('/dashboard')) {
          console.log('✅ ログイン成功！ダッシュボードにリダイレクト');
        } else if (currentUrl.includes('/login')) {
          console.log('❌ ログイン失敗 - ログインページに留まっています');
          
          // エラーメッセージの確認
          const errorMessages = await page.locator('.text-red-500, .error, [role="alert"]').allTextContents();
          if (errorMessages.length > 0) {
            console.log('🚨 エラーメッセージ:');
            errorMessages.forEach(msg => console.log(`   - ${msg}`));
          }
        } else {
          console.log(`⚠️ 予期しないリダイレクト先: ${currentUrl}`);
        }
        
      } else {
        console.log('❌ 必要なフォーム要素が見つかりません');
      }
      
    } catch (error) {
      console.log(`❌ ログイン試行エラー: ${error.message}`);
    }

    // 4. ローカルストレージとクッキーの確認
    console.log('\n🍪 認証情報の確認...');
    try {
      const localStorage = await page.evaluate(() => {
        const data = {};
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          data[key] = window.localStorage.getItem(key);
        }
        return data;
      });
      
      console.log('💾 LocalStorage:');
      Object.keys(localStorage).forEach(key => {
        const value = localStorage[key];
        if (key.includes('token') || key.includes('session') || key.includes('auth')) {
          console.log(`   ${key}: ${value ? value.substring(0, 50) + '...' : 'null'}`);
        }
      });
      
      const cookies = await context.cookies();
      console.log(`🍪 クッキー数: ${cookies.length}`);
      cookies.forEach(cookie => {
        if (cookie.name.includes('token') || cookie.name.includes('session') || cookie.name.includes('auth')) {
          console.log(`   ${cookie.name}: ${cookie.value.substring(0, 50)}...`);
        }
      });
      
    } catch (error) {
      console.log(`❌ 認証情報確認エラー: ${error.message}`);
    }

    // スクリーンショット
    console.log('\n📸 スクリーンショット撮影...');
    await page.screenshot({ 
      path: 'production-login-test.png', 
      fullPage: true 
    });
    console.log('✅ スクリーンショット保存: production-login-test.png');

    console.log('\n=====================================');
    console.log('✅ 本番環境ログインテスト完了');
    console.log('=====================================\n');

  } catch (error) {
    console.error('❌ テスト実行エラー:', error.message);
  } finally {
    if (browser) {
      // ブラウザを5秒後に閉じる（手動確認時間を提供）
      console.log('⏳ 5秒後にブラウザを閉じます（手動確認可能）...');
      await page.waitForTimeout(5000);
      await browser.close();
      console.log('🔚 ブラウザを閉じました');
    }
  }
}

testProductionLogin();