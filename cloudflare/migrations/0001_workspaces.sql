-- Use a dedicated D1 binding; never overwrite or drop a pre-existing database.
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  revision INTEGER NOT NULL DEFAULT 0,
  payload TEXT NOT NULL
);
