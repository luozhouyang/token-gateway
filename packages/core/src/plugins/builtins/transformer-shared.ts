import type { ConfigFieldDefinition, ConfigObjectDescriptor } from "../config-descriptor.js";
import type { PluginContext } from "../types.js";
import { isJsonContentType, readJsonObject, writeJsonObject, writeBodyText } from "../runtime.js";

type NameListInput = string[] | null | undefined;
type MappingInput = string[] | Record<string, unknown> | null | undefined;

interface TransformerConfig {
  remove?: {
    headers?: NameListInput;
    querystring?: NameListInput;
    body?: NameListInput;
    json?: NameListInput;
  };
  rename?: {
    headers?: MappingInput;
    querystring?: MappingInput;
    body?: MappingInput;
    json?: MappingInput;
  };
  replace?: {
    uri?: string;
    path?: string;
    method?: string;
    headers?: MappingInput;
    querystring?: MappingInput;
    body?: MappingInput;
    json?: MappingInput;
  };
  add?: {
    headers?: MappingInput;
    querystring?: MappingInput;
    body?: MappingInput;
    json?: MappingInput;
  };
  append?: {
    headers?: MappingInput;
    querystring?: MappingInput;
    body?: MappingInput;
    json?: MappingInput;
  };
}

const TEMPLATE_DESCRIPTION =
  "Supports template expressions like $(request_id), $(headers.x-api-key), and $(query_params.user).";

const STRUCTURED_BODY_DESCRIPTION =
  "Values may be strings, numbers, booleans, arrays, or nested objects. String values also support templates.";

function createRemoveField(includeQuerystring: boolean): ConfigFieldDefinition {
  return {
    key: "remove",
    kind: "object",
    label: "Remove",
    description: "Delete fields before the request or response continues.",
    fields: [
      {
        key: "headers",
        kind: "string-list",
        label: "Headers",
        itemLabel: "Header name",
      },
      ...(includeQuerystring
        ? [
            {
              key: "querystring",
              kind: "string-list",
              label: "Query parameters",
              itemLabel: "Query parameter",
            } satisfies ConfigFieldDefinition,
          ]
        : []),
      {
        key: "body",
        kind: "string-list",
        label: "JSON body fields",
        itemLabel: "Field name",
      },
    ],
  };
}

function createRenameField(includeQuerystring: boolean): ConfigFieldDefinition {
  return {
    key: "rename",
    kind: "object",
    label: "Rename",
    description: "Rename existing fields while preserving their current values.",
    fields: [
      {
        key: "headers",
        kind: "string-map",
        label: "Header renames",
        keyLabel: "Current header",
        valueLabel: "New header",
      },
      ...(includeQuerystring
        ? [
            {
              key: "querystring",
              kind: "string-map",
              label: "Query parameter renames",
              keyLabel: "Current parameter",
              valueLabel: "New parameter",
            } satisfies ConfigFieldDefinition,
          ]
        : []),
      {
        key: "body",
        kind: "string-map",
        label: "JSON body renames",
        keyLabel: "Current field",
        valueLabel: "New field",
      },
    ],
  };
}

function createHeaderMapField(label: string): ConfigFieldDefinition {
  return {
    key: "headers",
    kind: "string-map",
    label,
    description: TEMPLATE_DESCRIPTION,
    keyLabel: "Header",
    valueLabel: "Value",
  };
}

function createQuerystringMapField(label: string): ConfigFieldDefinition {
  return {
    key: "querystring",
    kind: "string-map",
    label,
    description: TEMPLATE_DESCRIPTION,
    keyLabel: "Parameter",
    valueLabel: "Value",
  };
}

function createStructuredBodyField(label: string): ConfigFieldDefinition {
  return {
    key: "body",
    kind: "object",
    label,
    description: STRUCTURED_BODY_DESCRIPTION,
    additionalProperties: true,
  };
}

function createReplaceField(includeQuerystring: boolean): ConfigFieldDefinition {
  return {
    key: "replace",
    kind: "object",
    label: "Replace",
    description: "Replace existing values without creating missing keys.",
    fields: includeQuerystring
      ? [
          {
            key: "path",
            kind: "string",
            label: "Request path",
            description: TEMPLATE_DESCRIPTION,
            placeholder: "/v1/internal/$(uri_captures.model)",
          } satisfies ConfigFieldDefinition,
          {
            key: "method",
            kind: "string",
            label: "HTTP method",
            description: "Overrides the outbound request method.",
            placeholder: "POST",
          } satisfies ConfigFieldDefinition,
          createHeaderMapField("Header replacements"),
          createQuerystringMapField("Query parameter replacements"),
          createStructuredBodyField("JSON body replacements"),
        ]
      : [
          createHeaderMapField("Header replacements"),
          createStructuredBodyField("JSON body replacements"),
        ],
  };
}

