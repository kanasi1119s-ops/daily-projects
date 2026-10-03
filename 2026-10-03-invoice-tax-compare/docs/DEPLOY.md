# 公開手順（人間が実行）
本番反映・ドメイン・課金はオーナーの承認後に実施。
1. `npm ci && npm test && npm run build`
2. `dist/` を静的ホスティング（Vercel / Cloudflare Pages / GitHub Pages）へ。Vercel例: Root=`2026-10-03-invoice-tax-compare`, Build=`npm run build`, Output=`dist`。
3. （任意）独自ドメイン取得・DNS設定。★人間が実施
4. 公開前: 国税庁情報で制度内容を再確認／免責文・プライバシー表記を確認。
5. 収益化は仮説: 税理士・会計ソフト紹介のアフィリエイト or 広告。契約・審査は人間が実施。
