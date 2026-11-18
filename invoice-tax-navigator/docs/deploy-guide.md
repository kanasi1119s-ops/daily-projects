# 公開手順書(人間が実施・本番反映は未実施)
1. 制度数値の再確認: 国税庁サイトで3割特例要件、簡易課税届出期限(2026-12-31)、みなし仕入率を確認
2. ローカル確認: `npm ci && npm test && npm run build && npm run preview`
3. ホスティング(いずれも無料枠で可。契約が発生する場合は人間が判断)
   - GitHub Pages: dist/ を公開(vite設定は相対パス出力済み)
   - Vercel/Netlify/Render Static: Build `npm run build`, Output `dist`, Root `invoice-tax-navigator`
4. ★独自ドメイン取得・DNS設定は人間が実施
5. 公開前チェック: docs/legal-review.md の★項目を解消
6. CI: `.github/workflows/invoice-tax-navigator-ci.yml`(push/PRでtest+build)
7. 公開後: 2026-12-31を過ぎたら deadline 表示が自動で切り替わる。2027年以降は文言(「2027年見込み」)の見直しが必要
