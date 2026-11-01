# MiyaJob

IT系に絞り、応募条件・勤務地・通勤・募集継続を確認した求人と、理由付きの確認待ち候補を分けて検索する個人向けの静的Webアプリです。React / TypeScript / Vite / Tailwind CSSと、独立したPython収集・掲載審査パイプラインで構成します。DB・有料AI API・会員登録は不要です。

## 現在の状態

- Webアプリと掲載判定基盤、収集アダプタ、CI・Pagesデプロイ定義を実装済み。
- 対象職種は **IT系必須**。応募可能・確認済み **6件**、保留・確認待ち **23件**、未審査・新規候補 **89件**、合計 **118件** を閲覧できます。保留・未審査は応募可能な求人として数えません。
- 2026-11-02の拡充調査で新規103求人候補を登録（既存・紹介元と公式の重複を除外）。新たな確認済みは2件。全103件の待遇・応募可否が確認済みという意味ではありません。集計と残作業は [調査結果](docs/research-2026-11-02.md) を参照。
- **給与・勤務地・雇用形態・休日・勤務時間の5項目の確認を掲載必須条件に追加**。確認済み・保留には引き続き適用します。新設した「未審査・新規候補」は企業・募集ページ・IT職・対象地域・出典を確認した段階で表示し、残る条件は未確認と明示します。
- 給与は金額と支給単位、勤務地は具体的な就業先、雇用形態は正社員区分、休日は休みのパターン、勤務時間は時間帯または標準労働時間の根拠を確認します。「応相談」、検索表示のみ、会社所在地しか不明な条件を確認済みの事実として扱いません。企業トップだけ・企業名非公開・個別募集を特定できない候補は通常一覧から外します。給与額や休日数の好条件を必須にするものではありません。
- 保留カードにも給与・勤務地など6項目を表示。給与は月給を優先し、年収・年俸しかない場合は「月給不明」と年額÷12の参考月額を併記します。参考月額は賞与等を含むことがあり、実際の月給・手取りではありません。モデル年収は換算せず、不明な条件は不明のまま残します。
- 非IT求人は現在の対象から外しました。ジリオン浜松は浜松または東京の配属が未確定のため確認待ちへ移行。候補一覧の確認を厳密な応募資格審査と同一には扱いません。
- 自動巡回の許可済みソースは未設定、地図API契約なし。Google マップを手動で開き、公共の参考地点・宮口駅からの平日朝の経路予測を確認しました。本人の自宅発の実走計測ではありません。
- GitHubへpush済み。本人の承認を得て公開リポジトリに変更し、2026-11-01にGitHub Pagesへ公開しました。
- 公開URL: https://neolqte.github.io/miyajob/ （確認済み6件／保留23件／未審査89件）

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
- 保留・未審査・すべての候補タブではキーワード、勤務地、IT職種、確認状態、調査段階、理由をAND検索。月給・休日・通勤の並び替えは未確認値を末尾にします。年収の月額換算は候補の月給ソートに使いません。確認済み一覧の比較・おすすめ機能は維持しています。
- 30日超の確認記録は警告付きで表示。募集終了・締切超過・必須根拠の有効期限切れは非表示にします。

おすすめ順の重みは通勤45%、給与20%、休日・残業20%、転勤10%、在宅5%。確認済み部分で正規化し、充足率を別表示します。給与には基本給を使い、金額不明の賞与はスコアに推測で足しません。賞与額の定量スコアは未対応です。

## 非公開設定とデータ境界

```text
web/src/                         UI、Job型、公開JSON Schema、検索ロジック
web/public/jobs.json             応募可能・確認済みのIT求人
web/public/review-jobs.json      公開用に編集したIT確認待ち候補・理由
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
python -m collector report
```

CSVの列は `company,title,address,url,description,kind`（`kind`: official/job_board/other）。JSONは同等の候補配列か、完全な `Job` 配列です。JSON-LD、CSSセレクター付きHTML、JSON、CSVに対応。自動抽出で `active` や `eligible` に昇格することはありません。新しい候補は必ず保留です。

外部取得は明示的な `--network` が必要です。許可されたHTTPS範囲、利用条件の確認日、robotsを確認し、ドメインごとに最低10秒、URLごとに既定7日間隔を守ります。認証・CAPTCHA・制限回避はしません。robots取得失敗やリダイレクトは保留扱いで取得を中止します。403やタイムアウト、抽出0件を募集終了とは扱いません。取得失敗が1つでもあれば公開ファイル全体をそのまま保持します。再確認間隔前の取得も前回データ保持です。

4. 非公開候補を手動確認し、根拠URL・短い位置情報・確認日・判定を記入。必須属性の照合ルールも設定して、修正した候補を再インポート。手順は [掲載審査ガイド](docs/review-guide.md)。
5. 判定器がプロフィールを照合し、eligible / review / rejectedを再計算。出典間の差異は保留。同一企業・職種・勤務地・採用区分だけを重複統合します。
6. eligible・現行募集・通勤検証済み・証拠一式ありの場合のみ、原子的に `jobs.json` を更新。内部レビュー記録・プロフィールは出力しません。別の確認待ちファイルには、明示的に編集した公開用の候補要約だけを出力します。実行入力がないときは失敗し、収集成功の表示をしません。

