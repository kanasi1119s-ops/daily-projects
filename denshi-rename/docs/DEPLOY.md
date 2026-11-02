# 公開手順書（人間が実行）
本番反映・ドメイン・課金は未実施です。
1. `npm test && npm run build` → `dist/` が成果物（純静的）
2. ホスティング選択（無料枠で可）: Cloudflare Pages / Vercel / GitHub Pages のいずれか。Build command=`npm run build`, Output=`dist`, Root=`denshi-rename`
3. ★ドメイン取得・DNS設定は人間が実施（費用発生）
4. ★公開前: プライバシーポリシー・利用規約・（有料化時）特商法表記を整備
5. 有料化する場合: Stripe等の本番接続は人間が実施。MVPは無料公開が前提（決済コードは未実装）
6. 公開後スモーク: ファイル2件追加→ZIP保存→ZIP内CSVをExcelで開き文字化けがないこと
CIは `.github/workflows/denshi-rename.yml`（テスト+ビルド）。
