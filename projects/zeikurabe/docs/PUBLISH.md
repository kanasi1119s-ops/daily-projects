# 公開手順書（人間が実行）
本ツールは静的サイトです。ビルド不要。**以下は未実施です。**
1. [ ] 法務チェック(`LEGAL.md`)の★項目を確認
2. [ ] リポジトリを `kanasi1119s-ops` 配下の専用リポジトリに切り出す（`projects/zeikurabe` をルートに）
3. [ ] ホスティング選択（GitHub Pages / Cloudflare Pages / Netlify 等の無料枠。公開ディレクトリはルート）
4. [ ] （任意・費用発生）独自ドメイン取得とDNS設定
5. [ ] 制度数値の最終確認 → 公開 → SNS告知
CI: `.github/workflows/zeikurabe-ci.yml` が push 時に `npm test` を実行します。
