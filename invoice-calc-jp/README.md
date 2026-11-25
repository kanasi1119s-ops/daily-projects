# 請求書・インボイス計算ツール (invoice-calc-jp)
フリーランス・個人事業主向け。消費税の端数処理／源泉徴収／免税事業者への支払いに対する仕入税額控除の経過措置を、ブラウザ内のみで計算する静的サイト（依存なし）。

## 起動
```
npx serve .        # または python3 -m http.server → http://localhost:8000
npm test           # 計算ロジックの単体テスト (node:test)
NODE_PATH=$(npm root -g) npm run e2e   # Playwright E2E
```
## 構成
`calc.js`（純粋関数）/ `app.js`（UI）/ `index.html` / `test/` / `docs/`

## 注意
税務判断を保証しません。経過措置割合（〜2026/9/30 80%、〜2029/9/30 50%）は要確認。詳細は `docs/`。
