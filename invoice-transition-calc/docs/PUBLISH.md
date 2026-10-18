# 公開手順書（人間が実行）
1. `src/rates.js` の割合・期間を国税庁の最新資料と照合 → `RATES_VERIFIED = true`。
2. `npm test && npm run build`。
3. 静的ホスティング（GitHub Pages / Cloudflare Pages / Vercel 等の無料枠）へ `dist/` を配置。※新規契約・費用発生は人間判断。
4. 独自ドメインを使う場合のみ、人間がドメイン取得・DNS設定。
5. 広告/解析を入れる場合はプライバシーポリシーを整備。
6. SNS告知は `docs/MARKETING.md` を確認のうえ人間が投稿。
