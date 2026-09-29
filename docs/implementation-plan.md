# Backend 実装計画

[spec.md](spec.md) の機能を `apps/backend`（Hono、ランタイム非依存）と `apps/backend-worker`（Cloudflare Workers）に実装するための計画。
層構造（route → service → repository → DAO）とテストの置き方は `apps/backend/AGENTS.md` と `add-api-endpoint` スキルに従う。

## 残っている作業

3 章のエンドポイントはすべて実装済み。Worker への配線、Google クライアント ID の設定（`.dev.vars` と本番の secret）、Llama 3.2 Vision のライセンス同意も済んでいる。https://meishi-folder.miu-soft.workers.dev にデプロイ済みで、リモートの D1 にもマイグレーションを適用済み。

1. **登録フローの通し確認**: 本物の Google ID トークンを使い、`wrangler dev` で「撮影 → 抽出 → 確認・訂正 → 保存」を通す。フロントエンドのログインができてから行う。
2. **サンプルの削除**: `sample.*` と `GET /sample/:id`。フロントエンドの `HomeView` / `useSampleQuery` がこの API を使っており、frontend の AGENTS.md と add-view スキルがこれらを見本として参照している。そのため、フロントエンドの実画面ができてからまとめて削除する。

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

| メソッド | パス                   | 内容                                                     |
| -------- | ---------------------- | -------------------------------------------------------- |
| GET      | `/companies`           | 一覧（名称順）                                           |
| POST     | `/companies`           | 追加。同名があれば 409                                   |
| PATCH    | `/companies/:id`       | 名称変更。同名があれば 409                               |
| DELETE   | `/companies/:id`       | 削除。名刺・ユーザー所属から参照中なら 409（統合を促す） |
| POST     | `/companies/:id/merge` | `{ sourceIds: string[] }` を `:id` に統合（下記）        |

### 部署（部署設定画面）

| メソッド | パス                                | 内容                                                                  |
| -------- | ----------------------------------- | --------------------------------------------------------------------- |
| GET      | `/companies/:companyId/departments` | 会社・団体配下の部署一覧                                              |
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

| メソッド | パス                      | 内容                                                                                                                                      |
| -------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| POST     | `/cards/extract`          | `{ frontImageId, backImageId? }` から名刺記載項目を抽出して返す（保存はしない）                                                           |
| GET      | `/cards/candidates?name=` | 氏名が一致する（空白は無視）登録済み名刺（同一人物の候補）                                                                                |
| GET      | `/cards?q=&topicIds=`     | 一覧。`q` は全項目のテキスト絞り込み、`topicIds` はカンマ区切りで、すべてを持つ名刺に絞る。並び順は氏名カナ → ハンドルネーム → 氏名       |
| GET      | `/cards/:id`              | 詳細（全項目＋画像 ID）                                                                                                                   |
| POST     | `/cards`                  | 登録。会社・所属・トピックは名称で受け取り find-or-create。公開範囲は「個人」で作成                                                       |
| PATCH    | `/cards/:id`              | 更新（渡された項目だけ。`null` で消去）。同一人物の上書きもこれを使い、名刺写真と名刺記載項目だけを送る（場面・補足事項は既存の値のまま） |
| DELETE   | `/cards/:id`              | 削除（画像も R2 から削除）                                                                                                                |

- **登録フローとの対応**: 撮影／画像選択 → `POST /images` → `POST /cards/extract` → 確認・訂正 → `GET /cards/candidates` → 上書きなら `PATCH /cards/:id`、新規なら `POST /cards`。
- 一覧のレスポンスは表示に必要な項目（会社・団体名、所属、氏名・氏名カナ・ハンドルネーム、トピック）だけに絞る。
- 上書きで差し替えられた旧画像は削除する。

## 4. フロントエンドへの影響（メモ）

- `apps/frontend/src/api/client.ts` のタイムアウトが 3 秒のため、`POST /cards/extract`（AI 推論）と `POST /images` では足りない。これらだけタイムアウトを延ばす必要がある。
- 画像はアップロード前にクライアント側で縮小すると、転送時間と AI の推論時間の両方が短くなる（上限は 5MB）。

## 5. 未決事項

- **使われなくなったトピック**: どの名刺からも参照されなくなった関連プロジェクト・グループを自動削除するか、残して設定画面を作るか。
