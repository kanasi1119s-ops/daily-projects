# 公開手順書(人間が実行)
1. `npm test && npm run build` を実行し dist/ を確認。
2. ホスティング選択(GitHub Pages / Cloudflare Pages / Netlify いずれも無料枠で可。**新規契約は人間が判断**)。
3. `.github/workflows/pages.yml`(同梱・未有効化)を使う場合はリポジトリ直下 `.github/workflows/` へ移動し、Settings→Pages を GitHub Actions に設定。
4. 独自ドメインは任意(購入・DNS設定は人間)。
5. 公開前に docs/LEGAL.md の★項目を確認(免責文・運営者表記)。