function createAddField(includeQuerystring: boolean): ConfigFieldDefinition {
  return {
    key: "add",
    kind: "object",
    label: "Add",
    description: "Set values only when the target key does not already exist.",
    fields: [
      createHeaderMapField("Headers to add"),
      ...(includeQuerystring ? [createQuerystringMapField("Query parameters to add")] : []),
      createStructuredBodyField("JSON body fields to add"),
    ],
  };
}

function createAppendField(includeQuerystring: boolean): ConfigFieldDefinition {
  return {
    key: "append",
    kind: "object",
    label: "Append",
    description: "Append values to repeated fields such as headers, query parameters, or arrays.",
    fields: [
      createHeaderMapField("Headers to append"),
      ...(includeQuerystring ? [createQuerystringMapField("Query parameters to append")] : []),
      createStructuredBodyField("JSON body fields to append"),
    ],
  };
}

export const requestTransformerConfigDescriptor: ConfigObjectDescriptor = {
  fields: [
    createRemoveField(true),
    createRenameField(true),
    createReplaceField(true),
    createAddField(true),
    createAppendField(true),
  ],
};

export const responseTransformerConfigDescriptor: ConfigObjectDescriptor = {
  fields: [
    createRemoveField(false),
    createRenameField(false),
    createReplaceField(false),
    createAddField(false),
    createAppendField(false),
  ],
};

export function applyRequestTransformations(ctx: PluginContext): void {
  const config = ctx.config as TransformerConfig;
  const body = getMutableBody(ctx);

  removeHeaders(ctx, config.remove?.headers);
  removeQuerystring(ctx, config.remove?.querystring);
  removeJsonFields(ctx, body, config.remove?.body ?? config.remove?.json);

  renameHeaders(ctx, config.rename?.headers);
  renameQuerystring(ctx, config.rename?.querystring);
  renameJsonFields(ctx, body, config.rename?.body ?? config.rename?.json);

  replacePath(ctx, config.replace?.uri ?? config.replace?.path);
  replaceMethod(ctx, config.replace?.method);
  replaceHeaders(ctx, config.replace?.headers);
  replaceQuerystring(ctx, config.replace?.querystring);
  replaceJsonFields(ctx, body, config.replace?.body ?? config.replace?.json);

  addHeaders(ctx, config.add?.headers);
  addQuerystring(ctx, config.add?.querystring);
  addJsonFields(ctx, body, config.add?.body ?? config.add?.json);

  appendHeaders(ctx, config.append?.headers);
  appendQuerystring(ctx, config.append?.querystring);
  appendJsonFields(ctx, body, config.append?.body ?? config.append?.json);

  persistMutableBody(ctx, body);
}

export function applyResponseTransformations(ctx: PluginContext): void {
  const config = ctx.config as TransformerConfig;
  const body = getMutableBody(ctx);

  removeHeaders(ctx, config.remove?.headers, true);
  removeJsonFields(ctx, body, config.remove?.body ?? config.remove?.json);

  renameHeaders(ctx, config.rename?.headers, true);
  renameJsonFields(ctx, body, config.rename?.body ?? config.rename?.json);

  replaceHeaders(ctx, config.replace?.headers, true);
  replaceJsonFields(ctx, body, config.replace?.body ?? config.replace?.json);

  addHeaders(ctx, config.add?.headers, true);
  addJsonFields(ctx, body, config.add?.body ?? config.add?.json);

  appendHeaders(ctx, config.append?.headers, true);
  appendJsonFields(ctx, body, config.append?.body ?? config.append?.json);

  persistMutableBody(ctx, body);
}

function getMutableBody(ctx: PluginContext): Record<string, unknown> | null {
  const target = ctx.response ?? ctx.request;
  const contentType = target.headers.get("content-type");

  if (target.body === null) {
    return {};
  }

  if (contentType && !isJsonContentType(contentType)) {
    return null;
  }

  return readJsonObject(target.body);
}

