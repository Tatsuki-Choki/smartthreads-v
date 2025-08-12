const { chromium } = require('playwright');

async function testPostOperations() {
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

  try {
    console.log('1. ダッシュボードへアクセス...');
    await page.goto('http://localhost:3000/dashboard');
    await page.waitForTimeout(2000);
    
    // 2. 新規予約投稿を作成
    console.log('\n2. 新規予約投稿を作成...');
    await page.goto('http://localhost:3000/posts/new');
    await page.waitForTimeout(2000);
    
    // 投稿内容を入力
    const content = `テスト予約投稿 ${new Date().toLocaleTimeString('ja-JP')}`;
    await page.fill('textarea', content);
    
    // 予約日時を設定（1時間後）
    const futureDate = new Date(Date.now() + 60 * 60 * 1000);
    const dateString = futureDate.toISOString().slice(0, 16);
    
    // 予約投稿タブをクリック
    const scheduledTab = await page.$('button:has-text("予約投稿")');
    if (scheduledTab) {
      await scheduledTab.click();
      await page.waitForTimeout(1000);
      
      // 日時入力
      const dateInput = await page.$('input[type="datetime-local"]');
      if (dateInput) {
        await dateInput.fill(dateString);
      }
      
      // 予約ボタンをクリック
      const scheduleButton = await page.$('button:has-text("予約する")');
      if (scheduleButton) {
        console.log('  予約ボタンをクリック...');
        await scheduleButton.click();
        await page.waitForTimeout(3000);
      }
    }
    
    // 3. 予約投稿ページへ移動
    console.log('\n3. 予約投稿ページへ移動...');
    await page.goto('http://localhost:3000/posts/scheduled');
    await page.waitForTimeout(3000);
    
    // 投稿が表示されているか確認
    const postContent = await page.textContent('body');
    if (postContent.includes(content)) {
      console.log('  ✅ 予約投稿が作成されました');
    } else {
      console.log('  ⚠️ 予約投稿が見つかりません');
    }
    
    // 4. 操作ボタンの存在確認
    console.log('\n4. 操作ボタンを確認...');
    
    const editButtons = await page.$$('button:has-text("編集")');
    const duplicateButtons = await page.$$('button:has-text("複製")');
    const publishButtons = await page.$$('button:has-text("今すぐ投稿")');
    const deleteButtons = await page.$$('button:has-text("削除")');
    
    console.log(`  編集ボタン: ${editButtons.length}個`);
    console.log(`  複製ボタン: ${duplicateButtons.length}個`);
    console.log(`  今すぐ投稿ボタン: ${publishButtons.length}個`);
    console.log(`  削除ボタン: ${deleteButtons.length}個`);
    
    // 5. 編集機能をテスト
    if (editButtons.length > 0) {
      console.log('\n5. 編集機能をテスト...');
      await editButtons[0].click();
      await page.waitForTimeout(2000);
      
      const currentUrl = page.url();
      if (currentUrl.includes('/edit')) {
        console.log('  ✅ 編集ページへ遷移しました');
        
        // 編集ページの要素を確認
        const textarea = await page.$('textarea');
        if (textarea) {
          const currentContent = await textarea.inputValue();
          console.log(`  現在の内容: ${currentContent.substring(0, 50)}...`);
          
          // 内容を更新
          await textarea.fill(currentContent + '\n[編集済み]');
          
          // 保存ボタンを探す
          const saveButton = await page.$('button:has-text("保存"), button:has-text("更新")');
          if (saveButton) {
            console.log('  保存ボタンをクリック...');
            await saveButton.click();
            await page.waitForTimeout(3000);
          }
        }
      } else {
        console.log('  ❌ 編集ページへの遷移に失敗しました');
      }
    }
    
    // 予約投稿ページへ戻る
    await page.goto('http://localhost:3000/posts/scheduled');
    await page.waitForTimeout(2000);
    
    // 6. 複製機能をテスト
    const duplicateButtonsAfter = await page.$$('button:has-text("複製")');
    if (duplicateButtonsAfter.length > 0) {
      console.log('\n6. 複製機能をテスト...');
      await duplicateButtonsAfter[0].click();
      await page.waitForTimeout(2000);
      
      // トーストメッセージまたはページ遷移を確認
      const currentUrl = page.url();
      if (currentUrl.includes('/posts/new')) {
        console.log('  ✅ 新規投稿ページへ遷移しました（複製）');
      } else {
        // トーストメッセージを確認
        const toasts = await page.$$('[data-sonner-toast], [data-toast], .Toastify__toast');
        if (toasts.length > 0) {
          for (const toast of toasts) {
            const text = await toast.textContent();
            console.log(`  トースト: ${text}`);
          }
        }
      }
    }
    
    // 予約投稿ページへ戻る
    await page.goto('http://localhost:3000/posts/scheduled');
    await page.waitForTimeout(2000);
    
    // 7. 削除機能をテスト
    const deleteButtonsAfter = await page.$$('button:has-text("削除")');
    if (deleteButtonsAfter.length > 0) {
      console.log('\n7. 削除機能をテスト...');
      
      // ダイアログハンドラを設定
      page.once('dialog', async dialog => {
        console.log(`  確認ダイアログ: ${dialog.message()}`);
        await dialog.accept();
      });
      
      await deleteButtonsAfter[0].click();
      await page.waitForTimeout(3000);
      
      // 投稿が削除されたか確認
      const pageContent = await page.textContent('body');
      if (!pageContent.includes(content)) {
        console.log('  ✅ 投稿が削除されました');
      } else {
        console.log('  ⚠️ 投稿がまだ存在します');
      }
    }
    
    console.log('\n=== テスト完了 ===');
    console.log('ブラウザを開いたままにしています。');
    console.log('終了するにはCtrl+Cを押してください。');
    
    // ブラウザを開いたままにする
    await page.waitForTimeout(60000);

  } catch (error) {
    console.error('テストエラー:', error);
  }
}

testPostOperations().catch(console.error);