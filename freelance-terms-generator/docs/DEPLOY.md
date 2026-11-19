# 公開手順書(人間が実行)
本番反映・ドメイン・外部公開はAIでは実施していません。静的サイトで費用はほぼ0円です。
1. `npm test && npm run build` → `dist/` が成果物
2. ホスティング選択(例: Cloudflare Pages / Netlify / GitHub Pages)。Build: `npm run build`、Output: `dist`、Root: `freelance-terms-generator`
3. まず無料のサブドメインで限定公開し、`docs/LEGAL.md` の★項目を確認
4. 独自ドメイン取得・DNS設定は人間が実施(費用発生)
5. 解析・広告・決済を追加する場合: プライバシーポリシー/特商法表記を整備してから
## CI
リポジトリ直下 `.github/workflows/freelance-terms-generator.yml` がPR/pushでテストとビルドを実行します。
