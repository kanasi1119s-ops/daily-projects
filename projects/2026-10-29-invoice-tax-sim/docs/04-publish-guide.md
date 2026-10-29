# 公開手順書（人間向・本番反映は未実施）
1. 税制要件の一次確認（国税庁/財務省）。`docs/02-legal-review.md` の★を解消。
2. Vercel / Cloudflare Pages / GitHub Pages等に `projects/2026-10-29-invoice-tax-sim` を指定し、Build: `npm run build`、Output: `dist`。
3. （任意）独自ドメイン取得・DNS設定 ← 要承認・費用発生。
4. 広告/アフィリエイト導入時は プライバシーポリシー・特商法表記を整備。
5. SNS投稿は `docs/05-marketing.md` を確認の上、人間が投稿。
環境変数・シークレットは不要。
