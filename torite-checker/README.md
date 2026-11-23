# 取適法・フリーランス法 支払期日チェッカー

受領日から60日以内の支払期日・遅延利息の目安・締め日運用の検証・適用法令の目安・発注書チェックリストを、ブラウザ内だけで計算する静的ツール。入力はサーバーに送信されません。

## 起動手順
```bash
cd torite-checker
npm install
npm run dev      # 開発サーバー
npm test         # ロジックのテスト
npm run build    # 型チェック + dist/ 生成(静的ファイル)
```

## 構成
- `src/logic.ts` 純粋関数(日付計算・適用判定)/ `src/main.ts` UI / `tests/` vitest
- `docs/` 法務チェック・公開手順書・LP草稿・SNS文・日次レポート

## 既知の制約
`docs/daily-report.md` 参照。法的助言ではなく目安ツールです。
