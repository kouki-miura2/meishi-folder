# Frontend 実装計画

Claude Designで作成した画面デザインは以下。  
https://claude.ai/artifact/QRofMAZDkyMytHHhwciqRq

claude.aiのartifactはレスポンスが遅いため、docs/spec/配下に取得したローカルフォルダを参照すること。画面一覧とデザイントークンは [spec/README.md](spec/README.md)、画面定義は [spec/design-source.html](spec/design-source.html)、見た目の確認は [spec/design.html](spec/design.html)（ブラウザで開く）。以下の画面 ID（1a〜1m）はこのデザインの番号。

`apps/frontend`（Vue 3 + Vuetify 4 + vue-router + TanStack Query + Pinia）に [spec.md](spec.md) の画面を実装するための計画。state の置き場所とテストの書き方は `apps/frontend/AGENTS.md` と `add-view` スキルに従う。

## 残っている作業

1. **backend の再デプロイ**: `match` と件数の追加は、まだ本番の Worker に反映していない。
2. **フロントエンドのデプロイ**: 公開先を決め（F2. 未決事項）、Google の OAuth クライアントの「承認済みの JavaScript 生成元」に本番の URL を追加する。

**計画から変えたこと**

- 401 のときはトークンを取り直して再送するのではなく、サインアウトして `/login` に戻す（`redirect` で元の画面に戻る）。ログイン画面は GIS の自動ログイン（`auto_select`）を試すので、再ログインの手間はほぼない。
- 「要確認」の電話番号チェックは、文字の種類に加えて桁数も見る（050/070/080/090 は 11 桁、ほかは 10 桁）。
- 1h の「•••」メニューは「この名刺を削除」だけ。ログイン画面は 1a と同じトーンで作った（デザインにない）。
- ようこその氏名は、初回は Google アカウントの名前を初期値にする。

## F1. 前提・方針

### 画面とルート

スマホ（幅 390px）を基準にする。PC でも中央寄せで同じレイアウトを表示する。

| ルート                                | 画面                                                             | デザイン     |
| ------------------------------------- | ---------------------------------------------------------------- | ------------ |
| `/login`                              | Google ログイン                                                  | なし（新規） |
| `/welcome`                            | ようこそ（初回プロフィール）。所属の変更にも使う                 | 1a           |
| `/`                                   | 名刺一覧・検索。フィルタはボトムシート                           | 1b, 1c       |
| `/cards/new`                          | 名刺登録（撮影 → 抽出中 → 確認・訂正 → 同一人物の候補）の 1 画面 | 1d〜1g       |
| `/cards/:id`                          | 名刺詳細（参照）。写真タップで画像ビューワ（全画面ダイアログ）   | 1h, 1j       |
| `/cards/:id/edit`                     | 名刺詳細（変更・削除）                                           | 1i           |
| `/settings/companies`                 | 会社・団体設定。統合はボトムシート                               | 1k, 1l       |
| `/settings/companies/:id/departments` | 部署設定                                                         | 1m           |

- ナビゲーションガード: 未ログインなら `/login`。ログイン済みで `GET /me` が 404 なら `/welcome`。
- 設定画面への入口は、一覧（1b）右上のアバターから開くメニュー（プロフィール変更・会社・団体設定・ログアウト）にする（デザインに入口がないため）。
- 登録フロー（1d〜1g）はステップを 1 つのビューの中で切り替える。途中の状態（画像 ID・抽出結果・入力中の値）はルートをまたがないので、ビュー内の composable に持つ。

### 認証（Google Identity Services）

- `https://accounts.google.com/gsi/client` を読み込み、「Google でログイン」ボタンで ID トークンを受け取る。クライアント ID は `VITE_GOOGLE_CLIENT_ID`（backend の `GOOGLE_CLIENT_ID` と同じ値）。
- ID トークンと、その中の表示用の情報（メール・名前・アイコン）は Pinia の `auth` ストアに持つ（AGENTS.md の「auth info は Pinia」に当たる）。ページを再読み込みしたときは GIS の自動ログイン（`auto_select`）で取り直す。
- ID トークンは 1 時間で失効する。失効間近のトークンは送らず、API が 401 を返したらサインアウトして `/login` へ戻す（ログイン後に元の画面へ戻る）。
- 1a に「Google でログイン中 / メールアドレス」を表示する。

### API クライアント

