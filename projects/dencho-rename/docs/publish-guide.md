# 公開手順書(人間が実行 / 本番反映はAIでは未実施)
静的サイトのため、どのホスティングでも可(`dist/` を配信するだけ)。
1. `npm ci && npm run build` で `dist/` を生成
2. 例) Cloudflare Pages / Netlify / Vercel / GitHub Pages に `dist/` を配置(Vite設定は `base: './'` のため相対配信可)
3. 独自ドメイン取得・DNS設定は **人間が実施**(費用発生)
4. 公開前に `docs/legal-review.md` の★項目を確認・記入
5. 決済(有料プラン)を行う場合は Stripe 等のアカウント作成・本番接続は **人間が実施**。MVPは完全無料・決済機能なし
6. CI: `.github/workflows/dencho-rename-ci.yml` が push 時にテスト+ビルドを実行
