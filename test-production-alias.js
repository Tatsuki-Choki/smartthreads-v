// 本番環境エイリアスURLの動作確認

const { chromium } = require('playwright');

async function testProductionAlias() {
  let browser;
  let context;
  let page;

  const PRODUCTION_URL = 'https://smartthreads-v.vercel.app';

  try {
    console.log('🚀 本番環境エイリアスURL テスト開始...');
    console.log('=====================================');
    console.log(`📍 URL: ${PRODUCTION_URL}`);
    console.log('=====================================\n');
    
    browser = await chromium.launch({ 
      headless: false,
      slowMo: 1000
    });
    context = await browser.newContext();
    page = await context.newPage();

    // コンソールログとエラーを監視
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`❌ [${msg.type()}] ${msg.text()}`);
      } else {
        console.log(`🖥️  [${msg.type()}] ${msg.text()}`);
      }
    });

    page.on('pageerror', error => {
      console.log(`❌ ページエラー: ${error.message}`);
    });

    page.on('response', async (response) => {
      if (!response.ok() && response.status() !== 304) {
        console.log(`📡 HTTP ${response.status()}: ${response.url()}`);
      } else if (response.url().includes('/api/')) {
        console.log(`✅ API ${response.status()}: ${response.url()}`);
      }
    });

    // 1. ホームページアクセス
    console.log('🔗 ホームページにアクセス中...');
    try {
      await page.goto(PRODUCTION_URL, { waitUntil: 'networkidle', timeout: 30000 });
      console.log('✅ ホームページアクセス成功');
      
      // ページタイトル確認
      const title = await page.title();
      console.log(`📄 ページタイトル: "${title}"`);
      
      // SmartThreadsのロゴやブランディング確認
      const smartThreadsText = await page.getByText('SmartThreads').count();
      console.log(`🏷️  SmartThreadsブランディング: ${smartThreadsText > 0 ? '✓ 発見' : '✗ なし'}`);
      
      // ログインフォーム確認  
      const emailInput = await page.locator('input[type="email"]').count();
      const passwordInput = await page.locator('input[type="password"]').count();
      console.log(`🔐 ログインフォーム: Email=${emailInput}, Password=${passwordInput}`);
      
    } catch (error) {
      console.log(`❌ ホームページアクセスエラー: ${error.message}`);
    }

    // 2. ダッシュボードへの直接アクセス試行
    console.log('\n🏠 ダッシュボードへの直接アクセス試行...');
    try {
      await page.goto(`${PRODUCTION_URL}/dashboard`, { waitUntil: 'networkidle', timeout: 15000 });
      
      const currentUrl = page.url();
      console.log(`📍 リダイレクト先: ${currentUrl}`);
      
      if (currentUrl.includes('/login')) {
        console.log('✅ 認証ガードが正常に機能（ログインページにリダイレクト）');
      } else {
        console.log('⚠️ 認証ガードが機能していない可能性');
      }
      
    } catch (error) {
      console.log(`❌ ダッシュボードアクセスエラー: ${error.message}`);
    }

    // 3. API エンドポイント確認
    console.log('\n📡 APIエンドポイント確認...');
    try {
      // 認証不要のエンドポイントがあるか確認
      const testEndpoints = [
        '/api/test',
        '/api/health', 
        '/api/status',
        '/api/workspaces'
      ];
      
      for (const endpoint of testEndpoints) {
        try {
          const response = await page.request.get(`${PRODUCTION_URL}${endpoint}`);
          console.log(`🔍 ${endpoint}: ${response.status()} ${response.statusText()}`);
        } catch (error) {
          console.log(`⚠️ ${endpoint}: リクエストエラー`);
        }
      }
    } catch (error) {
      console.log(`❌ API確認エラー: ${error.message}`);
    }

    // 4. パフォーマンス測定
    console.log('\n⚡ パフォーマンス測定...');
    try {
      const startTime = Date.now();
      await page.goto(PRODUCTION_URL, { waitUntil: 'load' });
      const loadTime = Date.now() - startTime;
      console.log(`📊 ページロード時間: ${loadTime}ms`);
      
      if (loadTime < 3000) {
        console.log('✅ 高速ロード（3秒未満）');
      } else if (loadTime < 5000) {
        console.log('⚠️ 普通のロード（3-5秒）');
      } else {
        console.log('❌ 遅いロード（5秒以上）');
      }
    } catch (error) {
      console.log(`❌ パフォーマンス測定エラー: ${error.message}`);
    }

    // スクリーンショット撮影
    console.log('\n📸 スクリーンショット撮影中...');
    try {
      await page.screenshot({ 
        path: 'production-alias-test.png', 
        fullPage: true 
      });
      console.log('✅ スクリーンショット保存: production-alias-test.png');
    } catch (error) {
      console.log(`❌ スクリーンショットエラー: ${error.message}`);
    }

    console.log('\n=====================================');
    console.log('✅ 本番環境エイリアスURL テスト完了');
    console.log(`🔗 アプリケーション URL: ${PRODUCTION_URL}`);
    console.log('=====================================\n');

  } catch (error) {
    console.error('❌ テスト実行エラー:', error.message);
  } finally {
    if (browser) {
      await browser.close();
      console.log('🔚 ブラウザを閉じました');
    }
  }
}

testProductionAlias();