function persistMutableBody(ctx: PluginContext, body: Record<string, unknown> | null): void {
  if (body === null) {
    return;
  }

  const target = ctx.response ?? ctx.request;
  writeJsonObject(target, body);
}

function replacePath(ctx: PluginContext, template?: string | null): void {
  if (!template) {
    return;
  }

  const nextPath = renderTemplate(template, ctx).trim();
  if (!nextPath) {
    return;
  }

  ctx.request.url.pathname = normalizePath(nextPath);
}

function replaceMethod(ctx: PluginContext, method?: string | null): void {
  if (!method) {
    return;
  }

  ctx.request.method = renderTemplate(method, ctx).trim().toUpperCase();
}

function removeHeaders(ctx: PluginContext, input: NameListInput, useResponse = false): void {
  if (!input) {
    return;
  }

  const headers = getHeadersTarget(ctx, useResponse);
  for (const rawName of input) {
    headers.delete(renderTemplate(rawName, ctx));
  }
}

function renameHeaders(ctx: PluginContext, input: MappingInput, useResponse = false): void {
  const headers = getHeadersTarget(ctx, useResponse);
  for (const [from, to] of parseMappings(input, ctx, false)) {
    const value = headers.get(from);
    if (value === null) {
      continue;
    }

    headers.delete(from);
    headers.set(String(to), value);
  }
}

function replaceHeaders(ctx: PluginContext, input: MappingInput, useResponse = false): void {
  const headers = getHeadersTarget(ctx, useResponse);
  for (const [name, value] of parseMappings(input, ctx, false)) {
    if (!headers.has(name)) {
      continue;
    }

    headers.set(name, String(value));
  }
}

function addHeaders(ctx: PluginContext, input: MappingInput, useResponse = false): void {
  const headers = getHeadersTarget(ctx, useResponse);
  for (const [name, value] of parseMappings(input, ctx, false)) {
    if (!headers.has(name)) {
      headers.set(name, String(value));
    }
  }
}

function appendHeaders(ctx: PluginContext, input: MappingInput, useResponse = false): void {
  const headers = getHeadersTarget(ctx, useResponse);
  for (const [name, value] of parseMappings(input, ctx, false)) {
    headers.append(name, String(value));
  }
}

function removeQuerystring(ctx: PluginContext, input: NameListInput): void {
  if (!input) {
    return;
  }

  for (const rawName of input) {
    ctx.request.url.searchParams.delete(renderTemplate(rawName, ctx));
  }
}

function renameQuerystring(ctx: PluginContext, input: MappingInput): void {
  for (const [from, to] of parseMappings(input, ctx, false)) {
    const values = ctx.request.url.searchParams.getAll(from);
    if (values.length === 0) {
      continue;
    }

    ctx.request.url.searchParams.delete(from);
    for (const value of values) {
      ctx.request.url.searchParams.append(String(to), value);
    }
  }
}

function replaceQuerystring(ctx: PluginContext, input: MappingInput): void {
  for (const [name, value] of parseMappings(input, ctx, false)) {
    if (!ctx.request.url.searchParams.has(name)) {
      continue;
    }

    ctx.request.url.searchParams.delete(name);
    ctx.request.url.searchParams.append(name, String(value));
  }
}

function addQuerystring(ctx: PluginContext, input: MappingInput): void {
  for (const [name, value] of parseMappings(input, ctx, false)) {
    if (!ctx.request.url.searchParams.has(name)) {
      ctx.request.url.searchParams.append(name, String(value));
    }
  }
}

function appendQuerystring(ctx: PluginContext, input: MappingInput): void {
  for (const [name, value] of parseMappings(input, ctx, false)) {
    ctx.request.url.searchParams.append(name, String(value));
  }
}

function removeJsonFields(
  ctx: PluginContext,
  body: Record<string, unknown> | null,
  input: NameListInput,
): void {
  if (!body || !input) {
    return;
  }

  for (const rawName of input) {
    delete body[renderTemplate(rawName, ctx)];
  }
}

function renameJsonFields(
  ctx: PluginContext,
  body: Record<string, unknown> | null,
  input: MappingInput,
): void {
  if (!body) {
    return;
  }

  for (const [from, to] of parseMappings(input, ctx, true)) {
    const toKey = String(to);
    if (!(from in body)) {
      continue;
    }

    body[toKey] = body[from];
    delete body[from];
  }
}

