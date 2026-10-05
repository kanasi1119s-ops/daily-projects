# 公開手順書（人間が実行）
1. `npm ci && npm run build` で `dist/` を生成（確認済み）
2. 静的ホスティング（Cloudflare Pages / Vercel / GitHub Pages 等）に配置。ビルドコマンド `npm run build`、出力 `dist`。
3. 独自ドメイン取得・DNS設定（★人間の承認）
4. 公開前: プライバシーポリシー、免責、特商法表記（有料化時）を確認
5. 決済を付ける場合は別途設計（本MVPは決済なし）
