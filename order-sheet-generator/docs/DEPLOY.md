# 公開手順書(人間が実施・本番反映は未実施)
静的サイトのためビルド不要。公開対象ディレクトリは `order-sheet-generator/`。
1. 無料の静的ホスティングを選ぶ(GitHub Pages / Cloudflare Pages / Netlify)。ルートに `order-sheet-generator` を指定。
2. まず無料のサブドメインで公開し動作確認(ドメイン購入はその後。★費用発生は人間判断)。
3. 公開前に docs/LEGAL.md の「要人間確認」を完了。
4. (任意)カスタムドメイン取得・DNS設定は人間が実施。
5. 収益化する場合の候補(未実装): 広告、有料テンプレ集、PDF出力・履歴保存のサブスク。決済接続は人間が実施。
CI: `.github/workflows/order-sheet-test.yml` が push 時に `node --test` を実行。
