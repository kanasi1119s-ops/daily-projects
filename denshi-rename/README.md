# 電帳法ファイル名ツール (denshi-rename)

請求書・領収書などの電子取引データを **「取引年月日_取引先_取引金額.拡張子」** に揃え、**検索台帳CSV** と一緒にZIPで保存するブラウザ完結ツール。
ファイルはブラウザ外に送信されません（CSPで `connect-src 'none'`）。依存パッケージなし。

> 補助ツールです。電子帳簿保存法の要件充足を保証しません。docs/LEGAL.md 参照。

## 起動
```bash
npm test          # ユニットテスト (Node 20+)
npm run build     # dist/ に静的ファイルを出力
npm start         # http://localhost:8080
```
## 構成
- `src/core.js` 日付/金額正規化・ファイル名生成・重複回避・CSV・無圧縮ZIP（DOM非依存）
- `app.js` / `index.html` / `style.css` UI
- `tests/` node:test（ZIPは python zipfile で実検証）
- `docs/` 日次レポート・法務・公開手順・LP/SNS草稿

## MVP範囲
含む: 複数ファイル追加、和暦/全角対応、検証、重複回避、CSV(BOM付)、ZIP出力
含まない: OCR自動読取、フォルダD&D、200MB超、クラウド保存、アカウント
