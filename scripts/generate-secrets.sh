#!/bin/bash

# SmartThreads - セキュリティキー生成スクリプト
# 本番環境用の各種シークレットキーを生成します

echo "========================================="
echo "SmartThreads セキュリティキー生成"
echo "========================================="
echo ""

# 暗号化キーの生成（32バイト）
echo "1. トークン暗号化キー (THREADS_TOKEN_ENC_KEY):"
echo "   以下の値を.envファイルに設定してください:"
ENCRYPTION_KEY=$(openssl rand -base64 32)
echo "   $ENCRYPTION_KEY"
echo ""

# Cronシークレットの生成
echo "2. Cronジョブシークレット (CRON_SECRET):"
echo "   以下の値を.envファイルに設定してください:"
CRON_SECRET=$(openssl rand -hex 32)
echo "   $CRON_SECRET"
echo ""

# Webhookシークレットの生成
echo "3. Webhookシークレット (WEBHOOK_SECRET):"
echo "   以下の値を.envファイルに設定してください:"
WEBHOOK_SECRET=$(openssl rand -hex 32)
echo "   $WEBHOOK_SECRET"
echo ""

# Threads Webhookシークレットの生成
echo "4. Threads Webhookシークレット (THREADS_WEBHOOK_SECRET):"
echo "   以下の値を.envファイルに設定してください:"
THREADS_WEBHOOK_SECRET=$(openssl rand -hex 32)
echo "   $THREADS_WEBHOOK_SECRET"
echo ""

echo "========================================="
echo "重要: これらの値は一度だけ生成され、"
echo "安全に保管してください。"
echo "========================================="

# .env.production.exampleファイルの生成
cat > .env.production.example << EOF
# ===================================
# SmartThreads 本番環境設定
# ===================================

# Supabase設定
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# アプリケーションURL
APP_URL=https://your-domain.com

# Threads API設定
THREADS_APP_ID=your-threads-app-id
THREADS_APP_SECRET=your-threads-app-secret
THREADS_REDIRECT_URI=https://your-domain.com/api/auth/threads/callback

# セキュリティキー（上記で生成した値を使用）
THREADS_TOKEN_ENC_KEY=$ENCRYPTION_KEY
CRON_SECRET=$CRON_SECRET
WEBHOOK_SECRET=$WEBHOOK_SECRET
THREADS_WEBHOOK_SECRET=$THREADS_WEBHOOK_SECRET

# 本番環境では必ずfalse
SKIP_AUTH_CHECK=false
EOF

echo ""
echo ".env.production.example ファイルを生成しました。"
echo "このファイルを参考に .env.production を作成してください。"