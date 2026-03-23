// Standard Response Builders

import type {
  Service,
  Route,
  Upstream,
  Target,
  Consumer,
  Plugin as PluginBinding,
  Credential,
} from "../storage/schema.js";
import type { PluginInstance } from "../plugins/types.js";
import type {
  ApiSuccessResponse,
  ApiErrorResponse,
  ServiceResponse,
  RouteResponse,
  UpstreamResponse,
  TargetResponse,
  ConsumerResponse,
  PluginResponse,
  CredentialResponse,
  PaginationResult,
  ErrorCode,
  ValidationError,
} from "./types.js";

// Entity transformers - convert database entities to API response format
export function toServiceResponse(service: Service): ServiceResponse {
  return {
    id: service.id,
    name: service.name,
    url: service.url,
    protocol: service.protocol,
    host: service.host,
    port: service.port,
    path: service.path,
    connectTimeout: service.connectTimeout,
    writeTimeout: service.writeTimeout,
    readTimeout: service.readTimeout,
    retries: service.retries,
    tags: service.tags as string[],
    createdAt: service.createdAt!,
    updatedAt: service.updatedAt!,
  };
}

export function toRouteResponse(route: Route): RouteResponse {
  return {
    id: route.id,
    name: route.name,
    serviceId: route.serviceId,
    protocols: route.protocols as string[],
    methods: route.methods as string[] | null,
    hosts: route.hosts as string[] | null,
    paths: route.paths as string[] | null,
    headers: route.headers as Record<string, string | string[]> | null,
    snis: route.snis as string[] | null,
    sources: route.sources as string[] | null,
    destinations: route.destinations as string[] | null,
    stripPath: route.stripPath ?? false,
    preserveHost: route.preserveHost ?? false,
    regexPriority: route.regexPriority ?? 0,
    pathHandling: route.pathHandling ?? "v0",
    tags: route.tags as string[],
    createdAt: route.createdAt!,
    updatedAt: route.updatedAt!,
  };
}

export function toUpstreamResponse(upstream: Upstream): UpstreamResponse {
  return {
    id: upstream.id,
    name: upstream.name,
    algorithm: upstream.algorithm ?? "round-robin",
    hashOn: upstream.hashOn ?? "none",
    hashFallback: upstream.hashFallback ?? "none",
    slots: upstream.slots ?? 10000,
    healthcheck: upstream.healthcheck as Record<string, unknown> | null,
    tags: upstream.tags as string[],
    createdAt: upstream.createdAt!,
    updatedAt: upstream.updatedAt!,
  };
}

export function toTargetResponse(target: Target): TargetResponse {
  return {
    id: target.id,
    upstreamId: target.upstreamId,
    target: target.target,
    weight: target.weight ?? 100,
    tags: target.tags as string[],
    createdAt: target.createdAt!,
  };
}

export function toConsumerResponse(consumer: Consumer): ConsumerResponse {
  return {
    id: consumer.id,
    username: consumer.username,
    customId: consumer.customId,
    tags: consumer.tags as string[],
    createdAt: consumer.createdAt!,
    updatedAt: consumer.updatedAt!,
  };
}

export function toPluginResponse(plugin: PluginBinding | PluginInstance): PluginResponse {
  return {
    id: plugin.id,
    name: plugin.name,
    serviceId: plugin.serviceId ?? null,
    routeId: plugin.routeId ?? null,
    consumerId: plugin.consumerId ?? null,
    config: plugin.config as Record<string, unknown> | null,
    enabled: plugin.enabled ?? true,
    tags: plugin.tags as string[],
    createdAt: plugin.createdAt!,
    updatedAt: plugin.updatedAt!,
  };
}

export function toCredentialResponse(credential: Credential): CredentialResponse {
  return {
    id: credential.id,
    consumerId: credential.consumerId,
    credentialType: credential.credentialType,
    credential: credential.credential as Record<string, unknown>,
    tags: credential.tags as string[],
    createdAt: credential.createdAt!,
  };
}

// Response builders
export function successResponse<T>(data: T, meta?: Record<string, unknown>): ApiSuccessResponse<T> {
  return {
    data,
    meta: meta as Record<string, unknown> | undefined,
  };
}

export function listResponse<T>(
  items: T[],
  pagination: PaginationResult,
): ApiSuccessResponse<T[] & { meta: PaginationResult }> {
  return {
    data: items as T[] & { meta: PaginationResult },
    meta: {
      page: Math.floor(pagination.offset / pagination.limit) + 1,
      per_page: pagination.limit,
      total: pagination.total,
    },
  };
}

export function errorResponse(
  code: ErrorCode,
  message: string,
  details?: ValidationError[],
): ApiErrorResponse {
  return {
    error: {
      code,
      message,
      details,
    },
  };
}

// Pagination helper
export function parsePagination(
  limit?: string | null,
  offset?: string | null,
): { limit: number; offset: number } {
  const parsedLimit = limit ? parseInt(limit, 10) : 20;
  const parsedOffset = offset ? parseInt(offset, 10) : 0;

  return {
    limit: Math.min(Math.max(parsedLimit, 1), 100), // Clamp between 1 and 100
    offset: Math.max(parsedOffset, 0),
  };
}
