# 公開手順書（人間が実行）
本AIは本番反映をしていません。以下は人間が行う作業です。
1. [ ] 法務確認（docs/legal-review.md の★項目）
2. [ ] `npm ci && npm run build` → `dist/` を Cloudflare Pages / Netlify / GitHub Pages 等に配置（無料枠で可。新規契約は人間が判断）
3. [ ] 独自ドメイン取得・DNS設定（任意、費用発生）
4. [ ] アクセス解析を入れる場合: プライバシーポリシー作成
5. [ ] 収益化する場合の候補（仮説）: 関連サービスへのアフィリエイト、有料の契約書テンプレ集。Stripe接続・特商法表記は人間が実施
6. [ ] SNS告知（docs/marketing.md）を人間が投稿
