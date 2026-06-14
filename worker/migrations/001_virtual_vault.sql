CREATE TABLE IF NOT EXISTS virtual_balances (
  user_address TEXT PRIMARY KEY,
  virtual_hnobt TEXT NOT NULL DEFAULT '0',
  btr_claimable TEXT NOT NULL DEFAULT '0',
  staking_active INTEGER NOT NULL DEFAULT 0,
  staking_tier INTEGER NOT NULL DEFAULT 0,
  last_yield_time TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settlement_nonces (
  user_address TEXT PRIMARY KEY,
  nonce INTEGER NOT NULL DEFAULT 0,
  last_settlement_time TEXT
);
