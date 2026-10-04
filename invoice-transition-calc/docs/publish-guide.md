# 公開手順書(人間が実行)
1. 控除率スケジュールを国税庁サイトの最新情報と照合し、必要なら `src/calc.js` の SCHEDULE を修正して `npm test`。
2. `npm run build` → `dist/` を Cloudflare Pages / Netlify / GitHub Pages 等の静的ホスティングに配置(無料枠で可)。
3. (任意)独自ドメイン取得とDNS設定 ★人間が実施。
4. アクセス解析・広告を入れる場合はプライバシーポリシーを整備 ★人間が確認。
5. SNS投稿は `docs/marketing.md` の草稿を確認のうえ人間が投稿。
本番デプロイ・課金接続は自動では行っていません。
