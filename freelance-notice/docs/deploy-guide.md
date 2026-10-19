# 公開手順書 (DevOps) — 人間が実行する作業
本ツールは静的サイトです。実際のデプロイは行っていません。
1. `cd freelance-notice && npm ci && npm test && npm run build` が通ることを確認
2. Vercel / Cloudflare Pages / GitHub Pages のいずれかにこのディレクトリを接続 (ビルド: `npm run build`、出力: `dist`)。`vercel.json` 同梱
3. (任意) 独自ドメイン取得とDNS設定 ★人間の承認・費用発生
4. 公開前に docs/legal-check.md の★項目を解消
5. 広告・アフィリエイト・課金を付ける場合は特商法表記とプライバシーポリシーを整備
