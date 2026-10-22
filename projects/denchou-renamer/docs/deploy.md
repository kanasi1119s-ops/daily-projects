# 公開手順書(人間が実行)

本番反映・ドメイン・決済は未実施です。以下は人間の承認後に実行してください。

1. `npm test && npm run build` が通ることを確認
2. `dist/` を静的ホスティング(GitHub Pages / Cloudflare Pages / Netlify 等の無料枠)へ配置
3. (任意)独自ドメインの取得とDNS設定 ★費用発生・要承認
4. (有料化する場合)決済アカウント接続、特商法表記・プライバシーポリシーの整備 ★要承認
5. 公開後に `Content-Security-Policy` が効いていること、ZIP/CSVのダウンロードを実機で確認
