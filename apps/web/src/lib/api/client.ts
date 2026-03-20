// API Client for Token Gateway Admin API

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/admin";

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

export interface PaginationParams {
  limit?: number;
  offset?: number;
}

export interface PaginationResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ApiListResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

// Base fetch wrapper with error handling
async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
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
    const error = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  const result = await response.json();
  return result as T;
}

// Services API
export const servicesApi = {
  list: async (params?: PaginationParams): Promise<Service[]> => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.offset) searchParams.set("offset", String(params.offset));
    const query = searchParams.toString();
    const response = await fetchApi<ApiListResponse<Service>>(
      `/services${query ? `?${query}` : ""}`,
    );
    return response.data;
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
  list: async (params?: PaginationParams): Promise<Route[]> => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.offset) searchParams.set("offset", String(params.offset));
    const query = searchParams.toString();
    const response = await fetchApi<ApiListResponse<Route>>(`/routes${query ? `?${query}` : ""}`);
    return response.data;
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
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.offset) searchParams.set("offset", String(params.offset));
    const query = searchParams.toString();
    const response = await fetchApi<ApiListResponse<Upstream>>(
      `/upstreams${query ? `?${query}` : ""}`,
    );
    return response.data;
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
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.offset) searchParams.set("offset", String(params.offset));
    const query = searchParams.toString();
    const response = await fetchApi<ApiListResponse<Target>>(
      `/upstreams/${upstreamId}/targets${query ? `?${query}` : ""}`,
    );
    return response.data;
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
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.offset) searchParams.set("offset", String(params.offset));
    const query = searchParams.toString();
    const response = await fetchApi<ApiListResponse<Consumer>>(
      `/consumers${query ? `?${query}` : ""}`,
    );
    return response.data;
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
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.offset) searchParams.set("offset", String(params.offset));
    const query = searchParams.toString();
    const response = await fetchApi<ApiListResponse<Credential>>(
      `/consumers/${consumerId}/credentials${query ? `?${query}` : ""}`,
    );
    return response.data;
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
  list: async (params?: PaginationParams): Promise<Plugin[]> => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.offset) searchParams.set("offset", String(params.offset));
    const query = searchParams.toString();
    const response = await fetchApi<ApiListResponse<Plugin>>(`/plugins${query ? `?${query}` : ""}`);
    return response.data;
  },

  get: async (id: string): Promise<Plugin> => {
    const response = await fetchApi<ApiResponse<Plugin>>(`/plugins/${id}`);
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

// Dashboard API - get stats
export async function getDashboardStats(): Promise<
  ApiResponse<{
    services: number;
    routes: number;
    upstreams: number;
    consumers: number;
    plugins: number;
  }>
> {
  return fetchApi("/dashboard/stats");
}