手動経路確認は `collector.routing.ManualRouteProvider` に対応。目的地、実測分数、提供元、確認日、時間帯・車利用などの前提を登録します。API連携用の `RouteProvider` インターフェースも用意しています。地域帯から分数を計算する実装はありません。確実な地域内勤務を人が確認した場合の `local_verified` では分数を `null` のままにし、分数フィルターから除外します。

現在掲載中の通勤はGoogle マップの通常交通予測です。公共の参考地点・宮口駅から勤務地まで、2026-11-02(月)8:30到着（テガラは9:00）等の経路を2026-11-01に確認。予測範囲の上限を使い、距離・経由道路・日時を詳細に記録しています。交替制は朝の参考経路であり全シフトの実走保証ではありません。自宅位置や本人の詳細住所は保存・公開していません。

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

デプロイ前に公開データの再監査、Python / Webテスト、ビルド内容検査を実行します。募集期限・根拠の有効期限が切れた求人は再検証か掲載取り下げが必要です。経過30日だけなら確認記録を保持して警告します。ワークフロー定義の作成だけをデプロイ成功とは扱いません。

`Review job update` は手動起動のみ。Secretsの `MIYAJOB_PROFILE_JSON` と `MIYAJOB_SOURCES_YAML` が必要です。公開候補の `jobs.json` だけを7日間のartifactとして保存し、自動コミット・自動デプロイはしません。自動抽出だけでは証拠が揃わないため、初回から求人が自動公開されることはありません。保留候補の人手監査はローカルで行います。週次／月次scheduleは既定無効です。

## 残る作業

- 公開済み。公開データを更新した際は品質チェック後にPagesデプロイを手動実行。
- IT確認待ち候補の必須資格・実勤務地・通勤・募集継続を追加確認。取得規約の個別確認も必要です。
- 保留候補の配属先・通勤・募集継続の確認。本人の未知属性が必須の募集は追加確認。
- 実サイトごとの専用抽出ルールの調整。現在は汎用アダプタとサイト別CSS設定に対応。
- 地図APIアダプタ、賞与額の定量スコアは未実装。有料サービスを無断で契約しません。

技術参考：[ViteのPages設定](https://vite.dev/guide/static-deploy.html#github-pages)、[JobPostingの仕様](https://developers.google.com/search/docs/appearance/structured-data/job-posting)。

## 確認待ち候補の安全な公開

`data/internal/public-review.json` に `ReviewCandidate` 形式の公開用要約を明示的に作成してから、通常の `update` を実行します。内部の自由記述 `evidence.notes` をコピーしません。氏名・年齢・卒業年月・就業歴などの本人属性は理由に書かず、「当該枠の既卒条件を確認」「実務経験条件の適用確認」など求人側の未確認事項を記載します。

候補ID・会社・職種・IT分類・原典URLを内部台帳と突合し、reviewの候補と、応募条件の審査を通っても5項目が不足する候補を別JSONへ出力。後者は未審査区分に限定し、確認済みとの重複を防ぎます。非IT・除外・募集終了・募集期限切れ・応募可能枠との重複は出しません。既知の対象外勤務地や必須実務経験の不適合候補も公開用要約へ追加しません。発見段階でも具体的な企業・募集職種・原典が必要で、会社だけのリンクや検索ヒット件数を求人として増やしません。

`review-jobs.json` は応募適合性の保証を持ちません。原典・情報確認日・公開向けの保留理由を保持し、`detail_review`（調査済み・追加確認待ち）と `discovery`（発見・詳細未確認）を分けます。実際に閲覧した検索・一覧の情報と原典本文の確認を混同しません。新規求人の確認を簡略化する場合も、応募可能に自動昇格させずこちらで閲覧します。

## 保留カードの募集条件

保留一覧も給与・募集上の勤務地・雇用形態・勤務時間・休日・車通勤を6項目で表示します。47候補に191項目を補足し、給与の数値が分かるものは37件です。原典本文で確認した値と検索表示・旧求人の値は注記で区別し、未知は「不明・未確認」。月給と年俸、基本給と手当込み、学歴別初任給、過去年の休日実績、モデル年収を混同しません。

公開用 `facts` は `field, text, url, checked_at, confirmed` のみ。`confirmed: true` の項目だけを事実として表示します。根拠URLを内部候補の出典へ登録してから出力し、未来日・同項目の重複・未登録出典を拒否します。カードの各項目に根拠リンクを表示。給与等の確認が進んでも、応募資格・勤務地・募集継続・通勤の根拠が揃うまでは保留です。古い条件が残る場合も鮮度警告を出します。

## 未審査・新規候補（2026-11-02）

`status: discovery` / `stage: discovery` / `discovery_verified: true` と対象の `regions` を公開用要約へ明示します。これは企業・実在する募集・IT職・勤務地の地域・出典を人手で照合した印であり、応募資格・正社員・車45分以内を保証しません。給与等の不足は表示を止めず「不明・未確認」と表示します。レビュー待ちに応募可能フラグを付けません。確認済みの厳密な審査は変更していません。

全311候補の4分類・非表示理由・URL・確認日は `reports/private/discovery-classification-2026-11-02.json` に保存しました。内部台帳はGit管理対象外です。既存候補の重複は今回0件で、前回統合済みの紹介求人・公式ページを再計上していません。集計は [候補整理結果](docs/discovery-browse-2026-11-02.md) を参照してください。
