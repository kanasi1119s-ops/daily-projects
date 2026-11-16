# ふるさと納税 寄付ノート (furusato-ledger)

ふるさと納税の寄付を記録し、期限（年内決済／ワンストップ申請書 翌年1/10必着）・やることリスト・上限額との差を表示する静的Webアプリ。
データは **ブラウザの localStorage のみ**に保存され、外部送信しません。

## 起動
```bash
npm install
npm run dev      # 開発
npm test         # ユニットテスト
npm run build    # dist/ を生成（静的ホスティング可）
```
## 構成
- `src/logic.ts` 純粋ロジック（集計・期限・警告・CSV・インポート）
- `src/main.ts` UI / `index.html` / `src/style.css`
- `tests/logic.test.ts` ユニット、`tests/e2e.cjs` 手動E2E（Playwright）
- `docs/` 日次レポート・公開手順書・法務チェック・LP/SNS草稿

## スコープ
含む: 記録、期限表示、警告（上限超過・5自治体超・確定申告との併用）、CSV/JSON入出力。
含まない: 上限額の税額計算（制度改正が多く誤算出リスクが高いため意図的に非対応）、ポータル連携、アカウント機能。