- `src/api/client.ts` の `fetch` に `Authorization: Bearer <ID トークン>` を付ける。
- タイムアウトは既定 3 秒のまま、`POST /images` と `POST /cards/extract` だけ 60 秒にする（AI 推論は 5〜10 秒以上かかる）。
- 本番の接続先は `VITE_API_BASE_URL=https://meishi-folder.miu-soft.workers.dev`。`VITE_GOOGLE_CLIENT_ID` と `VITE_API_BASE_URL` はコミットせず、ローカルは `apps/frontend/.env.local`（gitignore 済み）、本番はビルド環境の変数で渡す。
- 名刺写真は `<img src>` に Authorization を付けられないため、`fetch` で取得して Object URL を作る composable（`useCardImageUrl`）を用意し、不要になったら `revokeObjectURL` する。

### テーマ・フォント

- Vuetify のテーマ（`src/plugins/vuetify.ts`）に [spec/README.md](spec/README.md) のデザイントークンを登録する（`background`・`surface`・`primary`＝墨、`project`＝赤、`group`＝青、`warning`＝黄 など）。色をコンポーネントに直書きしない。
- 本文のフォントは、デザインの Zen Kaku Gothic New ではなく従来どおり Noto Sans JP（`public/fonts/noto-sans-jp` に自前で配信、400・700）を使う。数字・英字（日付・件数など）はデザインどおり IBM Plex Mono（`@fontsource`）。
- ボトムシートは `v-bottom-sheet`、チップは `v-chip`（プロジェクト＝赤、グループ＝青）、セグメントは `v-btn-toggle` を使い、デザインの角丸・高さは Vuetify の defaults で揃える。

### state の置き場所

- サーバーのデータ: リソースごとの composable（`src/composables/useMe.ts`・`useMasters.ts`・`useCards.ts`）。更新系は成功後に `invalidateQueries` する（マスタの統合は名刺にも波及するため、マスタと名刺の更新はキャッシュ全体を更新する）。エラーは `src/plugins/query.ts` でまとめてスナックバーに出す。
- Pinia: `auth`（ID トークン・表示用ユーザー情報）と、既存の `notification`（エラー表示のスナックバー）だけ。
- 画面内の状態（フォーム、登録フローのステップ、フィルタの選択、統合で選択中のマスタ）はビューか composable の `ref` に持つ。一覧のフィルタ条件だけはクエリ文字列（`?q=&topicIds=&match=`）に載せ、詳細から戻っても保たれるようにする。

### DOM に依存しないロジック（Node でテストする）

テストは Node で動かす規約なので、画面のロジックは純粋な関数に切り出してテストする。

- 五十音インデックスの見出し（1b）: 氏名カナ → ハンドルネーム → 氏名の先頭文字から「ア・カ・サ…ワ・A・#」を決める。
- 「要確認」の判定（1f）: AI は確信度を返さないため、形式チェックで代わりにする（カナがカタカナでない、電話番号・メール・URL・郵便番号の形式が不正、氏名が空、など）。
- 「既存マスタ / 新規作成」の表示（1f）: 抽出した会社名・所属名を `GET /companies`・`GET /companies/:id/departments` の名称と、前後の空白を除いた完全一致で比べる（backend の find-or-create と同じ規則）。
- 表記ゆれの候補（1m の「表記ゆれ?」「似た名称の部署が 2 件あります」）: 空白・記号・全角半角・「株式会社」と「(株)」などを正規化して一致するものをまとめる。
- 名刺の入力値と API の入力（`CardInput`）の相互変換、「氏名・氏名カナ・ハンドルネームのいずれか 1 つは必須」の検証。

## F2. 未決事項

- **フロントエンドの公開先**: Cloudflare Workers の静的アセット（backend と同じ Worker に載せるか、別の Worker にするか）など。同じオリジンにすれば CORS 設定が不要になる。

# Backend 実装計画

[spec.md](spec.md) の機能を `apps/backend`（Hono、ランタイム非依存）と `apps/backend-worker`（Cloudflare Workers）に実装するための計画。
層構造（route → service → repository → DAO）とテストの置き方は `apps/backend/AGENTS.md` と `add-api-endpoint` スキルに従う。

## 1. 前提・方針

### データストア（Cloudflare）

| 用途                   | サービス                                               | 置き場所                                                   |
| ---------------------- | ------------------------------------------------------ | ---------------------------------------------------------- |
| ユーザー・名刺・マスタ | D1                                                     | `apps/backend-worker/src/dao/*.d1.ts`                      |
| 名刺写真               | R2                                                     | `apps/backend-worker/src/dao/card-image.r2.ts`             |
| 名刺記載項目の抽出     | Workers AI（`@cf/meta/llama-3.2-11b-vision-instruct`） | `apps/backend-worker/src/dao/card-extractor.workers-ai.ts` |

- `apps/backend` 側にはインターフェース（`src/dao/*.interface.ts`）とインメモリ実装（`*.memory.ts`）だけを置く。
- Workers AI も DAO と同じく「インターフェース＋差し替え可能な実装」にする。プロンプトと応答のパースは repository（`card-extractor.repository.ts`）が持ち、Worker の DAO はモデルを呼ぶだけ。
- D1 の DAO は `getPlatformProxy` を使い、ローカルの D1 / R2 に対してテストする（`apps/backend-worker/src/dao/test-env.ts`）。

