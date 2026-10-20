# 公開手順書(人間が実行)
本リポジトリは **本番反映していません**。以下は人間が判断・実行します。
1. 制度情報の一次確認(国税庁: 2割特例の終了、3割特例、簡易課税の届出期限)→ `index.html` の注記を更新
2. ホスティング選択(いずれも無料枠あり。契約が必要な場合は人間が判断)
   - GitHub Pages / Cloudflare Pages / Netlify: ビルドコマンド `npm run build`、公開ディレクトリ `dist`
3. (任意)独自ドメイン取得・DNS設定 ★費用発生・人間のみ
4. アクセス解析・広告を入れる場合はプライバシーポリシーと同意取得を整備
5. 公開前チェック: `npm test` / `npm run build` / docs/legal-review.md の⚠️項目をすべて解消
CI: リポジトリ直下 `.github/workflows/invoice-tax-simulator.yml` がテストとビルドを実行します。
