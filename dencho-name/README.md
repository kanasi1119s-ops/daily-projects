# 電帳ネーム (dencho-name)

電子帳簿保存法の検索要件(取引年月日・取引金額・取引先)に沿ったファイル名を付与し、索引簿CSVとあわせてZIPで保存する、**ブラウザだけで動く**ツール。ファイルは外部送信されません(サーバー不要の静的サイト)。

## 起動手順
```bash
npm install
npm run dev      # 開発サーバー
npm test         # ユニットテスト
npm run build    # dist/ に静的ファイル生成
```

## 構成
- `src/naming.ts` 日付/金額の正規化・ファイル名生成・重複回避
- `src/csv.ts` 索引簿CSV(BOM付きUTF-8・CSVインジェクション対策)
- `src/zip.ts` 依存なしZIPライタ(無圧縮・UTF-8ファイル名)
- `src/main.ts` UI
- `tests/` ユニットテスト / `e2e/` ブラウザ検証

## MVP範囲
含む: 複数ファイル投入、手入力、和暦/全角対応、並び順3種、ZIP+索引簿出力
含まない(将来): OCR自動入力、アカウント/課金、保存先連携

## 注意
税務・法律上の助言ではありません。公開手順は `docs/DEPLOY.md`、法務確認は `docs/LEGAL_CHECK.md` を参照。
