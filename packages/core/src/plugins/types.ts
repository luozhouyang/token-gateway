// Plugin system type definitions

import type { Consumer, Route, Service } from "../entities/types.js";

/**
 * Plugin instance - a bound plugin with its configuration
 * Represents a single plugin configuration (one row from the plugins table)
 */
export interface PluginInstance {
  id: string;
  name: string;
  serviceId?: string | null;
  routeId?: string | null;
  consumerId?: string | null;
  config: Record<string, unknown>;
  enabled: boolean;
  tags?: string[];
  priority?: number; // Runtime priority, can be overridden from binding
}

/**
 * Plugin execution context
 * Contains all information needed for plugin execution during request/response lifecycle
 */
export interface PluginContext {
  // Request info
  request: Request;
  url: URL;
  method: string;
  headers: Headers;

  // Routing info
  route?: Route;
  service?: Service;
  consumer?: Consumer;

  // Plugin instance info
  plugin: PluginInstance;
  config: Record<string, unknown>;

  // State
  state: Map<string, unknown>;

  // Utilities
  waitUntil: (promise: Promise<void>) => void;
}

/**
 * Plugin response object
 * Returned by plugins to modify request/response
 */
export interface PluginResponse {
  /** Stop processing additional plugins */
  stop?: boolean;
  /** Skip this plugin and continue */
  skip?: boolean;
  /** Override response (for response phase) */
  response?: Response;
  /** Override request (for request phase) */
  request?: Request;
  /** Error to throw */
  error?: Error;
}

/**
 * Plugin lifecycle phases
 */
export type PluginPhase = "request" | "response" | "error";

/**
 * Plugin handler function type
 */
export type PluginHandler = (
  ctx: PluginContext,
) => Promise<PluginResponse | void> | PluginResponse | void;

/**
 * Plugin definition interface
 * All plugins must implement this interface
 */
export interface PluginDefinition {
  /** Unique plugin name */
  name: string;

  /** Plugin version */
  version: string;

  /** Plugin priority (higher = runs first) */
  priority?: number;

  /** Which phases this plugin supports */
  phases: PluginPhase[];

  /** Default configuration schema */
  configSchema?: Record<string, unknown>;

  /** Request phase handler */
  onRequest?: PluginHandler;

  /** Response phase handler */
  onResponse?: PluginHandler;

  /** Error phase handler */
  onError?: PluginHandler;
}

/**
 * Built-in plugin types
 */
export type BuiltinPluginType =
  | "logger"
  | "cors"
  | "rate-limit"
  | "key-auth"
  | "jwt-auth"
  | "transform-request"
  | "transform-response"
  | "ip-restriction";

/**
 * Configuration for built-in plugins
 */
export interface BuiltinPluginConfigs {
  logger: {
    level?: "debug" | "info" | "warn" | "error";
    format?: "json" | "text";
    fields?: string[];
  };

  cors: {
    origin?: string | string[];
    methods?: string[];
    allowedHeaders?: string[];
    exposedHeaders?: string[];
    credentials?: boolean;
    maxAge?: number;
  };

  "rate-limit": {
    limit: number;
    window: number; // in seconds
    key?: string; // default: ip
    headers?: boolean;
  };

  "key-auth": {
    keyNames?: string[]; // default: ["apikey", "api_key"]
    headerName?: string; // default: "X-API-Key"
    queryParamName?: string; // default: "api_key"
    hideCredentials?: boolean;
  };
}
