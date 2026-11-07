# 公開手順書(人間が実行)
本番反映・ドメイン・外部契約は未実施です。
1. 内容確認: `npm ci && npm test && npm run build`
2. `privacy.html` の運営者名・連絡先を記入
3. 静的ホスティングを選ぶ(GitHub Pages / Cloudflare Pages / Vercel 等。無料枠でも可)
   - ビルドコマンド `npm run build` / 出力 `dist`(`base:"./"`のためサブパス配信可)
4. 独自ドメインを使う場合のみ: ドメイン取得とDNS設定(★人間が実施)
5. CSPは meta で設定済み。ホスティング側でHTTPヘッダ(CSP等)も付けられるなら追加を推奨
6. 公開後: iOS Safari/Android Chromeで実機確認
7. SNS告知は `docs/MARKETING.md` を使用(★投稿は人間が実施)
