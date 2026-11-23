# 公開手順書(人間が実行。本ルーティンは本番反映しません)
1. `npm ci && npm run build` で `dist/` を生成。
2. 静的ホスティング(Cloudflare Pages / Netlify / Vercel / GitHub Pages のいずれか)に `dist/` を配置。ビルドコマンド `npm run build`、出力 `dist`、ルートは `torite-checker/`。
   - GitHub Pagesのサブパス配信なら `vite.config` で `base` を設定。
3. 独自ドメイン取得・DNS設定は人間が実施(費用発生)。
4. 公開前に `docs/legal-review.md` の★項目を完了。
5. アクセス解析・広告を入れる場合はプライバシーポリシー・Cookie表記を整備。
6. 決済(Stripe等)は本MVPでは未実装。導入は人間承認後。
CI: `.github/workflows/torite-checker.yml` が push 時にテスト・ビルドを実行。
