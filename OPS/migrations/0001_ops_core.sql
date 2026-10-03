PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ops_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  capabilities_json TEXT NOT NULL DEFAULT '[]',
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_iterations INTEGER NOT NULL DEFAULT 210000,
  status TEXT NOT NULL DEFAULT 'active',
  must_change_password INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS ops_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  csrf_token TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  user_agent TEXT,
  ip_hash TEXT,
  FOREIGN KEY(user_id) REFERENCES ops_users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ops_sessions_user ON ops_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_ops_sessions_expires ON ops_sessions(expires_at);

CREATE TABLE IF NOT EXISTS ops_login_attempts (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  window_started_at TEXT NOT NULL,
  blocked_until TEXT
);

CREATE TABLE IF NOT EXISTS ops_audit_logs (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT,
  actor_email TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  ip_hash TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ops_audit_created ON ops_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ops_audit_actor ON ops_audit_logs(actor_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ops_incidents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  service_id TEXT,
  description TEXT,
  owner_user_id TEXT,
  started_at TEXT NOT NULL,
  resolved_at TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ops_incidents_status ON ops_incidents(status, created_at DESC);

CREATE TABLE IF NOT EXISTS ops_alerts (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  alert_key TEXT,
  severity TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  detail TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  acknowledged_by TEXT,
  acknowledged_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ops_alert_key ON ops_alerts(source, alert_key) WHERE alert_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS ops_kpi_snapshots (
  id TEXT PRIMARY KEY,
  captured_at TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ops_kpi_time ON ops_kpi_snapshots(captured_at DESC);

CREATE TABLE IF NOT EXISTS ops_identity_links (
  id TEXT PRIMARY KEY,
  canonical_key TEXT NOT NULL,
  source_system TEXT NOT NULL,
  source_id TEXT NOT NULL,
  email_normalized TEXT,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(source_system, source_id)
);
CREATE INDEX IF NOT EXISTS idx_ops_identity_key ON ops_identity_links(canonical_key);
CREATE INDEX IF NOT EXISTS idx_ops_identity_email ON ops_identity_links(email_normalized);

CREATE TABLE IF NOT EXISTS ops_automation_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  trigger_type TEXT NOT NULL,
  config_json TEXT NOT NULL DEFAULT '{}',
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ops_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_by TEXT,
  updated_at TEXT NOT NULL
);
