# 公開手順書（人間が実行／本番反映は未実施）
1. `npm test && npm run build` → `dist/` が成果物（静的ファイルのみ）。
2. ホスティング（例: GitHub Pages / Cloudflare Pages / Render Static Site）で `freelance-order-sheet/dist` を公開。環境変数・シークレット不要。
3. 独自ドメインは任意（**取得・DNS設定は人間が実施**）。
4. 公開前: `privacy.html` の運営者情報記入、`docs/legal.md` の★項目を完了。
5. 有料化する場合のみ: 決済アカウント接続・特商法表記（人間）。当面は広告/任意支援/無料配布から検証推奨。
CI: `.github/workflows/freelance-order-sheet.yml`（テスト+ビルド）。
