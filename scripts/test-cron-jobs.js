#!/usr/bin/env node

/**
 * Cronジョブのローカルテストスクリプト
 * 本番環境にデプロイする前にCronジョブの動作を確認します
 */

const https = require('https');
const http = require('http');

// テスト環境の設定
const BASE_URL = process.env.APP_URL || 'http://localhost:3000';
const CRON_SECRET = process.env.CRON_SECRET || 'test-cron-secret';

const isProduction = BASE_URL.startsWith('https');

console.log('=====================================');
console.log('Cronジョブテスト開始');
console.log('=====================================');
console.log(`ベースURL: ${BASE_URL}`);
console.log(`環境: ${isProduction ? '本番' : '開発'}`);
console.log('');

/**
 * HTTPリクエストを送信
 */
function makeRequest(path, callback) {
  const url = new URL(path, BASE_URL);
  const options = {
    hostname: url.hostname,
    port: url.port || (isProduction ? 443 : 80),
    path: url.pathname,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${CRON_SECRET}`,
      'User-Agent': 'SmartThreads-Cron-Test'
    }
  };

  console.log(`リクエスト送信: ${url.href}`);

  const protocol = isProduction ? https : http;
  const req = protocol.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      callback(null, {
        statusCode: res.statusCode,
        headers: res.headers,
        body: data
      });
    });
  });

  req.on('error', (error) => {
    callback(error);
  });

  req.end();
}

/**
 * Cronジョブをテスト
 */
async function testCronJob(name, path) {
  console.log(`\n--- ${name} のテスト ---`);
  
  return new Promise((resolve) => {
    makeRequest(path, (error, response) => {
      if (error) {
        console.error(`❌ エラー: ${error.message}`);
        resolve(false);
        return;
      }

      console.log(`ステータスコード: ${response.statusCode}`);
      
      if (response.statusCode === 401) {
        console.error('❌ 認証エラー: CRON_SECRETが正しくありません');
        resolve(false);
        return;
      }

      if (response.statusCode === 200) {
        try {
          const data = JSON.parse(response.body);
          console.log('✅ 成功:');
          console.log(JSON.stringify(data, null, 2));
          resolve(true);
        } catch (e) {
          console.log('✅ レスポンス:', response.body);
          resolve(true);
        }
      } else {
        console.error(`❌ エラー (${response.statusCode}):`);
        console.error(response.body);
        resolve(false);
      }
    });
  });
}

/**
 * すべてのCronジョブをテスト
 */
async function runTests() {
  const tests = [
    {
      name: '予約投稿の自動送信',
      path: '/api/cron/scheduled-posts'
    },
    {
      name: '自動返信キューの処理',
      path: '/api/auto-reply/queue/process'
    }
  ];

  let successCount = 0;
  let failCount = 0;

  for (const test of tests) {
    const success = await testCronJob(test.name, test.path);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }

  console.log('\n=====================================');
  console.log('テスト結果サマリー');
  console.log('=====================================');
  console.log(`成功: ${successCount}`);
  console.log(`失敗: ${failCount}`);
  
  if (failCount === 0) {
    console.log('\n✅ すべてのCronジョブテストに合格しました！');
  } else {
    console.log('\n❌ 一部のテストが失敗しました。');
    console.log('   CRON_SECRET環境変数を確認してください。');
  }
}

// テスト実行
runTests();