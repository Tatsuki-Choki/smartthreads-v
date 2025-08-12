#!/bin/bash

# ====================================
# SmartThreads V - Database Types Update Script
# 作成日: 2025-08-12
# 目的: マイグレーション004後のタイプ定義を更新
# ====================================

echo "🚀 SmartThreads Database Types Update Script"
echo "============================================"

# 現在のディレクトリを確認
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the project root."
    exit 1
fi

echo "📁 Current directory: $(pwd)"

# 既存のdatabase.tsをバックアップ
echo "🔄 Creating backup of existing database.ts..."
if [ -f "types/database.ts" ]; then
    cp types/database.ts types/database_backup_$(date +%Y%m%d_%H%M%S).ts
    echo "✅ Backup created successfully"
else
    echo "⚠️  No existing database.ts found, creating new one"
fi

# 新しいタイプ定義を適用
echo "📝 Updating database.ts with new types..."
if [ -f "types/database_updated.ts" ]; then
    cp types/database_updated.ts types/database.ts
    echo "✅ database.ts updated successfully"
else
    echo "❌ Error: database_updated.ts not found"
    exit 1
fi

# TypeScript コンパイルチェック
echo "🔍 Checking TypeScript compilation..."
if command -v npx &> /dev/null; then
    if npx tsc --noEmit; then
        echo "✅ TypeScript compilation check passed"
    else
        echo "⚠️  TypeScript compilation issues found. Please review the errors above."
    fi
else
    echo "⚠️  npx not found, skipping TypeScript check"
fi

# 更新されたテーブル一覧を表示
echo ""
echo "📊 Updated Database Schema Summary"
echo "=================================="
echo "✅ New Tables Added:"
echo "   • users (with profile and workspace preferences)"
echo "   • auto_reply_rules (keyword-based auto-reply system)"
echo "   • comments (comment management and tracking)"
echo "   • event_logs (audit logging system)"
echo "   • rate_limits (API rate limiting)"
echo "   • system_settings (application-wide settings)"
echo ""
echo "🔧 Enhanced Existing Tables:"
echo "   • posts (added media support, threading, quoting)"
echo "   • threads_accounts (added status, expiry, rate limit info)"
echo ""
echo "🔐 Security Features:"
echo "   • Complete RLS (Row Level Security) policies"
echo "   • Multi-tenant data isolation"
echo "   • Audit logging for all operations"
echo ""
echo "⚡ Performance Features:"
echo "   • Comprehensive indexing strategy"
echo "   • Automated rate limiting"
echo "   • Trigger-based timestamp updates"

# 次のステップの案内
echo ""
echo "🎯 Next Steps:"
echo "=============="
echo "1. Run the database migration:"
echo "   supabase db push"
echo ""
echo "2. Verify the migration:"
echo "   supabase db diff"
echo ""
echo "3. Update your API code to use the new types"
echo ""
echo "4. Test the new functionality:"
echo "   npm run dev"

echo ""
echo "🎉 Database types update completed successfully!"
echo "============================================"