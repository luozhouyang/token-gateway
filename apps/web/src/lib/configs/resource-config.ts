import type { LlmProviderAuthConfig } from "@/lib/api/client";
import { ensureRecord, pruneConfigValue } from "@/lib/configs/utils";

export function normalizeRouteHeadersInput(
  value: Record<string, unknown>,
): Record<string, string | string[]> | undefined {
  const next: Record<string, string | string[]> = {};

  for (const [key, item] of Object.entries(value)) {
    const normalizedKey = key.trim();
    if (!normalizedKey) {
      continue;
    }

    if (typeof item === "string") {
      next[normalizedKey] = item;
      continue;
    }

    if (Array.isArray(item)) {
      const normalizedValues = item
        .map((entry) => toPrimitiveString(entry))
        .filter((entry) => entry.length > 0);
      if (normalizedValues.length > 0) {
        next[normalizedKey] = normalizedValues;
      }
    }
  }

  return Object.keys(next).length > 0 ? next : undefined;
}

export function normalizeStructuredObjectInput(
  value: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const cleaned = pruneConfigValue(value);
  const normalized = ensureRecord(cleaned);
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function normalizeStructuredObjectInputOrEmpty(
  value: Record<string, unknown>,
): Record<string, unknown> {
  return normalizeStructuredObjectInput(value) ?? {};
}

export function normalizeStringRecordInput(value: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, item]) => [key.trim(), toPrimitiveString(item)])
      .filter(([key]) => key.length > 0),
  );
}

export function normalizeLlmProviderAuthInput(
  value: Record<string, unknown>,
): LlmProviderAuthConfig {
  const type =
    value.type === "bearer" || value.type === "api-key" || value.type === "none"
      ? value.type
      : "none";
  const headerName = normalizeOptionalString(value.headerName);

  if (type === "bearer") {
    return {
      type,
      token: normalizeOptionalString(value.token),
      tokenEnv: normalizeOptionalString(value.tokenEnv),
      headerName,
    };
  }

  if (type === "api-key") {
    return {
      type,
      key: normalizeOptionalString(value.key),
      keyEnv: normalizeOptionalString(value.keyEnv),
      headerName,
    };
  }

  return {
    type: "none",
  };
}

export function normalizeKeyAuthCredentialInput(
  value: Record<string, unknown>,
): Record<string, unknown> {
  return {
    key: normalizeOptionalString(value.key) ?? "",
  };
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function toPrimitiveString(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return "";
}
