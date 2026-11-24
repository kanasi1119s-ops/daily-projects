# 公開手順書(人間が実行)
本番反映・ドメイン・外部公開は自動では行っていません。
1. 上記 docs/LEGAL.md の「要対応」を確認・解消
2. GitHub Pages: リポジトリ Settings → Pages → Source を "GitHub Actions" に設定
3. Actions タブから "Deploy to GitHub Pages" を手動実行(`workflow_dispatch`)。テスト→ビルド→配備
4. (任意)独自ドメイン: ドメイン購入とDNS(CNAME)設定は人間が実施。Pages設定でカスタムドメインを入力
5. (任意)収益化: 広告/有料テンプレ販売等を行う場合は特商法表記・プライバシーポリシーを整備
6. 公開後 `npm run build` の出力(dist/)が配信されていることを確認
別のホスティング(Cloudflare Pages/Netlify/Vercel)でも `npm run build` → `dist/` を指定するだけで動作します。
