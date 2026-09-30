# 公開手順書（人間が実行）
本番反映・ドメイン・広告は自動では行っていません。
1. `cd invoice-tokurei-sim && npm ci && npm test && npm run build`
2. `dist/` を静的ホスティングへ（例: GitHub Pages / Cloudflare Pages / Vercel。ビルドコマンド `npm run build`、出力 `dist`）
3. （任意）独自ドメイン取得・DNS設定 ← 費用発生のため要承認
4. 広告/アフィリエイトを載せる場合: 広告表記（ステマ規制）とプライバシーポリシーを整備
5. 公開前に `docs/legal-review.md` の★要対応を完了
CI: リポジトリ直下 `.github/workflows/invoice-tokurei-sim-ci.yml`（テスト+ビルド）
