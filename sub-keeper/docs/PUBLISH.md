# 公開手順書（人間が実行）
ビルド不要の静的サイトです。※以下は未実行です。
## A. GitHub Pages（無料・推奨）
1. このフォルダを単独リポジトリにするか、`sub-keeper/` を公開ディレクトリとして配信
2. Settings → Pages → Branch を選択して保存
## B. Render / Netlify / Vercel
Static Site、Build Command なし、Publish Directory=`sub-keeper`
## C. 独自ドメイン（人間の承認事項）
ドメイン購入・DNS設定は人間が実施。
## 公開前チェックリスト
- [ ] docs/LEGAL.md の【要人間確認】を確認
- [ ] 実機でICSをGoogleカレンダー/iOSカレンダーに取り込み確認
- [ ] 広告/解析を入れるならプライバシーポリシー整備（CSPの緩和が必要）
