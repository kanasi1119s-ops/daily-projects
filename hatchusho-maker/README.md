# 発注書メーカー(フリーランス新法 取引条件明示対応)
フリーランス新法の取引条件明示に必要な項目を入力し、発注書を作成・印刷(PDF保存)できる静的Webツール。入力データはブラウザ内のみで処理(外部送信・保存なし)。

## 起動
ビルド不要。`index.html` をブラウザで開く(または `python3 -m http.server`)。
## テスト
`node test/lib.test.js`(ロジック19件) / `NODE_PATH=$(npm root -g) node test/e2e.js && node test/e2e2.js`(Playwright E2E)
## 構成
`src/lib.js` 検証・計算・描画(DOM非依存) / `src/app.js` UI / `docs/` 法務・公開手順・マーケ素材・QA
## 既知の制約
- 税率10%固定、源泉徴収・軽減税率・インボイス区分記載は未対応 / 保存機能なし(印刷でPDF化) / 追加の法定記載事項は一次情報で要確認