function replaceJsonFields(
  ctx: PluginContext,
  body: Record<string, unknown> | null,
  input: MappingInput,
): void {
  if (!body) {
    return;
  }

  for (const [name, value] of parseMappings(input, ctx, true)) {
    if (name in body) {
      body[name] = value;
    }
  }
}

function addJsonFields(
  ctx: PluginContext,
  body: Record<string, unknown> | null,
  input: MappingInput,
): void {
  if (!body) {
    return;
  }

  for (const [name, value] of parseMappings(input, ctx, true)) {
    if (!(name in body)) {
      body[name] = value;
    }
  }
}

function appendJsonFields(
  ctx: PluginContext,
  body: Record<string, unknown> | null,
  input: MappingInput,
): void {
  if (!body) {
    return;
  }

  for (const [name, value] of parseMappings(input, ctx, true)) {
    if (!(name in body)) {
      body[name] = value;
      continue;
    }

    const current = body[name];
    if (Array.isArray(current)) {
      current.push(value);
      continue;
    }

    body[name] = [current, value];
  }
}

function getHeadersTarget(ctx: PluginContext, useResponse: boolean): Headers {
  if (useResponse) {
    if (!ctx.response) {
      throw new Error("Response headers are not available in the current plugin phase");
    }

    return ctx.response.headers;
  }

  return ctx.request.headers;
}

function parseMappings(
  input: MappingInput,
  ctx: PluginContext,
  allowStructuredValue: boolean,
): Array<[string, unknown]> {
  if (!input) {
    return [];
  }

  if (Array.isArray(input)) {
    return input.flatMap((entry) => {
      const separatorIndex = entry.indexOf(":");
      if (separatorIndex === -1) {
        return [];
      }

      const rawName = entry.slice(0, separatorIndex);
      const rawValue = entry.slice(separatorIndex + 1);
      return [
        [
          renderTemplate(rawName, ctx),
          parseValue(renderTemplate(rawValue, ctx), allowStructuredValue),
        ],
      ];
    });
  }

  return Object.entries(input).map(([name, value]) => [
    renderTemplate(name, ctx),
    typeof value === "string"
      ? parseValue(renderTemplate(value, ctx), allowStructuredValue)
      : value,
  ]);
}

function parseValue(value: string, allowStructuredValue: boolean): unknown {
  if (!allowStructuredValue) {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

export function renderTemplate(value: string, ctx: PluginContext): string {
  return value.replaceAll(/\$\(([^)]+)\)/g, (_, expression: string) => {
    return resolveTemplateExpression(expression.trim(), ctx);
  });
}

function resolveTemplateExpression(expression: string, ctx: PluginContext): string {
  if (expression === "request_id") {
    return ctx.requestId;
  }

  const headerMatch = expression.match(/^headers(?:\.([A-Za-z0-9_-]+)|\[['"](.+?)['"]\])$/);
  if (headerMatch) {
    const headerName = headerMatch[1] || headerMatch[2];
    return ctx.clientRequest.headers.get(headerName) || "";
  }

  const queryMatch = expression.match(/^query_params(?:\.([A-Za-z0-9_-]+)|\[['"](.+?)['"]\])$/);
  if (queryMatch) {
    const queryName = queryMatch[1] || queryMatch[2];
    return ctx.clientRequest.url.searchParams.get(queryName) || "";
  }

  const captureMatch = expression.match(/^uri_captures(?:\.([A-Za-z0-9_-]+)|\[['"](.+?)['"]\])$/);
  if (captureMatch) {
    const captureKey = captureMatch[1] || captureMatch[2];
    return ctx.uriCaptures[captureKey] || "";
  }

  const sharedMatch = expression.match(/^shared(?:\.([A-Za-z0-9_-]+)|\[['"](.+?)['"]\])$/);
  if (sharedMatch) {
    const sharedKey = sharedMatch[1] || sharedMatch[2];
    const sharedValue = ctx.shared.get(sharedKey);
    if (sharedValue === undefined || sharedValue === null) {
      return "";
    }

    return typeof sharedValue === "string" ? sharedValue : JSON.stringify(sharedValue);
  }

  return "";
}

export function setBodyFromText(
  target: {
    body: ArrayBuffer | null;
    headers: Headers;
  },
  body: string,
  contentType: string,
): void {
  target.body = writeBodyText(body);
  target.headers.set("content-type", contentType);
  target.headers.delete("content-length");
}

function normalizePath(pathname: string): string {
  if (!pathname) {
    return "/";
  }

  return pathname.startsWith("/") ? pathname : `/${pathname}`;
}
