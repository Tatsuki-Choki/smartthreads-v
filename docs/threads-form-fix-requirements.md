# Threads連携フォーム問題の要件定義

## 問題の概要
threads-setupページで認証情報（CLIENT_ID、CLIENT_SECRET、ACCESS_TOKEN）を入力しても、「ユーザー情報を取得」ボタンが無効のままで押せない。

## 現状分析

### 1. 現在の問題点
- Playwrightテストで3つのフィールドに値を入力
- 入力後もボタンが `disabled` 状態のまま
- ボタンの有効化条件: `!loading && !verifying && clientId && clientSecret && accessToken`

### 2. 考えられる原因
1. **State更新の問題**
   - 入力フィールドの`onChange`イベントがstateを更新していない
   - React Stateの初期化に問題がある

2. **入力フィールドのID/name属性の問題**
   - PlaywrightがフィールドをIDで選択しているが、実際のフィールドにIDが設定されていない
   - 値は入力されるがReact stateが更新されない

3. **コンポーネントの再レンダリング問題**
   - stateは更新されているが、UIが再レンダリングされない

## 調査項目

### 1. 入力フィールドの実装確認
- [ ] 各入力フィールドに正しい`id`属性が設定されているか
- [ ] `onChange`ハンドラが正しくstateを更新しているか
- [ ] `value`属性が正しくstateとバインドされているか

### 2. State管理の確認
- [ ] `useState`の初期値
- [ ] setState関数の呼び出し
- [ ] stateの値がボタンの有効化条件に正しく反映されているか

### 3. フォームのバリデーション
- [ ] 各フィールドの値が空でないことの確認
- [ ] トリミング処理の有無
- [ ] 非同期処理の影響

## 改修方針

### Phase 1: 現状調査
1. threads-setupページのコード詳細確認
2. 入力フィールドの実装状況確認
3. state管理の実装確認

### Phase 2: 問題の特定と修正
1. **入力フィールドの修正**
   - 必要な属性（id, name, value, onChange）の追加
   - state更新ロジックの修正

2. **デバッグ機能の追加**
   - state値のリアルタイム表示
   - ボタン無効化理由の表示

3. **Playwrightテストの改善**
   - 入力後のstate更新待機
   - より確実な入力方法の実装

### Phase 3: テストと検証
1. 手動テストでの動作確認
2. Playwrightテストの成功確認
3. エッジケースのテスト

## 実装計画

### 1. コード調査（優先度: 高）
- threads-setup/page.tsxの全体構造確認
- 入力フィールドコンポーネントの詳細確認
- state管理の実装詳細確認

### 2. 修正実装（優先度: 高）
```typescript
// 期待される実装
<Input
  id="clientId"
  name="clientId"
  type="text"
  value={clientId}
  onChange={(e) => setClientId(e.target.value)}
  required
  disabled={loading || verifying}
/>
```

### 3. デバッグ情報追加（優先度: 中）
```typescript
// デバッグ用のstate表示
{process.env.NODE_ENV === 'development' && (
  <div className="text-xs text-gray-500">
    clientId: {clientId ? '✓' : '✗'}
    clientSecret: {clientSecret ? '✓' : '✗'}
    accessToken: {accessToken ? '✓' : '✗'}
  </div>
)}
```

### 4. Playwrightテスト改善（優先度: 中）
```javascript
// より確実な入力方法
await page.fill('#clientId', '742705564969130');
await page.keyboard.press('Tab'); // フォーカスを移動してonChangeをトリガー
```

## 成功基準
1. ✅ 3つのフィールドに値を入力後、ボタンが有効になる
2. ✅ Playwrightテストでボタンをクリックできる
3. ✅ Threads API認証が成功する
4. ✅ 認証成功後、適切にリダイレクトされる

## テスト項目
1. 各フィールドへの入力でstateが更新される
2. すべてのフィールドに値がある時、ボタンが有効になる
3. いずれかのフィールドが空の時、ボタンが無効になる
4. loading/verifying中はボタンが無効になる