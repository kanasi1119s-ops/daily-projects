# 公開手順書（人間が実行）
本番反映・ドメイン・課金はAIでは行っていません。
1. `npm ci && npm run build` → `dist/` が成果物
2. 静的ホスティング(GitHub Pages / Cloudflare Pages / Netlify等、無料枠)に `dist/` を配置  ※新規契約が必要な場合は費用を確認
3. （任意）独自ドメイン取得・DNS設定 ★人間のみ
4. （任意）アクセス解析導入時はプライバシーポリシー追加 ★人間確認
5. 有料化する場合は決済(Stripe等)接続と特商法表記 ★人間のみ
6. 公開前に docs/legal-review.md の[要対応]を解消
