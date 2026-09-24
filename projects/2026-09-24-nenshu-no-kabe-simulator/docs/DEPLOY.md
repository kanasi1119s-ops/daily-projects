# 公開手順書（人間が実行）

本ツールは静的サイト（ビルド後は `dist/` の HTML/CSS/JS のみ）のため、以下のいずれかの手順で公開できます。
**ドメイン取得・本番DNS設定・決済アカウント接続などは、このドキュメントに従って人間が実施してください。オーケストレーターはこれらを実行しません。**

## 1. ビルド確認（実施済み）

```bash
cd projects/2026-09-24-nenshu-no-kabe-simulator
npm ci
npm run test
npm run build
```

`dist/` に静的ファイルが出力されることを確認済み（本セッションで確認済み、3回のデバッグサイクルを通過）。

## 2. デプロイ先候補と手順

### Vercel（推奨・最短）
1. Vercel にログインし、このリポジトリを Import
2. Root Directory を `projects/2026-09-24-nenshu-no-kabe-simulator` に設定
3. `vercel.json`（同ディレクトリに配置済み）がビルド設定を自動適用
4. Deploy を実行 → 発行された `*.vercel.app` の URL で動作確認
5. 独自ドメインを使う場合は、Vercel の Domains 設定でドメインを追加し、DNS側でCNAME/Aレコードを設定（★人間が実施）

### GitHub Actions によるCI（設定済み）
- `.github/workflows/nenshu-no-kabe-simulator-ci.yml` により、このプロジェクト配下への push/PR で自動的に `npm run test` と `npm run build` が実行される
- デプロイ自体は行わない（ビルド健全性の継続確認のみ）

## 3. 公開前チェックリスト（人間向け）

- [ ] ドメイン取得（独自ドメインを使う場合）
- [ ] Vercel/Netlify等へのデプロイ実行
- [ ] `docs/LEGAL_REVIEW.md` の★2項目（特商法表記の要否、数値の最終ファクトチェック）を確認
- [ ] 広告（AdSense等）を導入する場合は、広告事業者アカウントの本番接続（★人間が実施、本セッションでは未接続）
- [ ] プライバシーポリシーページの追加（データを保存しない旨を明記する簡易なもので可）
- [ ] アクセス解析（任意）の導入

## 4. ロールバック

静的サイトのため、直前のビルド成果物（`dist/`）を再デプロイするか、Vercel の「Instant Rollback」機能で前バージョンに戻せます。
