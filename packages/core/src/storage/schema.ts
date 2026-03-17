import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";

// Utility function: generate random ID
export function randomId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Type exports
export type Service = InferSelectModel<typeof services>;
export type Route = InferSelectModel<typeof routes>;
export type Upstream = InferSelectModel<typeof upstreams>;
export type Target = InferSelectModel<typeof targets>;
export type Consumer = InferSelectModel<typeof consumers>;
export type Plugin = InferSelectModel<typeof plugins>;
export type Credential = InferSelectModel<typeof credentials>;

// Input types for creating entities - all fields optional except 'name' (where required)
export type CreateServiceInput = Partial<Omit<Service, "id" | "createdAt" | "updatedAt">> & {
  name: string;
  tags?: string[] | null;
};
export type CreateRouteInput = Partial<Omit<Route, "id" | "createdAt" | "updatedAt">> & {
  name: string;
  tags?: string[] | null;
};
export type CreateUpstreamInput = Partial<Omit<Upstream, "id" | "createdAt" | "updatedAt">> & {
  name: string;
  tags?: string[] | null;
};
export type CreateTargetInput = Partial<Omit<Target, "id" | "createdAt">> & {
  tags?: string[] | null;
};
export type CreateConsumerInput = Partial<Omit<Consumer, "id" | "createdAt" | "updatedAt">> & {
  tags?: string[] | null;
};
export type CreatePluginBindingInput = Partial<Omit<Plugin, "id" | "createdAt" | "updatedAt">> & {
  name: string;
  tags?: string[] | null;
};
export type CreateCredentialInput = Partial<Omit<Credential, "id" | "createdAt">> & {
  tags?: string[] | null;
};

