import type {
  ConfigFieldDefinition,
  ConfigObjectDescriptor,
  ConfigObjectField,
} from "@/lib/configs/types";

export function ensureRecord(value: unknown): Record<string, unknown> {
  if (!isPlainObject(value)) {
    return {};
  }

  return { ...value };
}

export function ensureStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => toPrimitiveString(item));
}

export function ensureNumberList(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "number" ? item : Number(item)))
    .filter((item) => Number.isFinite(item));
}

export function ensureStringMap(value: unknown): Record<string, string> {
  const record = ensureRecord(value);
  return Object.fromEntries(
    Object.entries(record)
      .filter(([key]) => key.trim().length > 0)
      .map(([key, item]) => [key, toPrimitiveString(item)]),
  );
}

export function isFieldVisible(
  field: ConfigFieldDefinition,
  rootValue: Record<string, unknown>,
): boolean {
  if (!field.visibleWhen) {
    return true;
  }

  const actual = rootValue[field.visibleWhen.key];
  if (field.visibleWhen.equals !== undefined && actual !== field.visibleWhen.equals) {
    return false;
  }

  if (field.visibleWhen.notEquals !== undefined && actual === field.visibleWhen.notEquals) {
    return false;
  }

  return true;
}

export function createDefaultValueForField(field: ConfigFieldDefinition): unknown {
  switch (field.kind) {
    case "string":
      return "";
    case "number":
      return undefined;
    case "boolean":
      return false;
    case "select":
      return field.options[0]?.value ?? "";
    case "string-list":
    case "number-list":
      return [];
    case "string-map":
    case "object":
      return {};
  }
}

export function createDefaultObjectFromDescriptor(
  descriptor: ConfigObjectDescriptor | ConfigObjectField,
): Record<string, unknown> {
  return Object.fromEntries(
    descriptor.fields?.map((field) => [field.key, createDefaultValueForField(field)]) ?? [],
  );
}

export function splitObjectByKnownFields(
  value: Record<string, unknown>,
  fields: ConfigFieldDefinition[],
): {
  known: Record<string, unknown>;
  additional: Record<string, unknown>;
} {
  const knownKeys = new Set(fields.map((field) => field.key));
  const known: Record<string, unknown> = {};
  const additional: Record<string, unknown> = {};

  for (const [key, item] of Object.entries(value)) {
    if (knownKeys.has(key)) {
      known[key] = item;
      continue;
    }

    additional[key] = item;
  }

  return {
    known,
    additional,
  };
}

export function pruneConfigValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => pruneConfigValue(item)).filter((item) => item !== undefined);
  }

  if (isPlainObject(value)) {
    const entries = Object.entries(value)
      .filter(([key]) => key.trim().length > 0)
      .map(([key, item]) => [key, pruneConfigValue(item)] as const)
      .filter(([, item]) => item !== undefined);
    return Object.fromEntries(entries);
  }

  if (value === undefined) {
    return undefined;
  }

  return value;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
