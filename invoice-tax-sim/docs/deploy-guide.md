# 公開手順書（人間が実行／DevOps準備済み）

本ツールは静的サイト（`dist/`）です。以下は**人間が実行**してください（本番反映・ドメイン・契約はAIでは実施していません）。

1. `cd invoice-tax-sim && npm ci && npm test && npm run build`
2. 無料の静的ホスティング（Cloudflare Pages / Netlify / GitHub Pages 等）で `dist/` を公開
   - ビルドコマンド: `npm run build` / 出力: `dist` / ルート: `invoice-tax-sim`
   - GitHub Pages のサブパス公開時は `vite.config.ts` に `base: "/<path>/"` を設定
3. （任意）独自ドメイン取得・DNS設定 ★費用発生・人間判断
4. 公開前チェック: `docs/legal-review.md` の「要対応」を解消、最新の国税庁情報と突き合わせ
5. 広告・アフィリエイトを入れる場合は広告表記(ステマ規制)とプライバシーポリシーを整備
6. CI: `.github/workflows/invoice-tax-sim.yml`（テスト+ビルド）済み。環境変数・シークレットは不要
