# 検証記録

2026-11-01、Windows / Node.js 24 / Python 3.11で実行。

| 項目 | 結果 |
|---|---|
| Python掲載審査・抽出・更新失敗時の保持 | 39件通過 |
| Vitest / React Testing Library | 14件通過 |
| Playwright Chromium / PC・iPhone相当幅 | 4件通過。実データ0件とテスト時だけのネットワーク差し替えを分離 |
| TypeScript / Vite production build | 成功 |
| 公開JSON・生成物の個人情報／テストデータ検査 | 成功、公開0件 |
| GitHub Actions / Pages本番 | リモート権限未解決のため未実行 |
| 実スマホ端末 | 未実施。モバイル幅・タッチ設定のChromiumで検証 |
| 外部ソース自動巡回 | 承認済み設定がないため未実施。robots・403等はMockTransportで検証 |
| 地図API・実求人の経路計測 | 未実施 |

実在求人の確認は公式ページの手動閲覧で6件をローカル登録。5件保留・1件受付終了、公開0件。内部レポートは `reports/private/2026-11-01.md`。企業発見リンクは別の内部ファイルに保持し、求人に変換していない。

画面キャプチャはローカル `artifacts/desktop.png` と `artifacts/mobile.png`。架空データの画面を実求人として提示していない。初回のWindowsサンドボックスではrealpathとファイル置換が拒否されたため、許可済みの通常権限で再検証した。

## 最終実行

Python 39 passed、Vitest 14 passed、Playwright 4 passed。TypeScript・Viteビルド、公開データ監査・成果物の混入検査、Schema生成差分なしを確認。公開データ0件。外部公開は未実行。
