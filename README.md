# MiyaJob

応募条件・勤務地・通勤・募集継続を確認した求人だけを検索する、個人向けの静的Webアプリです。React / TypeScript / Vite / Tailwind CSSと、独立したPython収集・掲載審査パイプラインで構成します。DB・有料AI API・会員登録は不要です。

## 現在の状態

- Webアプリと掲載判定基盤、収集アダプタ、CI・Pagesデプロイ定義を実装済み。
- 公開求人は **0件**。テスト専用の架空データは `collector/tests`、`web/src/test` に限定し、本番ビルドには入りません。
- 2026-11-01に公式採用ページを手動で確認し、実在する募集6件をローカル登録。5件を保留、受付終了1件を除外。これは網羅的な収集完了を意味しません。
- 自動巡回の許可済みソースは未設定。地図API未契約、実求人の通勤計測は未実施。確認できたふりはしません。
- GitHubへpush済み。本人の承認を得て公開リポジトリに変更し、2026-11-01にGitHub Pagesへ公開しました。
- 公開URL: https://neolqte.github.io/miyajob/ （公開求人0件、実求人の検証中）

## 起動

Node.js 24以上、Python 3.11以上を用意します。

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e './collector[test]'
cd web
npm ci
npm run dev
```

表示URLは `http://127.0.0.1:5173/miyajob/`。Mac/Linuxでは `source .venv/bin/activate` を使用します。

この作業環境ではnpmがPATHにないため、ローカルに公式npmを取得しました。必要な場合はルートから `node .tools/package/bin/npm-cli.js --prefix web run dev` を使用できます。`.tools` はGit管理・公開対象外です。

## 画面

- 会社・職種・勤務地・業務のキーワード、職種、地域、計測済み通勤時間、給与・年収、休日・残業、働き方をAND検索。
- 基本給／手当込み月給、保証年収／試算年収を選んで比較。欠損値は「不明」で、ソート時は末尾。
- カード／表切替、最大4件の一時比較、根拠付き詳細、明暗テーマ、スマホ対応。
- 検索条件はURLに反映。メモ・応募管理・お気に入り・ログインは実装しません。
- 原典リンク、検証日、通勤の提供元・前提、スコアの情報充足率を確認可能。
- 30日超の未確認求人はブラウザー側でも非表示。更新日自体は表示します。

おすすめ順の重みは通勤45%、給与20%、休日・残業20%、転勤10%、在宅5%。確認済み部分で正規化し、充足率を別表示します。給与には基本給を使い、金額不明の賞与はスコアに推測で足しません。賞与額の定量スコアは未対応です。

## 非公開設定とデータ境界

```text
web/src/                         UI、Job型、公開JSON Schema、検索ロジック
web/public/jobs.json             唯一の公開求人データ
collector/src/collector/         収集・抽出・審査・エクスポート
config/profile.example.yaml     属性を持たない設定例
config/profile.yaml             実プロフィール（Git除外）
config/sources.yaml             許可・頻度設定（Git除外）
data/internal/candidates.jsonl  全候補・確認証拠（Git除外）
data/internal/review.jsonl      保留・理由（Git除外）
data/internal/rejected.jsonl    除外・理由（Git除外）
data/internal/leads.jsonl       企業・採用ページ探索候補（Git除外）
reports/private/YYYY-MM-DD.md   URL付き差分・品質レポート（Git除外）
```

添付の原仕様はローカル `SPEC.md` に保存しています。本人の経歴を含むためGit除外にしました。公開用の設計説明は本READMEと `docs/review-guide.md` です。Pagesへ渡すのは `web/dist` のみです。個人設定・内部記録・HTML全文・APIキーは含めません。原典の文章は短い根拠位置と独自要約に留めます。証拠の自由記述や通勤条件にも個人名・番地・本人の具体的な経歴を書かないでください。

## 収集と掲載審査

1. `config/profile.example.yaml` を `config/profile.yaml` にコピーし、確認済み属性のみ設定。分からないものは `null`。卒業年月は `YYYY-MM`、学歴は出典の要求に合わせた確認済み値を用います。
2. `config/sources.example.yaml` を参考に、利用条件・許可範囲・頻度をレビューしてソースを登録。既定の承認済みソースは空です。検索サービスや企業一覧から発見したURLはまず `leads.jsonl` に記録し、企業の存在だけを求人に変換しません。
3. JSON・CSVの手動インポート、または許可済みソースを取得。

```powershell
# ルート、venv有効状態で実行
python -m collector update --import data/internal/import.json
python -m collector update --import data/internal/import.csv
python -m collector update --network --sources config/sources.yaml
python -m collector validate
```