### 認証（Google ログイン）

- フロントエンドは Google Identity Services で ID トークン（JWT）を取得し、`Authorization: Bearer <token>` で送る。
- backend の `src/repository/auth-guard.google.ts` が Google の JWKS で署名を検証し、`iss`・`aud`（OAuth クライアント ID）・`exp` を確認する。`AuthenticatedUser.id` は Google の `sub`。
- OAuth クライアント ID は secret の `GOOGLE_CLIENT_ID` で渡す（ローカルは `.dev.vars`、本番は `wrangler secret put`）。公開リポジトリにはコミットしない。
- 除外パスは設けない。データを扱うルートは、ガードが無効でもユーザーがいなければ 401 にする。
- 独自セッションは作らない。ID トークンは 1 時間で失効するので、フロントエンド側で再取得する。

### アクセス権

- 当初は全データを所有者（`user_id`）で絞り込む。**全 DAO メソッドが `userId` を引数に取り**、他ユーザーのデータは「存在しない」（404）として扱う。
- 公開範囲（`visibility`）は保存・更新のみ行い、参照制御にはまだ使わない（将来の相互認証で使う）。

### マスタの扱い

- 会社・団体、部署、関連プロジェクト、関連グループはすべてユーザーごとのマスタ。
- 名刺の登録・更新時は**名称で受け取り**、service が「一致するマスタがあれば参照、無ければ作成」（find-or-create、`master-resolver.ts`）する。一致判定は前後の空白を除いた完全一致。表記ゆれは統合（名寄せ）で解消する。
- 関連プロジェクトと関連グループは同じ構造なので、`topics` テーブル（`kind: 'project' | 'group'`）1 つで扱う。

### 入力バリデーション

- route では `@hono/zod-validator` で**型・形の検証**を行う（RPC の型推論も効く）。
- 「氏名・氏名カナ・ハンドルネームのいずれか 1 つは必須」などの**業務ルールは service** で検証する。service は `ServiceError`（`not_found` / `conflict` / `invalid`）を投げ、route がそれぞれ 404 / 409 / 400 に変換する。

## 2. データモデル（D1）

```text
users             id(=Google sub) PK, name, name_kana, created_at, updated_at
user_affiliations user_id, company_id, department_id(NULL可)
companies         id PK, user_id, name              UNIQUE(user_id, name)
departments       id PK, user_id, company_id, name  UNIQUE(company_id, name)
topics            id PK, user_id, kind, name        UNIQUE(user_id, kind, name)
cards             id PK, user_id,
                  name, name_kana, name_romaji, company_id(NULL可),
                  titles JSON, job_types JSON, mobile, emails JSON, other_contacts JSON, url,
                  offices JSON  -- [{postalCode, address, tel, fax}]
                  met_on, met_at, met_occasion, handle_name,
                  front_image_id, back_image_id, visibility('private'|'company'|'department'),
                  created_at, updated_at
card_departments  card_id, department_id            -- 所属(0..N)
card_topics       card_id, topic_id                 -- 関連プロジェクト・グループ(0..N)
```

- マスタを参照しない複数値の文字列（役職、職種、メール、その他連絡、事業所）は、テーブルを増やさず JSON 列にする。
- 名刺写真は R2 にキー `<userId>/<imageId>` で置く。所有者の判定はキーで、Content-Type は R2 のメタデータで持つので、テーブルは作らない。
- テキスト絞り込み（全項目）は `LIKE` で実装している。個人の名刺件数なら十分。遅くなったら FTS5 を検討する。
- マイグレーションは `apps/backend-worker/migrations/` に置き、`wrangler d1 migrations apply` で適用する。

## 3. エンドポイント一覧

すべて認証必須。`:id` は所有者が本人でなければ 404。

### ユーザー（ようこそ画面）

| メソッド | パス  | 内容                                                                                                             |
| -------- | ----- | ---------------------------------------------------------------------------------------------------------------- |
| GET      | `/me` | 自分のプロフィール。未登録なら 404 → フロントエンドはようこそ画面へ                                              |
| PUT      | `/me` | プロフィールの登録・更新（氏名、氏名カナ、所属 `[{companyName, departmentName?}]`）。会社・部署は find-or-create |

### 会社・団体（会社・団体設定画面）

