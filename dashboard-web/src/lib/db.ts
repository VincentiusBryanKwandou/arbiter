import { neon } from "@neondatabase/serverless";

// Re-use connection across invocations within the same Lambda/Edge warm instance
let _sql: ReturnType<typeof neon> | null = null;

export function getDb() {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    _sql = neon(url);
  }
  return _sql;
}

// ── Schema init — call once on first deploy ───────────────────────────────────
export async function initSchema() {
  const sql = getDb();

  // Users table — must exist before tables with user_id FK
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      username      VARCHAR(50)   NOT NULL UNIQUE,
      password_hash TEXT          NOT NULL,
      email         VARCHAR(255),
      created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_users_username ON users(LOWER(username))`;

  // Seed default admin account (pre-computed bcrypt hash, rounds=10)
  await sql`
    INSERT INTO users (id, username, password_hash)
    VALUES (1, 'nayrbryanGaming', '$2b$10$kJt1Ry9Wc3jcfJsV0kN8F.ecQd0sxZ.uyAFefY7rJ92XZ.3KeNEby')
    ON CONFLICT (username) DO NOTHING
  `;
  // Advance SERIAL sequence past the explicitly-seeded id=1 so the first registration succeeds
  await sql`SELECT setval('users_id_seq', (SELECT MAX(id) FROM users))`;
  await sql`
    CREATE TABLE IF NOT EXISTS bot_stats (
      id              SERIAL PRIMARY KEY,
      mode            VARCHAR(10)    NOT NULL DEFAULT 'paper',
      bankroll_usd    NUMERIC(12,2)  NOT NULL DEFAULT 1000.00,
      realized_pnl_today  NUMERIC(12,2) NOT NULL DEFAULT 0,
      realized_pnl_total  NUMERIC(12,2) NOT NULL DEFAULT 0,
      win_rate            NUMERIC(6,4)  NOT NULL DEFAULT 0,
      avg_edge_pct        NUMERIC(6,4)  NOT NULL DEFAULT 0,
      kill_switch_active  BOOLEAN       NOT NULL DEFAULT false,
      daily_loss_pct      NUMERIC(6,4)  NOT NULL DEFAULT 0,
      open_positions      INTEGER       NOT NULL DEFAULT 0,
      max_open_positions  INTEGER       NOT NULL DEFAULT 5,
      trades_today        INTEGER       NOT NULL DEFAULT 0,
      opportunities_found_today INTEGER NOT NULL DEFAULT 0,
      last_scan_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
      uptime_hours    NUMERIC(10,2)  NOT NULL DEFAULT 0,
      started_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
      consecutive_api_failures INTEGER NOT NULL DEFAULT 0
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS trades (
      id            VARCHAR(80)   PRIMARY KEY,
      timestamp     TIMESTAMPTZ   NOT NULL,
      market_id     VARCHAR(255)  NOT NULL,
      description   TEXT          NOT NULL DEFAULT '',
      strategy      VARCHAR(100)  NOT NULL DEFAULT '',
      venue         VARCHAR(100)  NOT NULL DEFAULT '',
      sets          NUMERIC(12,4) NOT NULL DEFAULT 0,
      notional_usd  NUMERIC(12,2) NOT NULL DEFAULT 0,
      locked_profit NUMERIC(12,2) NOT NULL DEFAULT 0,
      fill_pct      NUMERIC(6,4)  NOT NULL DEFAULT 1,
      note          TEXT          NOT NULL DEFAULT '',
      mode          VARCHAR(10)   NOT NULL DEFAULT 'paper',
      edge_pct      NUMERIC(6,4)  NOT NULL DEFAULT 0
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS equity_history (
      id          SERIAL        PRIMARY KEY,
      date        DATE          NOT NULL,
      equity      NUMERIC(12,2) NOT NULL,
      pnl         NUMERIC(12,2) NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      UNIQUE(date)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS opportunities (
      id          SERIAL        PRIMARY KEY,
      market_id   VARCHAR(255)  NOT NULL,
      question    TEXT          NOT NULL,
      edge_pct    NUMERIC(6,4)  NOT NULL,
      implied_prob_yes NUMERIC(6,4),
      implied_prob_no  NUMERIC(6,4),
      depth_usd   NUMERIC(12,2),
      strategy    VARCHAR(100),
      venue       VARCHAR(100),
      detected_at TIMESTAMPTZ   NOT NULL,
      is_active   BOOLEAN       NOT NULL DEFAULT true,
      UNIQUE(market_id, detected_at)
    )
  `;
  // Add user_id to existing tables (idempotent — safe to re-run)
  await sql`ALTER TABLE bot_stats      ADD COLUMN IF NOT EXISTS user_id INT NOT NULL DEFAULT 1`;
  await sql`ALTER TABLE trades         ADD COLUMN IF NOT EXISTS user_id INT NOT NULL DEFAULT 1`;
  await sql`ALTER TABLE equity_history ADD COLUMN IF NOT EXISTS user_id INT NOT NULL DEFAULT 1`;
  await sql`ALTER TABLE opportunities  ADD COLUMN IF NOT EXISTS user_id INT NOT NULL DEFAULT 1`;
  // Unique index on bot_stats.user_id enables per-user upsert without the serial id
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_bot_stats_user_id ON bot_stats(user_id)`;
  // Seed nayrbryanGaming's initial bot_stats row (user_id=1)
  await sql`
    INSERT INTO bot_stats (user_id) VALUES (1)
    ON CONFLICT (user_id) DO NOTHING
  `;

  // Immutable audit trail — append-only, indexed on created_at for time-range queries
  await sql`
    CREATE TABLE IF NOT EXISTS audit_log (
      id          BIGSERIAL     PRIMARY KEY,
      request_id  VARCHAR(40)   NOT NULL,
      endpoint    VARCHAR(200)  NOT NULL,
      method      VARCHAR(10)   NOT NULL,
      ip_hash     VARCHAR(16)   NOT NULL,
      status_code SMALLINT      NOT NULL,
      auth_method VARCHAR(50),
      created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at)`;
}

// Seed initial empty stats row for a newly registered user
export async function seedUserStats(userId: number): Promise<void> {
  try {
    const sql = getDb();
    await sql`INSERT INTO bot_stats (user_id) VALUES (${userId}) ON CONFLICT (user_id) DO NOTHING`;
  } catch { /* non-blocking */ }
}

// Best-effort audit write — never throws, never blocks the response path
export async function writeAuditLog(entry: {
  request_id: string;
  endpoint:   string;
  method:     string;
  ip_hash:    string;
  status_code: number;
  auth_method?: string;
}): Promise<void> {
  try {
    const sql = getDb();
    await sql`
      INSERT INTO audit_log (request_id, endpoint, method, ip_hash, status_code, auth_method)
      VALUES (
        ${entry.request_id}, ${entry.endpoint}, ${entry.method},
        ${entry.ip_hash}, ${entry.status_code}, ${entry.auth_method ?? null}
      )
    `;
  } catch { /* non-blocking */ }
}
