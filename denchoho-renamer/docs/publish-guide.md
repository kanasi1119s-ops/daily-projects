# 公開手順書(人間が実行) — DevOps

本番反映は未実施です。以下は人間が実行してください。

1. `cd denchoho-renamer && npm test && npm run build`(`dist/` が静的サイト)
2. 静的ホスティングを選ぶ(Cloudflare Pages / Netlify / GitHub Pages など。無料枠で可)。ビルドコマンド `npm run build`、公開ディレクトリ `dist`
3. [ ] 独自ドメインの取得とDNS設定(★費用発生・人間が実施)
4. [ ] プライバシーポリシー・利用規約・(有料化時)特商法表記の作成と最終確認
5. [ ] 収益化する場合の決済アカウント接続(本番)は人間が実施。MVPは無料公開+アフィリエイト/寄付を想定
6. [ ] 公開後、SNS告知は `docs/marketing.md` を人間が確認して投稿

CI: `.github/workflows/ci.yml`(テストとビルド)。
