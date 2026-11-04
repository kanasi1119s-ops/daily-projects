# 公開手順書(人間が実行)

本ツールは静的サイトです。**以下はすべて人間の判断・操作で行ってください(AIは実行していません)。**

## A. 最短: GitHub Pages
1. リポジトリ Settings → Pages → Branch を選択、フォルダは `/ (root)`。
2. 公開URLは `https://<user>.github.io/daily-projects/2026-11-04-subscan/`。
3. サンプルボタンが動くことを確認(相対パス `sample/sample.csv`)。

## B. Cloudflare Pages / Netlify / Vercel
- ビルドコマンド: なし / 出力ディレクトリ: `2026-11-04-subscan`

## C. 独自ドメイン(★要承認・費用発生)
- ドメイン取得とDNS設定は人間が実施。HTTPS必須。

## 公開前チェックリスト
- [ ] `docs/legal-review.md` の⚠️項目を確認
- [ ] 実際のカード会社CSV(自分の明細)で動作確認 — 各社の列名差異を確認
- [ ] アクセス解析を入れる場合: プライバシーポリシー作成、「送信しない」の文言を修正
- [ ] 有料化する場合: 決済(Stripe等)接続・特商法表記は人間が実施
- [ ] ブラウザ: Chrome / Safari(iOS) で `.ics` ダウンロード確認(iOSはダウンロード挙動が異なる可能性あり・未検証)
