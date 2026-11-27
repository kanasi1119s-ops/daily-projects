# 公開手順書(人間が実行)
本番反映・ドメイン取得・DNS設定は人間の承認後に行ってください。
1. `npm test && npm run build` を実行し `dist/` を確認
2. 静的ホスティング(GitHub Pages / Cloudflare Pages / Netlify 等の無料枠)に `dist/` を配置 ※新規契約・費用発生は要承認
3. 独自ドメインを使う場合のみ: ドメイン取得とDNS設定(★人間)
4. 公開前に `docs/LEGAL.md` の「要対応」を全て確認
5. 公開後、文言(免責)が表示されているか目視確認
