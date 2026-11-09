# 電帳法ファイル名ツール (dencho-rename)

請求書・領収書などの電子取引データを、検索要件に沿った **`取引年月日_取引先_取引金額.拡張子`** 形式へ一括リネームし、**索引簿CSV**と一緒にZIPで保存するブラウザツール。
**ファイルは外部送信されず、すべてブラウザ内で処理されます。**

## 起動手順
```bash
npm install
npm run dev        # 開発サーバ
npm test           # 単体テスト(vitest)
npm run build      # 型チェック+本番ビルド → dist/
node scripts/e2e.cjs   # E2E(要 build 済み・playwright)
```

## 構成
- `src/naming.ts` 命名ロジック(純粋関数・テスト済み)
- `src/zip.ts` ZIP生成(fflate)
- `src/App.tsx` UI
- `docs/` 公開手順・法務チェック・LP/SNS草稿

## 既知の制約
- マイナス金額(値引・返品)は未対応
- 1ファイルずつ手入力(OCR/自動読み取りなし。将来案)
- 合計300MB超は警告のみ(メモリ上で処理)
- 本ツールは税務・法律上の助言ではありません
