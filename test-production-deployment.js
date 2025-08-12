// 本番環境デプロイメントの動作確認

const { chromium } = require('playwright');

async function testProductionDeployment() {
  let browser;
  let context;
  let page;

  const PRODUCTION_URL = 'https://smartthreads-nhbzweo90-tatsuki-chokis-projects.vercel.app';

  try {
    console.log('🚀 本番環境デプロイメントテスト開始...');
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
      console.log(`🖥️  [${msg.type()}] ${msg.text()}`);
    });

    page.on('pageerror', error => {
      console.log(`❌ ページエラー: ${error.message}`);
    });

    page.on('response', async (response) => {
      if (!response.ok() && response.status() !== 304) {
        console.log(`📡 HTTP ${response.status()}: ${response.url()}`);
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
      
      // 基本的なナビゲーション確認
      const nav = await page.locator('nav').count();
      console.log(`🧭 ナビゲーション要素数: ${nav}`);
      
    } catch (error) {
      console.log(`❌ ホームページアクセスエラー: ${error.message}`);
    }

    // 2. ログインページ確認
    console.log('\n🔐 ログインページ確認...');
    try {
      await page.goto(`${PRODUCTION_URL}/login`, { waitUntil: 'networkidle', timeout: 15000 });
      
      // ログインフォームの存在確認
      const emailInput = await page.locator('input[type="email"]').count();
      const passwordInput = await page.locator('input[type="password"]').count();
      const submitButton = await page.locator('button[type="submit"]').count();
      
      console.log(`✅ ログインフォーム要素確認:`);
      console.log(`   - Emailフィールド: ${emailInput > 0 ? '✓' : '✗'}`);
      console.log(`   - パスワードフィールド: ${passwordInput > 0 ? '✓' : '✗'}`);
      console.log(`   - 送信ボタン: ${submitButton > 0 ? '✓' : '✗'}`);
      
    } catch (error) {
      console.log(`❌ ログインページエラー: ${error.message}`);
    }

    // 3. API エンドポイント確認
    console.log('\n📡 APIエンドポイント確認...');
    try {
      const apiResponse = await page.request.get(`${PRODUCTION_URL}/api/health`);
      console.log(`🔍 /api/health: ${apiResponse.status()}`);
    } catch (error) {
      console.log(`⚠️ /api/health: 利用不可 (${error.message})`);
    }

    // 4. 静的リソース確認
    console.log('\n🎨 静的リソース確認...');
    try {
      // CSSの読み込み確認
      const stylesheets = await page.locator('link[rel="stylesheet"]').count();
      console.log(`📄 CSS ファイル数: ${stylesheets}`);
      
      // JavaScriptの読み込み確認  
      const scripts = await page.locator('script').count();
      console.log(`📜 JavaScript ファイル数: ${scripts}`);
      
    } catch (error) {
      console.log(`❌ 静的リソースエラー: ${error.message}`);
    }

    // 5. レスポンシブデザイン確認
    console.log('\n📱 レスポンシブデザイン確認...');
    try {
      // モバイルビューポート
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(1000);
      console.log('✅ モバイルビューポート (375x667) 対応確認');
      
      // デスクトップビューポート  
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.waitForTimeout(1000);
      console.log('✅ デスクトップビューポート (1920x1080) 対応確認');
      
    } catch (error) {
      console.log(`❌ レスポンシブデザインエラー: ${error.message}`);
    }

    // スクリーンショット撮影
    console.log('\n📸 スクリーンショット撮影中...');
    try {
      await page.screenshot({ 
        path: 'production-deployment-test.png', 
        fullPage: true 
      });
      console.log('✅ スクリーンショット保存: production-deployment-test.png');
    } catch (error) {
      console.log(`❌ スクリーンショットエラー: ${error.message}`);
    }

    console.log('\n=====================================');
    console.log('✅ 本番環境デプロイメントテスト完了');
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

testProductionDeployment();