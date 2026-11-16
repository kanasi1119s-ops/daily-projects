# 公開手順書（人間が実行）
1. `cd furusato-ledger && npm ci && npm test && npm run build`
2. `dist/` を任意の静的ホスティング（Cloudflare Pages / Netlify / GitHub Pages 等）へ配置。無料枠推奨。
3. 独自ドメインを使う場合のみ: ドメイン取得・DNS設定（人間が実施）。
4. プライバシーポリシー・運営者情報ページを用意し最終確認。
5. 公開後、SNS告知（docs/marketing.md）を投稿。
※ 本セッションでは本番デプロイ・ドメイン・課金設定は一切行っていません。
