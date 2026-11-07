# サブ減(sabuhen)— サブスク見直し診断

契約中のサブスクを入力すると、月額/年額の合計、同カテゴリの重複、利用1回あたりコスト、年払い切替での節約可能額から「解約候補/要見直し/継続でOK」を目安表示する静的Webアプリ。
**データはブラウザの localStorage のみ。サーバー送信なし(CSPで外部通信も禁止)。**

## 起動
```bash
npm install
npm run dev        # 開発サーバー
npm test           # ユニットテスト(vitest, 21件)
npm run build      # 型チェック + 本番ビルド(dist/)
npx vite preview --port 4173 & node tests/e2e.cjs   # 任意: Playwright E2E(要グローバルPlaywright)
```

## 構成
- `src/logic.ts` 純粋ロジック(計算・判定・検証・CSV)/ `src/storage.ts` 永続化 / `src/main.ts` UI
- `docs/` QAレポート・法務チェック・公開手順・LP/SNS草稿
- リポジトリ直下 `.github/workflows/sabuhen-ci.yml` テスト+ビルド(デプロイはしない)

## MVP範囲
含む: 登録/編集/削除、月額年額換算、判定、重複検出、解約試算、CSV入出力、サンプル、プライバシーページ(ドラフト)
含まない: 通知、サービス料金DB自動取得、アカウント/同期、課金、アクセス解析
