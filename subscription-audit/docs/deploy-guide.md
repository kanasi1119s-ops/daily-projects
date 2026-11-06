# 公開手順書 (人間が実施 / 本番反映は未実施)

1. `cd subscription-audit && npm test && npm run build`(依存なし、`dist/`が成果物)
2. ホスティングを選ぶ(いずれも無料枠で可。契約・費用発生は人間が判断)
   - Cloudflare Pages / Vercel / Netlify / GitHub Pages: ルートを `subscription-audit`、ビルド `npm run build`、出力 `dist`
   - Vercel の場合 `vercel.json` にセキュリティヘッダー設定済み
   - Docker: `docker build -t sub-audit . && docker run -p 8080:80 sub-audit`(事前に `npm run build`)
3. ★ドメイン取得・DNS設定は人間が実施(未実施)
4. ★`privacy.html` に運営者情報を追記。収益化する場合は特商法表記・利用規約を整備
5. 公開後チェック: HTTPSで開く / サンプル追加 / .ics をGoogleカレンダー・iPhone・Outlookで取り込み / スマホ表示
6. 計測や広告を入れる場合は CSP とプライバシーポリシーを必ず更新(現在は外部通信を全遮断)
