# 公開手順書(人間が実行)
1. 制度数値を国税庁・財務省の一次資料で確認し、`src/calc.ts` を必要なら修正(特に3割特例の要件/年分、簡易課税の適用範囲)
2. `npm ci && npm test && npm run build`
3. `dist/` をCloudflare Pages / Netlify / GitHub Pages等の静的ホスティングへデプロイ(★契約・DNS・独自ドメイン取得は人間)
4. 広告/アフィリエイトを入れる場合: 利用規約・PRの明示・プライバシーポリシーを整備(★人間の最終確認)
5. 公開後、LP/SNS草稿(`docs/marketing.md`)を使用