// Services table
export const services = sqliteTable("services", {
  id: text("id").primaryKey().$defaultFn(randomId),
  name: text("name").unique().notNull(),
  url: text("url"),
  protocol: text("protocol").default("http"),
  host: text("host"),
  port: integer("port"),
  path: text("path"),
  connectTimeout: integer("connect_timeout").default(60000),
  writeTimeout: integer("write_timeout").default(60000),
  readTimeout: integer("read_timeout").default(60000),
  retries: integer("retries").default(5),
  tags: text("tags", { mode: "json" }).$defaultFn(() => []),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

// Routes table
export const routes = sqliteTable(
  "routes",
  {
    id: text("id").primaryKey().$defaultFn(randomId),
    name: text("name").unique().notNull(),
    serviceId: text("service_id").references(() => services.id, { onDelete: "cascade" }),
    protocols: text("protocols", { mode: "json" })
      .$type<string[]>()
      .$defaultFn(() => ["http", "https"]),
    methods: text("methods", { mode: "json" }).$type<string[]>(),
    hosts: text("hosts", { mode: "json" }).$type<string[]>(),
    paths: text("paths", { mode: "json" }).$type<string[]>(),
    headers: text("headers", { mode: "json" }).$type<Record<string, string | string[]>>(),
    snis: text("snis", { mode: "json" }).$type<string[]>(),
    sources: text("sources", { mode: "json" }).$type<string[]>(),
    destinations: text("destinations", { mode: "json" }).$type<string[]>(),
    stripPath: integer("strip_path", { mode: "boolean" }).default(false),
    preserveHost: integer("preserve_host", { mode: "boolean" }).default(false),
    regexPriority: integer("regex_priority").default(0),
    pathHandling: text("path_handling").default("v0"),
    tags: text("tags", { mode: "json" })
      .$type<string[]>()
      .$defaultFn(() => []),
    createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
  },
  (table) => ({
    idx_routes_service_id: index("idx_routes_service_id").on(table.serviceId),
  }),
);

// Upstreams table
export const upstreams = sqliteTable("upstreams", {
  id: text("id").primaryKey().$defaultFn(randomId),
  name: text("name").unique().notNull(),
  algorithm: text("algorithm").default("round-robin"),
  hashOn: text("hash_on").default("none"),
  hashFallback: text("hash_fallback").default("none"),
  slots: integer("slots").default(10000),
  healthcheck: text("healthcheck", { mode: "json" }).$type<Record<string, unknown>>(),
  tags: text("tags", { mode: "json" })
    .$type<string[]>()
    .$defaultFn(() => []),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

// Targets table
export const targets = sqliteTable(
  "targets",
  {
    id: text("id").primaryKey().$defaultFn(randomId),
    upstreamId: text("upstream_id").references(() => upstreams.id, { onDelete: "cascade" }),
    target: text("target").notNull(),
    weight: integer("weight").default(100),
    tags: text("tags", { mode: "json" })
      .$type<string[]>()
      .$defaultFn(() => []),
    createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  },
  (table) => ({
    idx_targets_upstream_id: index("idx_targets_upstream_id").on(table.upstreamId),
  }),
);

// Consumers table
export const consumers = sqliteTable("consumers", {
  id: text("id").primaryKey().$defaultFn(randomId),
  username: text("username").unique(),
  customId: text("custom_id").unique(),
  tags: text("tags", { mode: "json" })
    .$type<string[]>()
    .$defaultFn(() => []),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

// Plugins table
export const plugins = sqliteTable(
  "plugins",
  {
    id: text("id").primaryKey().$defaultFn(randomId),
    name: text("name").notNull(),
    serviceId: text("service_id").references(() => services.id, { onDelete: "cascade" }),
    routeId: text("route_id").references(() => routes.id, { onDelete: "cascade" }),
    consumerId: text("consumer_id").references(() => consumers.id, { onDelete: "cascade" }),
    config: text("config", { mode: "json" }).$type<Record<string, unknown>>(),
    enabled: integer("enabled", { mode: "boolean" }).default(true),
    tags: text("tags", { mode: "json" })
      .$type<string[]>()
      .$defaultFn(() => []),
    createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
  },
  (table) => ({
    idx_plugins_service_id: index("idx_plugins_service_id").on(table.serviceId),
    idx_plugins_route_id: index("idx_plugins_route_id").on(table.routeId),
    idx_plugins_consumer_id: index("idx_plugins_consumer_id").on(table.consumerId),
  }),
);

// Credentials table
export const credentials = sqliteTable(
  "credentials",
  {
    id: text("id").primaryKey().$defaultFn(randomId),
    consumerId: text("consumer_id").references(() => consumers.id, { onDelete: "cascade" }),
    credentialType: text("credential_type").notNull(),
    credential: text("credential", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
    tags: text("tags", { mode: "json" })
      .$type<string[]>()
      .$defaultFn(() => []),
    createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  },
  (table) => ({
    idx_credentials_consumer_id: index("idx_credentials_consumer_id").on(table.consumerId),
  }),
);

// Relations definitions
export const servicesRelations = relations(services, ({ many }) => ({
  routes: many(routes),
  plugins: many(plugins, { relationName: "service_plugins" }),
}));

export const routesRelations = relations(routes, ({ one, many }) => ({
  service: one(services, {
    fields: [routes.serviceId],
    references: [services.id],
  }),
  plugins: many(plugins, { relationName: "route_plugins" }),
}));

export const upstreamsRelations = relations(upstreams, ({ many }) => ({
  targets: many(targets),
}));

export const targetsRelations = relations(targets, ({ one }) => ({
  upstream: one(upstreams, {
    fields: [targets.upstreamId],
    references: [upstreams.id],
  }),
}));

export const consumersRelations = relations(consumers, ({ many }) => ({
  plugins: many(plugins, { relationName: "consumer_plugins" }),
  credentials: many(credentials),
}));

export const pluginsRelations = relations(plugins, ({ one }) => ({
  service: one(services, {
    fields: [plugins.serviceId],
    references: [services.id],
    relationName: "service_plugins",
  }),
  route: one(routes, {
    fields: [plugins.routeId],
    references: [routes.id],
    relationName: "route_plugins",
  }),
  consumer: one(consumers, {
    fields: [plugins.consumerId],
    references: [consumers.id],
    relationName: "consumer_plugins",
  }),
}));

export const credentialsRelations = relations(credentials, ({ one }) => ({
  consumer: one(consumers, {
    fields: [credentials.consumerId],
    references: [consumers.id],
  }),
}));
