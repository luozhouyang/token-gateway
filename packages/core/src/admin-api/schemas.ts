// Zod Schemas for Admin API Validation

import { z } from "zod";

// Pagination schema
export const paginationSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

// Service schemas
export const createServiceSchema = z.object({
  name: z.string().min(1).max(255),
  url: z.string().url().optional().nullable(),
  protocol: z.enum(["http", "https", "grpc", "grpcs"]).optional(),
  host: z.string().optional().nullable(),
  port: z.number().int().min(1).max(65535).optional().nullable(),
  path: z.string().optional().nullable(),
  connectTimeout: z.number().int().min(0).optional(),
  writeTimeout: z.number().int().min(0).optional(),
  readTimeout: z.number().int().min(0).optional(),
  retries: z.number().int().min(0).optional(),
  tags: z.array(z.string()).optional(),
});

export const updateServiceSchema = createServiceSchema.partial();

// Route schemas
export const createRouteSchema = z.object({
  name: z.string().min(1).max(255),
  serviceId: z.string().optional().nullable(),
  protocols: z.array(z.string()).optional(),
  methods: z.array(z.string()).optional().nullable(),
  hosts: z.array(z.string()).optional().nullable(),
  paths: z.array(z.string()).optional().nullable(),
  headers: z
    .record(z.string(), z.union([z.string(), z.array(z.string())]))
    .optional()
    .nullable(),
  snis: z.array(z.string()).optional().nullable(),
  sources: z.array(z.string()).optional().nullable(),
  destinations: z.array(z.string()).optional().nullable(),
  stripPath: z.boolean().optional(),
  preserveHost: z.boolean().optional(),
  regexPriority: z.number().int().optional(),
  pathHandling: z.enum(["v0", "v1"]).optional(),
  tags: z.array(z.string()).optional(),
});

export const updateRouteSchema = createRouteSchema.partial();

// Upstream schemas
export const createUpstreamSchema = z.object({
  name: z.string().min(1).max(255),
  algorithm: z
    .enum(["round-robin", "least-connections", "hash", "weighted-round-robin"])
    .optional(),
  hashOn: z.string().optional(),
  hashFallback: z.string().optional(),
  slots: z.number().int().min(1).optional(),
  healthcheck: z.record(z.string(), z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
});

export const updateUpstreamSchema = createUpstreamSchema.partial();

// Target schemas
export const createTargetSchema = z.object({
  target: z.string().min(1),
  weight: z.number().int().min(0).max(1000).optional(),
  tags: z.array(z.string()).optional(),
});

export const updateTargetSchema = createTargetSchema.partial();

// Consumer schemas
const consumerBaseSchema = z.object({
  username: z.string().min(1).max(255).optional().nullable(),
  customId: z.string().min(1).max(255).optional().nullable(),
  tags: z.array(z.string()).optional(),
});

export const createConsumerSchema = consumerBaseSchema.refine(
  (data) => data.username || data.customId,
  { message: "At least one of 'username' or 'customId' is required" },
);

export const updateConsumerSchema = consumerBaseSchema
  .partial()
  .refine((data) => data.username || data.customId, {
    message: "At least one of 'username' or 'customId' is required",
  });

// Credential schemas
export const createCredentialSchema = z.object({
  credentialType: z.string().min(1),
  credential: z.record(z.string(), z.unknown()),
  tags: z.array(z.string()).optional(),
});

export const updateCredentialSchema = createCredentialSchema.partial();

// Plugin schemas
export const createPluginSchema = z.object({
  name: z.string().min(1),
  serviceId: z.string().optional().nullable(),
  routeId: z.string().optional().nullable(),
  consumerId: z.string().optional().nullable(),
  config: z.record(z.string(), z.unknown()).optional().nullable(),
  enabled: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
});

export const updatePluginSchema = createPluginSchema.partial();

// Filter schemas
export const serviceFilterSchema = z.object({
  name: z.string().optional(),
  protocol: z.string().optional(),
  host: z.string().optional(),
});

export const routeFilterSchema = z.object({
  name: z.string().optional(),
  serviceId: z.string().optional(),
  method: z.string().optional(),
  path: z.string().optional(),
});

export const upstreamFilterSchema = z.object({
  name: z.string().optional(),
  algorithm: z.string().optional(),
});

export const consumerFilterSchema = z.object({
  username: z.string().optional(),
  customId: z.string().optional(),
});

export const pluginFilterSchema = z.object({
  name: z.string().optional(),
  serviceId: z.string().optional(),
  routeId: z.string().optional(),
  consumerId: z.string().optional(),
  enabled: z.coerce.boolean().optional(),
});

// Type exports
export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
export type CreateRouteInput = z.infer<typeof createRouteSchema>;
export type UpdateRouteInput = z.infer<typeof updateRouteSchema>;
export type CreateUpstreamInput = z.infer<typeof createUpstreamSchema>;
export type UpdateUpstreamInput = z.infer<typeof updateUpstreamSchema>;
export type CreateTargetInput = z.infer<typeof createTargetSchema>;
export type UpdateTargetInput = z.infer<typeof updateTargetSchema>;
export type CreateConsumerInput = z.infer<typeof createConsumerSchema>;
export type UpdateConsumerInput = z.infer<typeof updateConsumerSchema>;
export type CreateCredentialInput = z.infer<typeof createCredentialSchema>;
export type UpdateCredentialInput = z.infer<typeof updateCredentialSchema>;
export type CreatePluginInput = z.infer<typeof createPluginSchema>;
export type UpdatePluginInput = z.infer<typeof updatePluginSchema>;
