export const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS records (id INTEGER PRIMARY KEY AUTOINCREMENT, market_id TEXT NOT NULL DEFAULT 'cowboy-town', entity TEXT NOT NULL, owner_id TEXT, title TEXT NOT NULL, data TEXT NOT NULL DEFAULT '{}', status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE INDEX IF NOT EXISTS idx_records_market_entity ON records(market_id, entity)`,
  `CREATE INDEX IF NOT EXISTS idx_records_owner ON records(owner_id)`,
  `CREATE INDEX IF NOT EXISTS idx_records_status ON records(status) WHERE status != 'archived'`,
];

