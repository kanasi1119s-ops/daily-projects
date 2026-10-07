# 公開手順書(人間が実行)

本番公開・ドメイン・決済は自動実行していません。
1. `npm test && npm run build` が通ることを確認
2. 静的ホスティング(GitHub Pages / Cloudflare Pages / Netlify 等)に `dist/` を配置(無料枠で可)
3. ★独自ドメインを使う場合のみ、ドメイン取得とDNS設定を人間が実施
4. 法務チェック(`docs/LEGAL_REVIEW.md` の★)を解消
5. 収益化する場合: 特商法表記・プライバシーポリシー・決済接続(Stripe等)を人間が実施。無料公開+広告/関連サービス導線も選択肢
6. SNS告知は `docs/MARKETING.md` の草稿を確認のうえ投稿
