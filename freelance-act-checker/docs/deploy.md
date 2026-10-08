# 公開手順書（人間が実行）
本ツールは静的ファイルのみ。ビルド不要。`freelance-act-checker/` 直下をそのまま配信。
1. GitHub Pages / Cloudflare Pages / Netlify 等で `freelance-act-checker/` を公開ディレクトリに指定（無料枠）
2. 独自ドメインを使う場合のみ: ドメイン購入・DNS設定（★人間の承認事項）
3. 公開前に docs/legal-review.md の ★ を全て確認
4. SNS投稿・広告は人間が実施（docs/marketing.md は草稿）
CI: `.github/workflows/freelance-act-checker.yml`（テスト実行のみ。デプロイなし）
