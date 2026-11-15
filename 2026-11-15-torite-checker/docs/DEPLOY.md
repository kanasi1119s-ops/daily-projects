# 公開手順書（人間が実行する）

本番反映・ドメイン・外部公開はオーナー承認後に人間が行います。

## 公開前チェック（必須）
- [ ] docs/LEGAL_REVIEW.md の「★要確認」をすべて解消（一次情報で数値基準を再確認）
- [ ] 運営者情報・お問い合わせ先をフッターに追記（個人運営でも責任主体を明示）
- [ ] 免責文言の最終確認（できれば弁護士レビュー）

## 静的ホスティング（いずれか。無料枠で可）
ビルド: `npm ci && npm run build` ／ 出力: `dist/`（`base: './'` のためサブパス配信可）
- Render Static Site / Cloudflare Pages / Vercel / GitHub Pages のいずれか
  - Build command: `npm ci && npm run build`、Publish directory: `dist`
- 独自ドメインは任意。取得・DNS設定は人間が実施（本ルーチンでは実行しません）

## CI（任意）
`docs/ci.yml.example` をリポジトリ直下の `.github/workflows/` に配置するとpush時にテスト・ビルドが走ります（作業ディレクトリは本フォルダに合わせて調整）。

## 収益化（仮説・未実装）
広告/アフィリエイト（弁護士相談・契約書レビュー等）/関連テンプレ販売。決済やアフィリエイト契約は人間が判断・設定。
