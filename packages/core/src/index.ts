// Storage
export { DatabaseService } from "./storage/database.js";
export { Repository, type ListOptions } from "./storage/repository.js";
export { runMigrations } from "./storage/migrations.js";

// Schema
export * from "./storage/schema.js";

// Entities
export { ServiceRepository } from "./entities/service.js";
export { RouteRepository } from "./entities/route.js";
export { UpstreamRepository } from "./entities/upstream.js";
export { TargetRepository } from "./entities/target.js";
export { ConsumerRepository } from "./entities/consumer.js";
export { PluginBindingRepository } from "./entities/plugin-binding.js";
export { CredentialRepository } from "./entities/credential.js";

// Types
export type * from "./entities/types.js";

// Plugins
export { PluginManager } from "./plugins/plugin-manager.js";
export { PluginLoader } from "./plugins/plugin-loader.js";
export {
  createPluginMiddleware,
  type PluginMiddlewareOptions,
  PLUGIN_STATE_KEYS,
  PluginStateHelper,
} from "./plugins/plugin-middleware.js";
export * from "./plugins/types.js";

// Engine
export { ProxyEngine, type ProxyEngineOptions } from "./engine/proxy-engine.js";
export {
  RoundRobinLoadBalancer,
  LeastConnectionsLoadBalancer,
  HashLoadBalancer,
  HealthAwareLoadBalancer,
  createLoadBalancer,
  type LoadBalancer,
  type LoadBalancerOptions,
  type LoadBalancingAlgorithm,
} from "./engine/load-balancer.js";

// Utils
export {
  getConfigDir,
  getConfigPath,
  getDatabasePath,
  getCliConfigPath,
} from "./utils/app-paths.js";

// Static Server
export { createStaticServer, type StaticServerOptions } from "./static-server.js";

// Unified Server
export {
  createUnifiedServer,
  startUnifiedServer,
  type UnifiedServerOptions,
} from "./unified-server.js";

// Admin API
export { createAdminApi, type AdminApiOptions } from "./admin-api/server.js";

// Zod schemas (prefixed with Z to avoid naming conflicts)
export {
  createServiceSchema,
  createRouteSchema,
  createUpstreamSchema,
  createTargetSchema,
  createConsumerSchema,
  createCredentialSchema,
  createPluginSchema,
  updateServiceSchema,
  updateRouteSchema,
  updateUpstreamSchema,
  updateTargetSchema,
  updateConsumerSchema,
  updateCredentialSchema,
  updatePluginSchema,
  paginationSchema,
  serviceFilterSchema,
  routeFilterSchema,
  upstreamFilterSchema,
  consumerFilterSchema,
  pluginFilterSchema,
} from "./admin-api/schemas.js";

// API types (prefixed to avoid conflicts)
export type {
  ServiceResponse,
  RouteResponse,
  UpstreamResponse,
  TargetResponse,
  ConsumerResponse,
  PluginResponse,
  CredentialResponse,
  ApiSuccessResponse,
  ApiErrorResponse,
  ApiResponseMeta,
  ValidationError,
  ErrorCode,
  PaginationParams,
  PaginationResult,
} from "./admin-api/types.js";
