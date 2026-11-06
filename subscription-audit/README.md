# サブスク棚卸し (subscription-audit)

契約中のサブスクを書き出し、月額・年額に換算し、更新日をカレンダー(.ics)に登録できるブラウザ完結ツール。
サーバー送信なし・アカウント登録なし・外部スクリプトなし(依存パッケージ0)。

## 機能(MVP)
- サブスクの登録・編集・削除(サービス名/金額/周期/請求日/利用頻度/カテゴリ/メモ)
- 月額・年額への換算、次回請求日の自動計算(月末クランプ対応)
- 30日以内の更新アラート表示、利用頻度が低いものを「見直し候補」として抽出
- `.ics` 出力(繰り返し予定+事前リマインダー3日前)/ CSV出力(CSVインジェクション対策済み)/ JSONバックアップ・復元
- データは localStorage のみ。CSPで外部通信を遮断

## 起動
```bash
npm start          # http://localhost:8080 (PORT=3000 で変更可)
npm test           # ユニットテスト(node:test)
npm run build      # dist/ に静的ファイルを出力
```
Node.js 20 以上。E2E(任意, Playwright 必要): `PORT=8099 npm start` の状態で `node test/e2e/smoke.cjs`。

## 構成
```
index.html / privacy.html / style.css
src/core.js   純粋ロジック(換算・日付・検証・CSV/ICS)
src/app.js    UI(DOMはtextContentのみで描画)
test/         ユニットテスト + e2e/
docs/         法務レビュー・公開手順・QA・マーケ素材
```

## 既知の制約
- 通貨は円のみ。税込/税抜の区別なし。無料体験→有料の自動切替は未対応。
- 複数端末間の同期なし(JSONバックアップで手動移行)。
- 年次(2/29基準)は非うるう年に2/28扱い。
- 公開前の人間作業は `docs/deploy-guide.md` と `docs/legal-review.md` を参照。
