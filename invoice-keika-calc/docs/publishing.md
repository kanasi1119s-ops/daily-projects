# 公開手順書（人間が実行）

本リポジトリは**本番公開していません**。以下は人間が実行します。

1. `docs/legal-check.md` の★項目を解消（特に控除割合の一次情報確認）
2. 新規GitHubリポジトリへ切り出す場合: `invoice-keika-calc/` ディレクトリを独立リポジトリとして push（今回は権限の都合で `daily-projects` 内に配置）
3. ホスティング（無料枠例）: GitHub Pages / Cloudflare Pages / Vercel / Render Static Site
   - Build: `npm ci && npm run build` / Publish dir: `dist`
   - `base: './'` 設定済みのためサブパス配信でも動作
4. 独自ドメインを使う場合のみ、ドメイン購入とDNS設定（**費用発生・人間が実施**）
5. 収益化する場合: アフィリエイト契約（会計ソフト等）、広告、プライバシーポリシー/運営者情報の整備
6. 公開後: 法改正時に `src/schedule.ts` を更新 → `npm test` → 再デプロイ
