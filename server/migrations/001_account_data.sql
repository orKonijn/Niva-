CREATE TABLE IF NOT EXISTS niva_account_state (
  user_id TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  data TEXT NOT NULL CHECK (json_valid(data) AND json_type(data, '$.saved') = 'array' AND json_type(data, '$.applications') = 'array'),
  imported_at TEXT,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS niva_operation_limits (
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  window INTEGER NOT NULL,
  count INTEGER NOT NULL CHECK (count >= 0),
  PRIMARY KEY (user_id, window)
);
