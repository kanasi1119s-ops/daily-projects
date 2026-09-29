# 公開手順書(人間が実行)
本番反映・ドメイン・広告は未実施。
1. `npm test && npm run build` を実行し `dist/` を生成
2. 静的ホスティング(GitHub Pages / Netlify / Vercel 等、無料枠)に `dist/` を配置
3. (任意)独自ドメイン取得・DNS設定 ※費用発生・人間が実施
4. 公開前に docs/legal-review.md の★項目を確認
5. 公開後、税制改正の確定内容に合わせて `src/logic.js` の定数を更新
