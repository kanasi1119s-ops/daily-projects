# 公開手順書（人間が実行・本番反映は未実施）
1. ★一次資料照合: docs/legal-review.md の未チェック項目を完了
2. ホスティング選択（無料枠: GitHub Pages / Cloudflare Pages / Netlify / Vercel）
   - ビルドコマンド `npm run build`、公開ディレクトリ `dist`
3. （任意）独自ドメイン取得・DNS設定 ← 費用発生、人間が実施
4. （任意）広告/アフィリエイト導入時: プライバシーポリシー・広告表記を整備
5. 公開前に `npm test` と E2E を実行、実機スマホで表示確認
6. 毎年の税制改正時に `src/calc.js` の定数・TAX_YEARSを更新

## GitHub Actions 例（.github/workflows/ci.yml として配置）
```yaml
name: ci
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm test
      - run: npm run build
```
