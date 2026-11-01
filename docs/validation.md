# 検証記録

2026-11-01、Windows / Node.js 24 / Python 3.11で実行。

| 項目 | 結果 |
|---|---|
| Python掲載審査・抽出・更新失敗時の保持 | 39件通過 |
| Vitest / React Testing Library | 15件通過 |
| Playwright Chromium / PC・iPhone相当幅 | 6件通過。実データ3件の読込と、テスト時だけの空状態・架空データ差し替えを分離 |
| TypeScript / Vite production build | 成功 |
| 公開JSON・生成物の個人情報／テストデータ検査 | 成功、公開3件 |
| GitHub Actions / Pages本番 | 成功。Quality checks #1、Deploy verified web app #1ともに通過 |
| 実スマホ端末 | 未実施。モバイル幅・タッチ設定のChromiumで検証 |
| 外部ソース自動巡回 | 承認済み設定がないため未実施。robots・403等はMockTransportで検証 |
| 地図API・実求人の経路計測 | API・実走は未実施。Google マップの平日朝の経路予測を3件手動確認 |

実在求人の確認を公式ページ・企業ATS・媒体へ拡張し、16件をローカル審査。3件公開・12件保留・1件受付終了。内部レポートは `reports/private/2026-11-01.md`。企業発見リンクは別の内部ファイルに保持し、求人に変換していない。検索キャッシュに残る正社員募集でも、実ページが一覧へ転送され現行一覧に確認できない場合は保留にしている。

画面キャプチャはローカル `artifacts/desktop.png` と `artifacts/mobile.png`。架空データの画面を実求人として提示していない。初回のWindowsサンドボックスではrealpathとファイル置換が拒否されたため、許可済みの通常権限で再検証した。

## 最終実行

Python掲載判定39件通過（基盤検証）。実求人追加後のVitest 15 passed、Playwright 6 passed。TypeScript・Viteビルド、3件の公開データ監査・成果物の混入検査を確認。

通勤は公共の参考地点・宮口駅からのGoogle マップ予測。2026-11-02(月)8:30到着、リキシステム18〜24分、ジリオン浜松16〜22分、アオイテック本社16〜22分を2026-11-01に画面上で確認。実走の所要時間とは区別し、予測上限で並べ替え・絞り込みを行う。

2026-11-01、本人の承認後にリポジトリをPublicへ変更し、Pagesの配信元をGitHub Actionsに設定。コミット841cc97を公開し、実URLでタイトル・未検証求人を掲載しない空状態を確認しました。

- 公開サイト: https://neolqte.github.io/miyajob/
- CI: https://github.com/NeoLqte/miyajob/actions/runs/41275944743
- デプロイ成功: https://github.com/NeoLqte/miyajob/actions/runs/41276341926
