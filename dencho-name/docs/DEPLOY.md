# 公開手順書(人間が実行 / 本番反映は未実施)

静的サイトのため、どのホスティングでも `npm run build` の出力 `dencho-name/dist/` を配信するだけです。

## 手順(例: Cloudflare Pages / Vercel / Netlify 共通)
1. ホスティングにこのリポジトリを接続(無料枠で可。**費用発生プランは契約前に確認**)
2. Root directory: `dencho-name` / Build command: `npm run build` / Output: `dist`
3. 発行された `*.pages.dev` 等のURLで動作確認(下記チェック)
4. (任意・人間が判断)独自ドメイン取得とDNS設定
5. プライバシーポリシー・免責の最終確認後に告知

## 公開前チェック
- [ ] `npm ci && npm test && npm run build` が通る
- [ ] ZIPをmacOS/Windows標準機能で解凍し日本語ファイル名が正しい
- [ ] 索引簿.csv をExcelで開き文字化けしない(BOM付きUTF-8)
- [ ] ブラウザのネットワークタブで外部通信がない

## 環境変数・シークレット
不要(本番シークレットなし)。
