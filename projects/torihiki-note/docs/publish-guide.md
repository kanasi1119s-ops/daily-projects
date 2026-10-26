# 公開手順書(人間が実施・本番反映は未実施)

1. (任意)独立リポジトリ化: `projects/torihiki-note` を新規リポジトリ(kanasi1119s-ops配下)へ移す。`.github/workflows/torihiki-note.yml` は working-directory を `.` に直す
2. 静的ホスティング(GitHub Pages / Cloudflare Pages / Netlify / Vercel など)に `npm run build` の出力 `dist/` を指定。ビルド設定: build=`npm run build`, publish dir=`dist`
3. 公開前に `docs/legal-review.md` の「要対応」4点を完了
4. 独自ドメインを使う場合のみ、ドメイン取得・DNS設定(費用発生のため人間が判断)
5. 収益化する場合: 広告/有料版は別途検討。決済接続・特商法表記・プライバシーポリシーは人間が整備(本MVPに決済機能なし)
6. `docs/marketing.md` の文面を最終確認のうえ投稿
