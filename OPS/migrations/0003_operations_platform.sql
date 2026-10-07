-- Nền tảng điều hành nội bộ Sky First
CREATE TABLE IF NOT EXISTS ops_work_items (
 id TEXT PRIMARY KEY, kind TEXT NOT NULL, code TEXT, title TEXT NOT NULL, description TEXT,
 status TEXT NOT NULL DEFAULT 'draft', priority TEXT NOT NULL DEFAULT 'medium', owner_user_id TEXT, owner_name TEXT,
 unit_name TEXT, parent_id TEXT, starts_at TEXT, due_at TEXT, progress INTEGER NOT NULL DEFAULT 0, amount REAL, location TEXT,
 created_by TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 FOREIGN KEY(owner_user_id) REFERENCES ops_users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_ops_work_kind_status ON ops_work_items(kind,status,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ops_work_owner ON ops_work_items(owner_user_id,due_at);
CREATE INDEX IF NOT EXISTS idx_ops_work_due ON ops_work_items(due_at,status);
CREATE TABLE IF NOT EXISTS ops_work_notes (
 id TEXT PRIMARY KEY, work_item_id TEXT NOT NULL, author_user_id TEXT, body TEXT NOT NULL, created_at TEXT NOT NULL,
 FOREIGN KEY(work_item_id) REFERENCES ops_work_items(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ops_work_notes_item ON ops_work_notes(work_item_id,created_at DESC);
