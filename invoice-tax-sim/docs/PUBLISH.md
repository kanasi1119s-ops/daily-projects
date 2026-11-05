# 公開手順書(人間が実行)
本番反映は未実施です。以下は人間が承認のうえ実行してください。
1. (任意)GitHub Pages: リポジトリ Settings > Pages で公開元を設定。`invoice-tax-sim/` を公開ルートにするには、GitHub Actions の `actions/upload-pages-artifact` の `path: invoice-tax-sim` を指定。
   または Vercel / Netlify で Root Directory を `invoice-tax-sim`、Build Command なし、Output そのまま。
2. 独自ドメインを使う場合: ドメイン購入とDNS設定(CNAME)は人間が実施。【要承認・費用発生】
3. 公開前に `docs/LEGAL_CHECK.md` の「要対応」を解消。
4. 公開前に最新の税制(国税庁)と照合: 2割特例の期間、みなし仕入率、簡易課税の上限5,000万円。
5. 広告(AdSense等)やアフィリエイトを入れる場合は各規約確認と、サイトへの表記(広告表示)を追加。
