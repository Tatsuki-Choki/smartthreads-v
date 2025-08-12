# Supabase認証メール設定手順

## 1. Supabaseダッシュボードで確認すること

### Authentication設定
1. https://zndvvqezzmyhkpvnmakf.supabase.co にアクセス
2. 左メニュー「Authentication」をクリック
3. 「Providers」タブで「Email」が有効になっているか確認
4. 「Settings」タブで以下を確認：
   - 「Email Auth」が有効
   - 「Confirm email」が有効（メール確認が必要な場合）
   - 「Site URL」が正しく設定されている（http://localhost:3000）

### SMTP設定（重要）
1. 「Settings」→「SMTP Settings」で確認
2. デフォルトではSupabaseの制限付きSMTPが使用される
3. 本番環境では独自のSMTP設定が必要

## 2. 開発環境での解決方法

### オプション1: メール確認を無効化（開発用）
Supabaseダッシュボードで：
1. Authentication → Settings
2. 「Confirm email」を無効化
3. 「Save」をクリック

### オプション2: Inbucketを使用（ローカル開発）
```bash
# Supabase CLIでローカル環境を起動
npx supabase start
```
- メールは http://localhost:54324 のInbucketで確認可能

### オプション3: 手動でユーザーを確認
1. Authentication → Users
2. ユーザーの「...」メニュー
3. 「Confirm email」をクリック

## 3. 本番環境での設定

### カスタムSMTPの設定
1. Authentication → Settings → SMTP Settings
2. 以下を設定：
   - SMTP Host: SMTPサーバーのホスト
   - SMTP Port: ポート番号（通常587）
   - SMTP User: SMTPユーザー名
   - SMTP Password: SMTPパスワード
   - Sender email: 送信元メールアドレス
   - Sender name: 送信者名

### 推奨SMTPサービス
- SendGrid
- Amazon SES
- Mailgun
- Postmark

## 4. テスト用の即座の解決策

開発中は以下の方法で対応：
1. Supabaseダッシュボードで手動でユーザーをConfirm
2. または、Email確認を一時的に無効化