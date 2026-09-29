-- Every table carries user_id: data is private to the user who registered it (see docs/spec.md).

CREATE TABLE users (
  id TEXT PRIMARY KEY, -- Google `sub`
  name TEXT NOT NULL,
  name_kana TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE companies (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  UNIQUE (user_id, name)
);

CREATE TABLE departments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  company_id TEXT NOT NULL REFERENCES companies (id),
  name TEXT NOT NULL,
  UNIQUE (company_id, name)
);

CREATE TABLE user_affiliations (
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  company_id TEXT NOT NULL REFERENCES companies (id),
  department_id TEXT REFERENCES departments (id)
);

CREATE TABLE topics (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('project', 'group')),
  name TEXT NOT NULL,
  UNIQUE (user_id, kind, name)
);

CREATE TABLE cards (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT,
  name_kana TEXT,
  name_romaji TEXT,
  company_id TEXT REFERENCES companies (id),
  titles TEXT NOT NULL, -- JSON string[]
  job_types TEXT NOT NULL, -- JSON string[]
  mobile TEXT,
  emails TEXT NOT NULL, -- JSON string[]
  other_contacts TEXT NOT NULL, -- JSON string[]
  url TEXT,
  offices TEXT NOT NULL, -- JSON {postalCode, address, tel, fax}[]
  met_on TEXT,
  met_at TEXT,
  met_occasion TEXT,
  handle_name TEXT,
  front_image_id TEXT,
  back_image_id TEXT,
  visibility TEXT NOT NULL CHECK (visibility IN ('private', 'company', 'department')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX cards_user_id ON cards (user_id);
CREATE INDEX cards_user_id_name ON cards (user_id, name);

CREATE TABLE card_departments (
  card_id TEXT NOT NULL REFERENCES cards (id) ON DELETE CASCADE,
  department_id TEXT NOT NULL REFERENCES departments (id),
  PRIMARY KEY (card_id, department_id)
);

CREATE TABLE card_topics (
  card_id TEXT NOT NULL REFERENCES cards (id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL REFERENCES topics (id),
  PRIMARY KEY (card_id, topic_id)
);