| メソッド | パス                   | 内容                                                                    |
| -------- | ---------------------- | ----------------------------------------------------------------------- |
| GET      | `/companies`           | 一覧（名称順）。名刺の枚数 `cardCount`・部署の数 `departmentCount` 付き |
| POST     | `/companies`           | 追加。同名があれば 409                                                  |
| PATCH    | `/companies/:id`       | 名称変更。同名があれば 409                                              |
| DELETE   | `/companies/:id`       | 削除。名刺・ユーザー所属から参照中なら 409（統合を促す）                |
| POST     | `/companies/:id/merge` | `{ sourceIds: string[] }` を `:id` に統合（下記）                       |

### 部署（部署設定画面）

| メソッド | パス                                | 内容                                                                  |
| -------- | ----------------------------------- | --------------------------------------------------------------------- |
| GET      | `/companies/:companyId/departments` | 会社・団体配下の部署一覧。名刺の枚数 `cardCount` 付き                 |
| POST     | `/companies/:companyId/departments` | 追加。同じ会社内に同名があれば 409                                    |
| PATCH    | `/departments/:id`                  | 名称変更。同名があれば 409                                            |
| DELETE   | `/departments/:id`                  | 削除。参照中なら 409                                                  |
| POST     | `/departments/:id/merge`            | `{ sourceIds: string[] }` を `:id` に統合。同じ会社・団体の部署に限る |

**統合の処理**（1 トランザクション、D1 の `batch` で実行）

- 会社・団体: 統合元を参照する名刺・ユーザー所属・部署を統合先に付け替え、統合元を削除する。付け替えた部署が統合先に同名で存在する場合は、その部署同士も統合する。
- 部署: 統合元を参照する名刺の所属・ユーザー所属を統合先に付け替え（重複行は除く）、統合元を削除する。

### 関連プロジェクト・関連グループ

| メソッド | パス                          | 内容                                   |
| -------- | ----------------------------- | -------------------------------------- |
| GET      | `/topics?kind=project\|group` | 一覧（候補表示・フィルタダイアログ用） |

- 作成は名刺の登録・更新時の find-or-create で行う（GitHub のトピックと同じく、入力すれば作られる）。
- 名称変更・削除・統合は、spec に設定画面がないため作っていない。

### 名刺写真

| メソッド | パス          | 内容                                                                                      |
| -------- | ------------- | ----------------------------------------------------------------------------------------- |
| POST     | `/images`     | 画像（multipart の `file`）をアップロードし、`{ id }` を返す。JPEG / PNG / WebP、5MB まで |
| GET      | `/images/:id` | 画像本体を返す                                                                            |

- 登録フローで AI 抽出と保存の両方に同じ画像が必要なので、先にアップロードして ID で参照する。画像を 2 回送らずに済む。
- `<img src>` では `Authorization` ヘッダーを送れないため、フロントエンドは `fetch` で取得して Object URL にして表示する。
- どの名刺にも紐付かなかった画像（抽出だけして保存しなかったもの）は、将来 Cron Trigger で一定時間後に削除する（未実装）。

### 名刺

| メソッド | パス                         | 内容                                                                                                                                                                           |
| -------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| POST     | `/cards/extract`             | `{ frontImageId, backImageId? }` から名刺記載項目を抽出して返す（保存はしない）                                                                                                |
| GET      | `/cards/candidates?name=`    | 氏名が一致する（空白は無視）登録済み名刺（同一人物の候補）                                                                                                                     |
| GET      | `/cards?q=&topicIds=&match=` | 一覧。`q` は全項目のテキスト絞り込み、`topicIds` はカンマ区切りで、`match=all`（既定）ならすべて、`any` ならいずれかを持つ名刺に絞る。並び順は氏名カナ → ハンドルネーム → 氏名 |
| GET      | `/cards/:id`                 | 詳細（全項目＋画像 ID）                                                                                                                                                        |
| POST     | `/cards`                     | 登録。会社・所属・トピックは名称で受け取り find-or-create。公開範囲は「個人」で作成                                                                                            |
| PATCH    | `/cards/:id`                 | 更新（渡された項目だけ。`null` で消去）。同一人物の上書きもこれを使い、名刺写真と名刺記載項目だけを送る（場面・補足事項は既存の値のまま）                                      |
| DELETE   | `/cards/:id`                 | 削除（画像も R2 から削除）                                                                                                                                                     |

- **登録フローとの対応**: 撮影／画像選択 → `POST /images` → `POST /cards/extract` → 確認・訂正 → `GET /cards/candidates` → 上書きなら `PATCH /cards/:id`、新規なら `POST /cards`。
- 一覧のレスポンスは表示に必要な項目（会社・団体名、所属、氏名・氏名カナ・ハンドルネーム、トピック）だけに絞る。
- 上書きで差し替えられた旧画像は削除する。

## 4. 未決事項

- **使われなくなったトピック**: どの名刺からも参照されなくなった関連プロジェクト・グループを自動削除するか、残して設定画面を作るか。
