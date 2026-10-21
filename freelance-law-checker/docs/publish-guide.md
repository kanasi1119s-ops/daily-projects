# 公開手順書(人間が実行)
1. `npm ci && npm test && npm run build` が通ることを確認
2. 静的ホスティング(Vercel/Netlify/Cloudflare Pages/GitHub Pages)に `dist/` をデプロイ(Build: `npm run build`, Output: `dist`)
3. 独自ドメインを使う場合のみドメイン取得・DNS設定(★費用発生・人間承認)
4. 解析ツールを入れる場合はプライバシーポリシーを整備
5. 法務チェックの★項目を確認してからSNS告知
