# 公開手順書 (人間が実行。本番反映は未実施)
1. `npm test && npm run build` が通ることを確認
2. 静的ホスティングを選ぶ(GitHub Pages / Cloudflare Pages / Netlify いずれも無料枠で可)。`dist/` を公開ディレクトリに指定
3. (任意)独自ドメイン取得とDNS設定 ★費用発生・要承認
4. privacy.html に運営者情報を追記し最終確認
5. SNS告知は docs/MARKETING.md を使用。公開・広告出稿は人間が判断
- 環境変数・シークレット: 不要
