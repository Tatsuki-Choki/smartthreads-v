#!/usr/bin/env node

/**
 * SmartThreads デプロイメント前チェックスクリプト
 * 本番環境へのデプロイ前に必要な設定を確認します
 */

const fs = require('fs');
const path = require('path');

console.log('=====================================');
console.log('SmartThreads デプロイメント前チェック');
console.log('=====================================\n');

let hasErrors = false;
let hasWarnings = false;

// 1. 環境変数チェック
console.log('1. 環境変数の確認...');
const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'THREADS_APP_ID',
  'THREADS_APP_SECRET',
  'THREADS_TOKEN_ENC_KEY',
  'CRON_SECRET',
  'WEBHOOK_SECRET'
];

const envFile = '.env.local';
if (fs.existsSync(envFile)) {
  const envContent = fs.readFileSync(envFile, 'utf8');
  const missingVars = requiredEnvVars.filter(varName => {
    const regex = new RegExp(`^${varName}=.+`, 'm');
    return !regex.test(envContent);
  });

  if (missingVars.length > 0) {
    console.log('  ❌ 以下の環境変数が設定されていません:');
    missingVars.forEach(v => console.log(`     - ${v}`));
    hasErrors = true;
  } else {
    console.log('  ✅ 必須環境変数がすべて設定されています');
  }
} else {
  console.log('  ❌ .env.local ファイルが見つかりません');
  hasErrors = true;
}

// 2. パッケージ依存関係チェック
console.log('\n2. パッケージ依存関係の確認...');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const requiredPackages = [
  '@supabase/supabase-js',
  '@supabase/ssr',
  'next',
  'react',
  'react-dom',
  'tailwindcss'
];

const missingPackages = requiredPackages.filter(pkg => 
  !packageJson.dependencies[pkg] && !packageJson.devDependencies[pkg]
);

if (missingPackages.length > 0) {
  console.log('  ❌ 以下のパッケージがインストールされていません:');
  missingPackages.forEach(p => console.log(`     - ${p}`));
  hasErrors = true;
} else {
  console.log('  ✅ 必須パッケージがすべてインストールされています');
}

// 3. ビルドチェック
console.log('\n3. ビルド設定の確認...');
if (!fs.existsSync('next.config.js')) {
  console.log('  ❌ next.config.js が見つかりません');
  hasErrors = true;
} else {
  console.log('  ✅ next.config.js が存在します');
}

if (!fs.existsSync('tailwind.config.ts')) {
  console.log('  ⚠️  tailwind.config.ts が見つかりません');
  hasWarnings = true;
} else {
  console.log('  ✅ tailwind.config.ts が存在します');
}

// 4. TypeScriptチェック
console.log('\n4. TypeScript設定の確認...');
if (!fs.existsSync('tsconfig.json')) {
  console.log('  ❌ tsconfig.json が見つかりません');
  hasErrors = true;
} else {
  console.log('  ✅ tsconfig.json が存在します');
}

// 5. Vercel設定チェック
console.log('\n5. Vercel設定の確認...');
if (!fs.existsSync('vercel.json')) {
  console.log('  ⚠️  vercel.json が見つかりません（Cronジョブが設定されていない可能性があります）');
  hasWarnings = true;
} else {
  const vercelConfig = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
  if (!vercelConfig.crons || vercelConfig.crons.length === 0) {
    console.log('  ⚠️  Cronジョブが設定されていません');
    hasWarnings = true;
  } else {
    console.log(`  ✅ ${vercelConfig.crons.length}個のCronジョブが設定されています`);
  }
}

// 6. マイグレーションファイルチェック
console.log('\n6. データベースマイグレーションの確認...');
const migrationsDir = 'supabase/migrations';
if (!fs.existsSync(migrationsDir)) {
  console.log('  ❌ マイグレーションディレクトリが見つかりません');
  hasErrors = true;
} else {
  const migrations = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));
  if (migrations.length === 0) {
    console.log('  ⚠️  マイグレーションファイルが見つかりません');
    hasWarnings = true;
  } else {
    console.log(`  ✅ ${migrations.length}個のマイグレーションファイルが見つかりました`);
    
    // 重要なマイグレーションの確認
    const importantMigrations = [
      '021_add_media_columns_to_posts.sql',
      '022_create_media_uploads_table.sql'
    ];
    
    const missingImportant = importantMigrations.filter(m => !migrations.includes(m));
    if (missingImportant.length > 0) {
      console.log('  ⚠️  以下の重要なマイグレーションが見つかりません:');
      missingImportant.forEach(m => console.log(`     - ${m}`));
      hasWarnings = true;
    }
  }
}

// 7. セキュリティチェック
console.log('\n7. セキュリティ設定の確認...');
if (fs.existsSync('.env.local')) {
  const envContent = fs.readFileSync('.env.local', 'utf8');
  if (envContent.includes('SKIP_AUTH_CHECK=true')) {
    console.log('  ❌ SKIP_AUTH_CHECK が true に設定されています（本番環境では false にしてください）');
    hasErrors = true;
  } else {
    console.log('  ✅ 認証スキップが無効になっています');
  }
}

// 結果サマリー
console.log('\n=====================================');
console.log('チェック結果:');
console.log('=====================================');

if (hasErrors) {
  console.log('\n❌ エラーが見つかりました。デプロイ前に修正してください。');
  process.exit(1);
} else if (hasWarnings) {
  console.log('\n⚠️  警告が見つかりました。確認することをお勧めします。');
  console.log('✅ デプロイ可能ですが、警告内容を確認してください。');
} else {
  console.log('\n✅ すべてのチェックに合格しました！');
  console.log('   デプロイの準備が整っています。');
}

console.log('\n次のステップ:');
console.log('1. scripts/generate-secrets.sh を実行してセキュリティキーを生成');
console.log('2. Supabaseでマイグレーションを実行');
console.log('3. Vercelに環境変数を設定');
console.log('4. vercel --prod でデプロイ実行');
console.log('');