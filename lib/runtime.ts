export interface EchoEnv {
  DB: D1Database;
  REPORTS?: R2Bucket;
  ADMIN_EMAILS?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
}

export async function getRuntimeEnv(): Promise<EchoEnv> {
  const runtime = await import("cloudflare:workers");
  return runtime.env as unknown as EchoEnv;
}

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'resident', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS districts (id TEXT PRIMARY KEY, name TEXT NOT NULL, geometry_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS metrics (id TEXT PRIMARY KEY, district_id TEXT NOT NULL, key TEXT NOT NULL, value INTEGER NOT NULL, source_type TEXT NOT NULL, observed_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL, category TEXT NOT NULL, severity TEXT NOT NULL, longitude TEXT NOT NULL, latitude TEXT NOT NULL, district_id TEXT NOT NULL, source_url TEXT NOT NULL, source_type TEXT NOT NULL, starts_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'published', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS problems (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, type TEXT NOT NULL, longitude TEXT NOT NULL, latitude TEXT NOT NULL, intensity INTEGER NOT NULL, radius INTEGER NOT NULL, duration_minutes INTEGER NOT NULL, description TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS scenarios (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, name TEXT NOT NULL, request_json TEXT NOT NULL, result_json TEXT, status TEXT NOT NULL DEFAULT 'draft', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS reports (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, scenario_id TEXT NOT NULL, object_key TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS subscriptions (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, email TEXT NOT NULL, filters_json TEXT NOT NULL DEFAULT '{}', active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS notification_deliveries (id TEXT PRIMARY KEY, subscription_id TEXT, recipient TEXT NOT NULL, subject TEXT NOT NULL, status TEXT NOT NULL, error TEXT, sent_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS audit_log (id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, before_json TEXT, after_json TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE INDEX IF NOT EXISTS idx_metrics_district_time ON metrics(district_id, observed_at)`,
  `CREATE INDEX IF NOT EXISTS idx_events_status_start ON events(status, starts_at)`,
  `CREATE INDEX IF NOT EXISTS idx_problems_owner_created ON problems(owner_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_scenarios_owner_updated ON scenarios(owner_id, updated_at)`,
  `CREATE INDEX IF NOT EXISTS idx_reports_owner ON reports(owner_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_subscriptions_owner ON subscriptions(owner_id)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_entity_time ON audit_log(entity_type, entity_id, created_at)`,
];

let schemaReady: Promise<D1Database> | null = null;

export function getD1() {
  return getRuntimeEnv().then((runtime) => {
    const db = runtime.DB;
    if (!db) throw new Error("D1 binding DB is unavailable");
    if (!schemaReady) {
      schemaReady = db.batch(schemaStatements.map((statement) => db.prepare(statement))).then(async () => {
        await db.prepare("PRAGMA optimize").run();
        return db;
      });
    }
    return schemaReady;
  });
}

export async function writeAudit(input: {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
}) {
  const db = await getD1();
  await db.prepare(
    "INSERT INTO audit_log (id, actor_id, action, entity_type, entity_id, before_json, after_json) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).bind(
    crypto.randomUUID(),
    input.actorId,
    input.action,
    input.entityType,
    input.entityId,
    input.before === undefined ? null : JSON.stringify(input.before),
    input.after === undefined ? null : JSON.stringify(input.after),
  ).run();
}
