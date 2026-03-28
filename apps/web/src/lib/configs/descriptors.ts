import type { ConfigFieldDefinition, ConfigObjectDescriptor } from "@/lib/configs/types";
import { LLM_CLIENT_PROFILES } from "@/lib/api/client";

export const routeHeadersDescriptor: ConfigObjectDescriptor = {
  fields: [
    {
      key: "headers",
      kind: "object",
      label: "Header matching rules",
      description: "Add request headers with a string or string-array value.",
      additionalProperties: true,
    },
  ],
};

export const upstreamHealthcheckDescriptor: ConfigObjectDescriptor = {
  fields: [
    {
      key: "healthcheck",
      kind: "object",
      label: "Healthcheck settings",
      description: "Structured upstream healthcheck configuration.",
      additionalProperties: true,
    },
  ],
};

export const llmModelMetadataDescriptor: ConfigObjectDescriptor = {
  fields: [
    {
      key: "metadata",
      kind: "object",
      label: "Model metadata",
      description: "Attach structured metadata used by routing, dashboards, or plugins.",
      additionalProperties: true,
    },
  ],
};

export const keyAuthCredentialDescriptor: ConfigObjectDescriptor = {
  fields: [
    {
      key: "key",
      kind: "string",
      label: "API key",
      description: "The consumer credential presented to the key-auth plugin.",
      required: true,
    },
  ],
};

export const llmProviderAuthFields: ConfigFieldDefinition[] = [
  {
    key: "type",
    kind: "select",
    label: "Auth type",
    options: [
      { label: "None", value: "none" },
      { label: "Bearer", value: "bearer" },
      { label: "API Key", value: "api-key" },
    ],
  },
  {
    key: "token",
    kind: "string",
    input: "password",
    label: "Bearer token",
    visibleWhen: {
      key: "type",
      equals: "bearer",
    },
  },
  {
    key: "tokenEnv",
    kind: "string",
    label: "Bearer token env var",
    placeholder: "OPENAI_API_KEY",
    visibleWhen: {
      key: "type",
      equals: "bearer",
    },
  },
  {
    key: "key",
    kind: "string",
    input: "password",
    label: "API key",
    visibleWhen: {
      key: "type",
      equals: "api-key",
    },
  },
  {
    key: "keyEnv",
    kind: "string",
    label: "API key env var",
    placeholder: "ANTHROPIC_API_KEY",
    visibleWhen: {
      key: "type",
      equals: "api-key",
    },
  },
  {
    key: "headerName",
    kind: "string",
    label: "Header name",
    description: "Defaults to authorization for bearer and x-api-key for API key auth.",
    visibleWhen: {
      key: "type",
      notEquals: "none",
    },
  },
];

export function createLlmProviderConfigDescriptor(): ConfigObjectDescriptor {
  return {
    fields: [
      {
        key: "headers",
        kind: "string-map",
        label: "Static headers",
        description: "Headers added to every outbound provider request.",
        keyLabel: "Header",
        valueLabel: "Value",
      },
      {
        key: "auth",
        kind: "object",
        label: "Authentication",
        fields: llmProviderAuthFields,
      },
      {
        key: "adapterConfig",
        kind: "object",
        label: "Adapter config",
        description: "Known adapter fields plus optional vendor-specific extras.",
        fields: [
          {
            key: "anthropicVersion",
            kind: "string",
            label: "Anthropic version",
            description: "Used by Anthropics-compatible requests when not supplied by the client.",
            placeholder: "2023-06-01",
          },
        ],
        additionalProperties: true,
      },
    ],
  };
}

export const llmRouterClientOptions = [
  { label: "Auto", value: "auto" },
  ...LLM_CLIENT_PROFILES.map((profile) => ({
    label: profile,
    value: profile,
  })),
];
