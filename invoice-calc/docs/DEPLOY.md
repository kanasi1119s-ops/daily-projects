# 公開手順書(人間が実行)
本リポジトリは本番反映を行っていません。以下は手順のみです。
1. `cd invoice-calc && npm ci && npm test && npm run build`
2. `dist/` を静的ホスティング(Cloudflare Pages / Netlify / Vercel / GitHub Pages)に配置。ビルドコマンド `npm run build`、出力 `dist`、ルートは `invoice-calc`
3. (任意)独自ドメイン取得とDNS設定 ★費用発生・人間が実施
4. 公開前に docs/LEGAL.md の ★項目を確認
5. 広告/アフィリエイト導入時は、プライバシーポリシーと広告表記(ステマ規制)を整備
注意: シークレット・環境変数は不要です。
