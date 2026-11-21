# 公開手順書(人間が実行)
本番反映・ドメイン・課金はAIでは実施していません。
1. `npm ci && npm run build` → `dist/` を確認
2. 静的ホスティング(Cloudflare Pages / Netlify / Vercel / GitHub Pages)に `dist/` を配置(無料枠でよい。費用発生は承認の上)
3. (任意) 独自ドメイン取得・DNS設定 ★人間
4. 公開前に docs/LEGAL.md の★項目を完了
5. 収益化する場合: 広告(審査あり)/有料テンプレ販売等。決済接続・特商法表記は人間が実施
