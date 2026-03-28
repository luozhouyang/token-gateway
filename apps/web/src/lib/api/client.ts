// API client for MiniGateway Admin API.

import type { ConfigObjectDescriptor } from "@/lib/configs/types";
import { DEFAULT_DASHBOARD_SETTINGS, readDashboardSettings } from "@/lib/dashboard-settings";

const DEFAULT_PAGE_LIMIT = 100;

// Type exports from packages/core
export interface Service {
  id: string;
  name: string;
  url?: string | null;
  protocol?: string;
  host?: string | null;
  port?: number | null;
  path?: string | null;
  connectTimeout?: number;
  writeTimeout?: number;
  readTimeout?: number;
  retries?: number;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Route {
  id: string;
  name: string;
  serviceId?: string | null;
  protocols?: string[];
  methods?: string[] | null;
  hosts?: string[] | null;
  paths?: string[] | null;
  headers?: Record<string, string | string[]> | null;
  snis?: string[] | null;
  sources?: string[] | null;
  destinations?: string[] | null;
  stripPath?: boolean;
  preserveHost?: boolean;
  regexPriority?: number;
  pathHandling?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Upstream {
  id: string;
  name: string;
  algorithm?: string;
  hashOn?: string;
  hashFallback?: string;
  slots?: number;
  healthcheck?: Record<string, unknown>;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Target {
  id: string;
  upstreamId: string;
  target: string;
  weight?: number;
  tags?: string[];
  createdAt: string;
}

export interface Consumer {
  id: string;
  username?: string | null;
  customId?: string | null;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Credential {
  id: string;
  consumerId: string;
  credentialType: string;
  credential: Record<string, unknown>;
  tags?: string[];
  createdAt: string;
}

export interface Plugin {
  id: string;
  name: string;
  serviceId?: string | null;
  routeId?: string | null;
  consumerId?: string | null;
  config?: Record<string, unknown> | null;
  enabled?: boolean;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PluginDefinitionSummary {
  name: string;
  displayName: string;
  description: string | null;
  version: string;
  phases: string[];
  hasConfigSchema: boolean;
  configDescriptor: ConfigObjectDescriptor | null;
}

export const LLM_CLIENT_PROFILES = [
  "codex",
  "claude",
  "gemini",
  "openai-compatible",
  "unknown",
] as const;

export const LLM_PROVIDER_PROTOCOLS = [
  "passthrough",
  "openai-compatible",
  "openai-responses",
  "anthropic-messages",
] as const;

export const LLM_PROVIDER_VENDORS = [
  "openai",
  "anthropic",
  "kimi",
  "glm",
  "deepseek",
  "custom",
] as const;

export const LLM_PROVIDER_AUTH_TYPES = ["none", "bearer", "api-key"] as const;

export type LlmClientProfile = (typeof LLM_CLIENT_PROFILES)[number];
export type LlmProviderProtocol = (typeof LLM_PROVIDER_PROTOCOLS)[number];
export type LlmProviderVendor = (typeof LLM_PROVIDER_VENDORS)[number];
export type LlmProviderAuthType = (typeof LLM_PROVIDER_AUTH_TYPES)[number];

export interface LlmProviderAuthConfig {
  type: LlmProviderAuthType;
  token?: string;
  tokenEnv?: string;
  key?: string;
  keyEnv?: string;
  headerName?: string;
}

export interface LlmProvider {
  id: string;
  name: string;
  displayName: string;
  vendor: LlmProviderVendor;
  enabled: boolean;
  protocol: LlmProviderProtocol;
  baseUrl: string;
  clients: LlmClientProfile[] | null;
  headers: Record<string, string>;
  auth: LlmProviderAuthConfig;
  adapterConfig: Record<string, unknown>;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface LlmModel {
  id: string;
  providerId: string;
  name: string;
  upstreamModel: string;
  enabled: boolean;
  metadata: Record<string, unknown>;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
}

export interface ServiceListParams extends PaginationParams {
  name?: string;
  protocol?: string;
}

export interface RouteListParams extends PaginationParams {
  name?: string;
  serviceId?: string;
  method?: string;
  path?: string;
}

export interface PluginListParams extends PaginationParams {
  name?: string;
  serviceId?: string;
  routeId?: string;
  consumerId?: string;
  enabled?: boolean;
}

export interface LlmProviderListParams extends PaginationParams {
  name?: string;
  vendor?: LlmProviderVendor;
  protocol?: LlmProviderProtocol;
  enabled?: boolean;
}

export interface LlmModelListParams extends PaginationParams {
  providerId?: string;
  providerName?: string;
  name?: string;
  enabled?: boolean;
}

export interface ApiResponse<T> {
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiListResponse<T> {
  data: T[];
  meta?: {
    page?: number;
    per_page?: number;
    total?: number;
  };
}

function getApiBaseUrl() {
  return readDashboardSettings().apiBaseUrl || DEFAULT_DASHBOARD_SETTINGS.apiBaseUrl;
}

function buildQueryString(params?: Record<string, string | number | boolean | undefined>) {
  const searchParams = new URLSearchParams();

  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${getApiBaseUrl()}${endpoint}`;
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (options?.headers) {
    Object.assign(headers, options.headers);
  }
  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: "Request failed" } }));

    const message = error?.error?.message || error?.message || `HTTP ${response.status}`;

    throw new Error(message);
  }

  const result = await response.json();
  return result as T;
}

async function fetchListPage<T>(
  endpoint: string,
  params?: PaginationParams,
): Promise<ApiListResponse<T>> {
  return fetchApi<ApiListResponse<T>>(
    `${endpoint}${buildQueryString({
      limit: params?.limit,
      offset: params?.offset,
    })}`,
  );
}

async function fetchAllListItems<T>(endpoint: string): Promise<T[]> {
  const items: T[] = [];
  let offset = 0;

  for (;;) {
    const page = await fetchListPage<T>(endpoint, {
      limit: DEFAULT_PAGE_LIMIT,
      offset,
    });

    items.push(...page.data);

    const total = page.meta?.total ?? items.length;
    if (items.length >= total || page.data.length === 0) {
      break;
    }

    offset += page.data.length;
  }

  return items;
}

// Services API
export const servicesApi = {
  list: async (params?: ServiceListParams): Promise<Service[]> => {
    if (params && Object.keys(params).length > 0) {
      const response = await fetchApi<ApiListResponse<Service>>(
        `/services${buildQueryString({
          limit: params.limit,
          offset: params.offset,
          name: params.name,
          protocol: params.protocol,
        })}`,
      );
      return response.data;
    }

    return fetchAllListItems<Service>("/services");
  },

  get: async (id: string): Promise<Service> => {
    const response = await fetchApi<ApiResponse<Service>>(`/services/${id}`);
    return response.data;
  },

  create: async (data: Partial<Service>): Promise<Service> => {
    const response = await fetchApi<ApiResponse<Service>>("/services", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return response.data;
  },

  update: async (id: string, data: Partial<Service>): Promise<Service> => {
    const response = await fetchApi<ApiResponse<Service>>(`/services/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await fetchApi<ApiResponse<void>>(`/services/${id}`, {
      method: "DELETE",
    });
  },
};

// Routes API
export const routesApi = {
  list: async (params?: RouteListParams): Promise<Route[]> => {
    if (params && Object.keys(params).length > 0) {
      const response = await fetchApi<ApiListResponse<Route>>(
        `/routes${buildQueryString({
          limit: params.limit,
          offset: params.offset,
          name: params.name,
          serviceId: params.serviceId,
          method: params.method,
          path: params.path,
        })}`,
      );
      return response.data;
    }

    return fetchAllListItems<Route>("/routes");
  },

  get: async (id: string): Promise<Route> => {
    const response = await fetchApi<ApiResponse<Route>>(`/routes/${id}`);
    return response.data;
  },

  create: async (data: Partial<Route>): Promise<Route> => {
    const response = await fetchApi<ApiResponse<Route>>("/routes", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return response.data;
  },

  update: async (id: string, data: Partial<Route>): Promise<Route> => {
    const response = await fetchApi<ApiResponse<Route>>(`/routes/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await fetchApi<ApiResponse<void>>(`/routes/${id}`, {
      method: "DELETE",
    });
  },
};

// Upstreams API
export const upstreamsApi = {
  list: async (params?: PaginationParams): Promise<Upstream[]> => {
    if (params?.limit !== undefined || params?.offset !== undefined) {
      const response = await fetchListPage<Upstream>("/upstreams", params);
      return response.data;
    }

    return fetchAllListItems<Upstream>("/upstreams");
  },

  get: async (id: string): Promise<Upstream> => {
    const response = await fetchApi<ApiResponse<Upstream>>(`/upstreams/${id}`);
    return response.data;
  },

  create: async (data: Partial<Upstream>): Promise<Upstream> => {
    const response = await fetchApi<ApiResponse<Upstream>>("/upstreams", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return response.data;
  },

  update: async (id: string, data: Partial<Upstream>): Promise<Upstream> => {
    const response = await fetchApi<ApiResponse<Upstream>>(`/upstreams/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await fetchApi<ApiResponse<void>>(`/upstreams/${id}`, {
      method: "DELETE",
    });
  },
};

// Targets API
export const targetsApi = {
  list: async (upstreamId: string, params?: PaginationParams): Promise<Target[]> => {
    if (params?.limit !== undefined || params?.offset !== undefined) {
      const response = await fetchListPage<Target>(`/upstreams/${upstreamId}/targets`, params);
      return response.data;
    }

    return fetchAllListItems<Target>(`/upstreams/${upstreamId}/targets`);
  },

  get: async (upstreamId: string, id: string): Promise<Target> => {
    const response = await fetchApi<ApiResponse<Target>>(`/upstreams/${upstreamId}/targets/${id}`);
    return response.data;
  },

  create: async (upstreamId: string, data: Partial<Target>): Promise<Target> => {
    const response = await fetchApi<ApiResponse<Target>>(`/upstreams/${upstreamId}/targets`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    return response.data;
  },

  update: async (upstreamId: string, id: string, data: Partial<Target>): Promise<Target> => {
    const response = await fetchApi<ApiResponse<Target>>(`/upstreams/${upstreamId}/targets/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    return response.data;
  },

  delete: async (upstreamId: string, id: string): Promise<void> => {
    await fetchApi<ApiResponse<void>>(`/upstreams/${upstreamId}/targets/${id}`, {
      method: "DELETE",
    });
  },
};

// Consumers API
export const consumersApi = {
  list: async (params?: PaginationParams): Promise<Consumer[]> => {
    if (params?.limit !== undefined || params?.offset !== undefined) {
      const response = await fetchListPage<Consumer>("/consumers", params);
      return response.data;
    }

    return fetchAllListItems<Consumer>("/consumers");
  },

  get: async (id: string): Promise<Consumer> => {
    const response = await fetchApi<ApiResponse<Consumer>>(`/consumers/${id}`);
    return response.data;
  },

  create: async (data: Partial<Consumer>): Promise<Consumer> => {
    const response = await fetchApi<ApiResponse<Consumer>>("/consumers", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return response.data;
  },

  update: async (id: string, data: Partial<Consumer>): Promise<Consumer> => {
    const response = await fetchApi<ApiResponse<Consumer>>(`/consumers/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await fetchApi<ApiResponse<void>>(`/consumers/${id}`, {
      method: "DELETE",
    });
  },
};

// Credentials API
export const credentialsApi = {
  list: async (consumerId: string, params?: PaginationParams): Promise<Credential[]> => {
    if (params?.limit !== undefined || params?.offset !== undefined) {
      const response = await fetchListPage<Credential>(
        `/consumers/${consumerId}/credentials`,
        params,
      );
      return response.data;
    }

    return fetchAllListItems<Credential>(`/consumers/${consumerId}/credentials`);
  },

  get: async (consumerId: string, id: string): Promise<Credential> => {
    const response = await fetchApi<ApiResponse<Credential>>(
      `/consumers/${consumerId}/credentials/${id}`,
    );
    return response.data;
  },

  create: async (consumerId: string, data: Partial<Credential>): Promise<Credential> => {
    const response = await fetchApi<ApiResponse<Credential>>(
      `/consumers/${consumerId}/credentials`,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    );
    return response.data;
  },

  update: async (
    consumerId: string,
    id: string,
    data: Partial<Credential>,
  ): Promise<Credential> => {
    const response = await fetchApi<ApiResponse<Credential>>(
      `/consumers/${consumerId}/credentials/${id}`,
      {
        method: "PUT",
        body: JSON.stringify(data),
      },
    );
    return response.data;
  },

  delete: async (consumerId: string, id: string): Promise<void> => {
    await fetchApi<ApiResponse<void>>(`/consumers/${consumerId}/credentials/${id}`, {
      method: "DELETE",
    });
  },
};

// Plugins API
export const pluginsApi = {
  list: async (params?: PluginListParams): Promise<Plugin[]> => {
    if (params && Object.keys(params).length > 0) {
      const response = await fetchApi<ApiListResponse<Plugin>>(
        `/plugins${buildQueryString({
          limit: params.limit,
          offset: params.offset,
          name: params.name,
          serviceId: params.serviceId,
          routeId: params.routeId,
          consumerId: params.consumerId,
          enabled: params.enabled,
        })}`,
      );
      return response.data;
    }

    return fetchAllListItems<Plugin>("/plugins");
  },

  get: async (id: string): Promise<Plugin> => {
    const response = await fetchApi<ApiResponse<Plugin>>(`/plugins/${id}`);
    return response.data;
  },

  listDefinitions: async (): Promise<PluginDefinitionSummary[]> => {
    const response = await fetchApi<ApiResponse<PluginDefinitionSummary[]>>("/plugins/definitions");
    return response.data;
  },

  create: async (data: Partial<Plugin>): Promise<Plugin> => {
    const response = await fetchApi<ApiResponse<Plugin>>("/plugins", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return response.data;
  },

  update: async (id: string, data: Partial<Plugin>): Promise<Plugin> => {
    const response = await fetchApi<ApiResponse<Plugin>>(`/plugins/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await fetchApi<ApiResponse<void>>(`/plugins/${id}`, {
      method: "DELETE",
    });
  },
};

export const llmProvidersApi = {
  list: async (params?: LlmProviderListParams): Promise<LlmProvider[]> => {
    if (params && Object.keys(params).length > 0) {
      const response = await fetchApi<ApiListResponse<LlmProvider>>(
        `/llm-providers${buildQueryString({
          limit: params.limit,
          offset: params.offset,
          name: params.name,
          vendor: params.vendor,
          protocol: params.protocol,
          enabled: params.enabled,
        })}`,
      );
      return response.data;
    }

    return fetchAllListItems<LlmProvider>("/llm-providers");
  },

  get: async (id: string): Promise<LlmProvider> => {
    const response = await fetchApi<ApiResponse<LlmProvider>>(`/llm-providers/${id}`);
    return response.data;
  },

  create: async (data: Partial<LlmProvider>): Promise<LlmProvider> => {
    const response = await fetchApi<ApiResponse<LlmProvider>>("/llm-providers", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return response.data;
  },

  update: async (id: string, data: Partial<LlmProvider>): Promise<LlmProvider> => {
    const response = await fetchApi<ApiResponse<LlmProvider>>(`/llm-providers/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await fetchApi<ApiResponse<void>>(`/llm-providers/${id}`, {
      method: "DELETE",
    });
  },

  listModels: async (providerId: string, params?: PaginationParams): Promise<LlmModel[]> => {
    if (params?.limit !== undefined || params?.offset !== undefined) {
      const response = await fetchListPage<LlmModel>(`/llm-providers/${providerId}/models`, params);
      return response.data;
    }

    return fetchAllListItems<LlmModel>(`/llm-providers/${providerId}/models`);
  },

  createModel: async (providerId: string, data: Partial<LlmModel>): Promise<LlmModel> => {
    const response = await fetchApi<ApiResponse<LlmModel>>(`/llm-providers/${providerId}/models`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    return response.data;
  },
};

export const llmModelsApi = {
  list: async (params?: LlmModelListParams): Promise<LlmModel[]> => {
    if (params && Object.keys(params).length > 0) {
      const response = await fetchApi<ApiListResponse<LlmModel>>(
        `/llm-models${buildQueryString({
          limit: params.limit,
          offset: params.offset,
          providerId: params.providerId,
          providerName: params.providerName,
          name: params.name,
          enabled: params.enabled,
        })}`,
      );
      return response.data;
    }

    return fetchAllListItems<LlmModel>("/llm-models");
  },

  get: async (id: string): Promise<LlmModel> => {
    const response = await fetchApi<ApiResponse<LlmModel>>(`/llm-models/${id}`);
    return response.data;
  },

  create: async (data: Partial<LlmModel>): Promise<LlmModel> => {
    const response = await fetchApi<ApiResponse<LlmModel>>("/llm-models", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return response.data;
  },

  update: async (id: string, data: Partial<LlmModel>): Promise<LlmModel> => {
    const response = await fetchApi<ApiResponse<LlmModel>>(`/llm-models/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await fetchApi<ApiResponse<void>>(`/llm-models/${id}`, {
      method: "DELETE",
    });
  },
};

// Dashboard API - get stats
export async function getDashboardStats(): Promise<{
  services: number;
  routes: number;
  upstreams: number;
  consumers: number;
  plugins: number;
}> {
  const [services, routes, upstreams, consumers, plugins] = await Promise.all([
    servicesApi.list(),
    routesApi.list(),
    upstreamsApi.list(),
    consumersApi.list(),
    pluginsApi.list(),
  ]);

  return {
    services: services.length,
    routes: routes.length,
    upstreams: upstreams.length,
    consumers: consumers.length,
    plugins: plugins.length,
  };
}
