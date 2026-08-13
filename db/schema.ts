import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
};

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  role: text("role", { enum: ["resident", "analyst", "admin"] }).notNull().default("resident"),
  ...timestamps,
}, (table) => [uniqueIndex("idx_users_email").on(table.email)]);

export const districts = sqliteTable("districts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  geometryJson: text("geometry_json").notNull().default("{}"),
  ...timestamps,
});

export const metrics = sqliteTable("metrics", {
  id: text("id").primaryKey(),
  districtId: text("district_id").notNull(),
  key: text("key").notNull(),
  value: integer("value").notNull(),
  sourceType: text("source_type", { enum: ["observed", "modelled"] }).notNull(),
  observedAt: text("observed_at").notNull(),
  ...timestamps,
}, (table) => [index("idx_metrics_district_time").on(table.districtId, table.observedAt)]);

export const events = sqliteTable("events", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  severity: text("severity").notNull(),
  longitude: text("longitude").notNull(),
  latitude: text("latitude").notNull(),
  districtId: text("district_id").notNull(),
  sourceUrl: text("source_url").notNull(),
  sourceType: text("source_type", { enum: ["observed", "modelled"] }).notNull(),
  startsAt: text("starts_at").notNull(),
  status: text("status").notNull().default("published"),
  ...timestamps,
}, (table) => [index("idx_events_status_start").on(table.status, table.startsAt)]);

export const problems = sqliteTable("problems", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  type: text("type").notNull(),
  longitude: text("longitude").notNull(),
  latitude: text("latitude").notNull(),
  intensity: integer("intensity").notNull(),
  radius: integer("radius").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull().default("pending"),
  ...timestamps,
}, (table) => [index("idx_problems_owner_created").on(table.ownerId, table.createdAt)]);

export const scenarios = sqliteTable("scenarios", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  name: text("name").notNull(),
  requestJson: text("request_json").notNull(),
  resultJson: text("result_json"),
  status: text("status").notNull().default("draft"),
  ...timestamps,
}, (table) => [index("idx_scenarios_owner_updated").on(table.ownerId, table.updatedAt)]);

export const reports = sqliteTable("reports", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  scenarioId: text("scenario_id").notNull(),
  objectKey: text("object_key").notNull(),
  expiresAt: text("expires_at").notNull(),
  ...timestamps,
}, (table) => [index("idx_reports_owner").on(table.ownerId, table.createdAt)]);

export const subscriptions = sqliteTable("subscriptions", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  email: text("email").notNull(),
  filtersJson: text("filters_json").notNull().default("{}"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
}, (table) => [index("idx_subscriptions_owner").on(table.ownerId)]);

export const notificationDeliveries = sqliteTable("notification_deliveries", {
  id: text("id").primaryKey(),
  subscriptionId: text("subscription_id"),
  recipient: text("recipient").notNull(),
  subject: text("subject").notNull(),
  status: text("status").notNull(),
  error: text("error"),
  sentAt: text("sent_at"),
  ...timestamps,
});

export const auditLog = sqliteTable("audit_log", {
  id: text("id").primaryKey(),
  actorId: text("actor_id").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  beforeJson: text("before_json"),
  afterJson: text("after_json"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_audit_entity_time").on(table.entityType, table.entityId, table.createdAt)]);

