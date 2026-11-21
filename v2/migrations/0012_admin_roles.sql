-- Slice 0 (admin foundation): account roles, the admin session layer (email + code,
-- 7-day), and the role-change audit trail. Additive only: every existing account keeps
-- working and takes the default 'visitor' role.
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'visitor' CHECK (role IN ('visitor', 'reviewer', 'admin'));

-- Admin sessions: the elevated layer over the visitor account. A separate table (and cookie)
-- from `sessions`, so a visitor session alone never grants admin access.
CREATE TABLE admin_sessions (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT
);
CREATE INDEX admin_sessions_user_idx ON admin_sessions(user_id);

-- Admin sign-in codes: the same shape and rules as the account verification codes
-- (one live code per user, SHA-256(salt:code) storage, limited attempts), in their own
-- table so admin sign-in can never consume or collide with a signup verification code.
CREATE TABLE admin_signin_codes (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  consumed_at TEXT,
  invalidated_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX admin_signin_codes_user_idx ON admin_signin_codes(user_id, created_at);

-- Append-only record of every account role change. user_id has no FK: the trail outlives
-- the account, like farm_owner_audit. The "never demote the last admin" guard is Slice C
-- UI logic; this layer records every change and prevents none.
CREATE TABLE role_audit (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  actor TEXT NOT NULL,
  from_role TEXT NOT NULL,
  to_role TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX role_audit_user_idx ON role_audit(user_id);
