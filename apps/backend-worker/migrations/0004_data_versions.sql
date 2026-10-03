-- One version per user, changed by every write to their data, so a client can check whether its
-- cached responses are current with a single-row read (see docs/spec.md). WITHOUT ROWID: the
-- primary key is the table, so a write touches one b-tree, not a table plus its index.
CREATE TABLE data_versions (
  user_id TEXT PRIMARY KEY,
  version TEXT NOT NULL
) WITHOUT ROWID;
