#!/usr/bin/env node

/**
 * テスト用データのセットアップスクリプト
 * 開発環境でのテストに必要な初期データを作成します
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Supabase Admin クライアント
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function setupTestData() {
  console.log('=====================================');
  console.log('テストデータセットアップ開始');
  console.log('=====================================\n');

  try {
    // 1. テストユーザーを作成（既に存在する場合はスキップ）
    console.log('1. テストユーザーを確認...');
    const testEmail = 'test@example.com';
    const testPassword = 'test123456';
    
    // 既存ユーザーを確認
    const { data: existingUser } = await supabaseAdmin.auth.admin.getUserByEmail(testEmail);
    
    let userId;
    if (existingUser) {
      console.log('✅ テストユーザーは既に存在します');
      userId = existingUser.id;
    } else {
      // 新規ユーザー作成
      const { data: newUser, error: userError } = await supabaseAdmin.auth.admin.createUser({
        email: testEmail,
        password: testPassword,
        email_confirm: true
      });
      
      if (userError) {
        console.error('❌ ユーザー作成エラー:', userError);
        return;
      }
      
      console.log('✅ テストユーザーを作成しました');
      userId = newUser.user.id;
    }
    
    console.log('  Email:', testEmail);
    console.log('  Password:', testPassword);
    console.log('  User ID:', userId);

    // 2. ワークスペースを作成
    console.log('\n2. ワークスペースを作成...');
    
    // 既存のワークスペースを確認
    const { data: existingWorkspaces } = await supabaseAdmin
      .from('workspaces')
      .select('*')
      .eq('owner_id', userId);
    
    let workspaceId;
    if (existingWorkspaces && existingWorkspaces.length > 0) {
      console.log('✅ ワークスペースは既に存在します');
      workspaceId = existingWorkspaces[0].id;
    } else {
      // 新規ワークスペース作成
      const { data: workspace, error: wsError } = await supabaseAdmin
        .from('workspaces')
        .insert({
          name: 'テストワークスペース',
          owner_id: userId,
          slug: `test-workspace-${Date.now()}`
        })
        .select()
        .single();
      
      if (wsError) {
        console.error('❌ ワークスペース作成エラー:', wsError);
        return;
      }
      
      console.log('✅ ワークスペースを作成しました');
      workspaceId = workspace.id;
      
      // ワークスペースメンバーに追加
      await supabaseAdmin
        .from('workspace_members')
        .insert({
          workspace_id: workspaceId,
          user_id: userId,
          role: 'owner'
        });
    }
    
    console.log('  Workspace ID:', workspaceId);

    // 3. Threadsアカウントをシミュレート
    console.log('\n3. Threadsアカウント情報を作成...');
    
    const { data: existingAccounts } = await supabaseAdmin
      .from('threads_accounts')
      .select('*')
      .eq('workspace_id', workspaceId);
    
    if (existingAccounts && existingAccounts.length > 0) {
      console.log('✅ Threadsアカウントは既に存在します');
    } else {
      // テスト用Threadsアカウント作成
      const { data: account, error: accountError } = await supabaseAdmin
        .from('threads_accounts')
        .insert({
          workspace_id: workspaceId,
          threads_user_id: '1234567890',
          username: 'test_user',
          access_token: JSON.stringify({
            encrypted: 'test_encrypted_token',
            iv: 'test_iv'
          })
        })
        .select()
        .single();
      
      if (accountError) {
        console.error('❌ Threadsアカウント作成エラー:', accountError);
      } else {
        console.log('✅ Threadsアカウントを作成しました');
        console.log('  Account ID:', account.id);
      }
    }

    // 4. サンプル投稿を作成
    console.log('\n4. サンプル投稿を作成...');
    
    const { data: accounts } = await supabaseAdmin
      .from('threads_accounts')
      .select('id')
      .eq('workspace_id', workspaceId)
      .limit(1);
    
    if (accounts && accounts.length > 0) {
      const accountId = accounts[0].id;
      
      // 公開済み投稿
      await supabaseAdmin
        .from('posts')
        .insert({
          workspace_id: workspaceId,
          threads_account_id: accountId,
          content: 'これはテスト投稿です #test',
          status: 'published',
          published_at: new Date().toISOString()
        });
      
      // 予約投稿
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1日後
      await supabaseAdmin
        .from('posts')
        .insert({
          workspace_id: workspaceId,
          threads_account_id: accountId,
          content: '明日公開予定のテスト投稿です #scheduled',
          status: 'scheduled',
          scheduled_at: futureDate.toISOString()
        });
      
      console.log('✅ サンプル投稿を作成しました');
    }

    // 5. 自動返信ルールを作成
    console.log('\n5. 自動返信ルールを作成...');
    
    await supabaseAdmin
      .from('auto_reply_rules')
      .insert({
        workspace_id: workspaceId,
        name: 'テストルール',
        trigger_keywords: ['質問', 'help'],
        priority: 1,
        is_active: true
      });
    
    console.log('✅ 自動返信ルールを作成しました');

    console.log('\n=====================================');
    console.log('セットアップ完了！');
    console.log('=====================================');
    console.log('\n以下の情報でログインできます:');
    console.log('URL: http://localhost:3000/login');
    console.log('Email:', testEmail);
    console.log('Password:', testPassword);
    console.log('\n=====================================');

  } catch (error) {
    console.error('❌ セットアップエラー:', error);
  }
}

// 実行
setupTestData();