CSVの列は `company,title,address,url,description,kind`（`kind`: official/job_board/other）。JSONは同等の候補配列か、完全な `Job` 配列です。JSON-LD、CSSセレクター付きHTML、JSON、CSVに対応。自動抽出で `active` や `eligible` に昇格することはありません。新しい候補は必ず保留です。

外部取得は明示的な `--network` が必要です。許可されたHTTPS範囲、利用条件の確認日、robotsを確認し、ドメインごとに最低10秒、URLごとに既定7日間隔を守ります。認証・CAPTCHA・制限回避はしません。robots取得失敗やリダイレクトは保留扱いで取得を中止します。403やタイムアウト、抽出0件を募集終了とは扱いません。取得失敗が1つでもあれば公開ファイル全体をそのまま保持します。再確認間隔前の取得も前回データ保持です。

4. 非公開候補を手動確認し、根拠URL・短い位置情報・確認日・判定を記入。必須属性の照合ルールも設定して、修正した候補を再インポート。手順は [掲載審査ガイド](docs/review-guide.md)。
5. 判定器がプロフィールを照合し、eligible / review / rejectedを再計算。出典間の差異は保留。同一企業・職種・勤務地・採用区分だけを重複統合します。
6. eligible・現行募集・通勤検証済み・証拠一式ありの場合のみ、原子的に `jobs.json` を更新。レビュー・除外データは出力しません。実行入力がないときは失敗し、収集成功の表示をしません。

手動経路確認は `collector.routing.ManualRouteProvider` に対応。目的地、実測分数、提供元、確認日、時間帯・車利用などの前提を登録します。API連携用の `RouteProvider` インターフェースも用意しています。地域帯から分数を計算する実装はありません。確実な地域内勤務を人が確認した場合の `local_verified` では分数を `null` のままにし、分数フィルターから除外します。

## 検証

```powershell
python -m pytest collector -q
python scripts/schema.py --check
python -m collector validate
cd web
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

JSON SchemaはPythonの厳格モデルから生成。モデル変更時はルートで `python scripts/schema.py`。Web実行時もSchemaと掲載条件を再検証します。ビルド後に個人プロフィール、内部ファイル、秘密鍵の混入を点検します。

検証結果は [検証記録](docs/validation.md)。Windowsの制限付き環境ではNodeのrealpathや原子的ファイル置換が拒否される場合があり、この環境では許可を得て通常権限でテストしています。

## GitHub Pagesで無料公開

GitHub FreeでPagesを利用する場合は公開リポジトリが必要です。非公開のまま使う場合は対応プランを確認してください。リポジトリの公開範囲はこの作業では変更していません。[GitHub公式の提供条件](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)

1. このソースを対象リポジトリへpush。`SPEC.md`、実プロフィール、内部データが追跡されていないことを確認。
2. Settings → Pages → Build and deployment → Sourceを **GitHub Actions** に設定。
3. Actionsの **Quality checks** を通し、**Deploy verified web app** を手動実行。
4. Actionsが返したPages URLをPCとスマホで確認。想定base pathは `/miyajob/`。別名リポジトリなら `web/vite.config.ts` を変更。

デプロイ前に公開データの再監査、Python / Webテスト、ビルド内容検査を実行します。期限切れ・古い求人を含むデータでは公開処理が失敗するので、再検証か掲載取り下げを行ってください。ワークフロー定義の作成だけをデプロイ成功とは扱いません。

`Review job update` は手動起動のみ。Secretsの `MIYAJOB_PROFILE_JSON` と `MIYAJOB_SOURCES_YAML` が必要です。公開候補の `jobs.json` だけを7日間のartifactとして保存し、自動コミット・自動デプロイはしません。自動抽出だけでは証拠が揃わないため、初回から求人が自動公開されることはありません。保留候補の人手監査はローカルで行います。週次／月次scheduleは既定無効です。

## 残る作業

- 公開済み。公開データを更新した際は品質チェック後にPagesデプロイを手動実行。
- 保留5件の条件照会、近隣企業・許可済み媒体の探索範囲拡大、取得規約の個別確認。
- 配属先の確定と車通勤の実経路確認。本人の未知属性が必須の募集は追加確認。
- 実サイトごとの専用抽出ルールの調整。現在は汎用アダプタとサイト別CSS設定に対応。
- 地図APIアダプタ、賞与額の定量スコアは未実装。有料サービスを無断で契約しません。

技術参考：[ViteのPages設定](https://vite.dev/guide/static-deploy.html#github-pages)、[JobPostingの仕様](https://developers.google.com/search/docs/appearance/structured-data/job-posting)。
