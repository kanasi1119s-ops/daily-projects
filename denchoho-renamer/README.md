# 電帳法ファイル名ヘルパー

領収書・請求書などの電子取引データのファイル名を `取引年月日_取引先_金額[_種別].拡張子` に一括変換し、索引CSVとあわせてZIPで出力するブラウザツール。**処理はすべて端末内で完結**(外部送信なし)。

## 起動
```
npm start        # http://localhost:8080
npm test         # ユニットテスト(Node 22+, python3 が必要なZIP検証を含む)
npm run build    # dist/ に静的ファイルを出力
node test/e2e.mjs  # (任意)Playwright によるE2E。npm start 中に実行
```
依存パッケージなし。

## 構成
- `src/lib.js` 正規化・ファイル名生成・重複回避・CSV・ZIP生成(純粋関数)
- `src/app.js` UI / `index.html`
- `docs/` 法務レビュー、公開手順書、マーケ素材

## 既知の制約
- OCRなし(日付・取引先・金額は手入力)
- 和暦入力は未対応(西暦のみ)
- 合計500MBまで(ZIP64非対応)
- 本ツールは電帳法の要件を満たすことを保証しません(`docs/legal-review.md` 参照)
