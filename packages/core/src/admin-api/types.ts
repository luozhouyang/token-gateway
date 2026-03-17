// Admin API Types

export type { StatusCode } from "hono/utils/http-status";

// API Response Types
export interface ApiSuccessResponse<T = unknown> {
  data: T;
  meta?: ApiResponseMeta;
}

export interface ApiResponseMeta {
  page?: number;
  per_page?: number;
  total?: number;
}

export interface ApiErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    details?: ValidationError[];
  };
}

export interface ValidationError {
  field: string;
  message: string;
}

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL_ERROR"
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN";

// Pagination Types
export interface PaginationParams {
  limit?: number;
  offset?: number;
  page?: number;
}

export interface PaginationResult {
  limit: number;
  offset: number;
  total: number;
  hasMore: boolean;
}

// Entity Response Types (camelCase API format)
export interface ServiceResponse {
  id: string;
  name: string;
  url: string | null;
  protocol: string | null;
  host: string | null;
  port: number | null;
  path: string | null;
  connectTimeout: number | null;
  writeTimeout: number | null;
  readTimeout: number | null;
  retries: number | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface RouteResponse {
  id: string;
  name: string;
  serviceId: string | null;
  protocols: string[];
  methods: string[] | null;
  hosts: string[] | null;
  paths: string[] | null;
  headers: Record<string, string | string[]> | null;
  snis: string[] | null;
  sources: string[] | null;
  destinations: string[] | null;
  stripPath: boolean;
  preserveHost: boolean;
  regexPriority: number;
  pathHandling: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface UpstreamResponse {
  id: string;
  name: string;
  algorithm: string;
  hashOn: string;
  hashFallback: string;
  slots: number;
  healthcheck: Record<string, unknown> | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TargetResponse {
  id: string;
  upstreamId: string | null;
  target: string;
  weight: number;
  tags: string[];
  createdAt: string;
}

export interface ConsumerResponse {
  id: string;
  username: string | null;
  customId: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PluginResponse {
  id: string;
  name: string;
  serviceId: string | null;
  routeId: string | null;
  consumerId: string | null;
  config: Record<string, unknown> | null;
  enabled: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CredentialResponse {
  id: string;
  consumerId: string | null;
  credentialType: string;
  credential: Record<string, unknown>;
  tags: string[];
  createdAt: string;
}
