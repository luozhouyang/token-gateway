import { randomUUID } from "node:crypto";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface AppLogger {
  level: LogLevel;
  scope: string;
  child(scope: string): AppLogger;
  isLevelEnabled(level: LogLevel): boolean;
  debug(message: string, fields?: Record<string, unknown>): void;
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export function normalizeLogLevel(level?: string | null): LogLevel {
  const candidate = (level ||
    process.env.TOKEN_GATEWAY_LOG_LEVEL ||
    process.env.LOG_LEVEL ||
    "info") as string;

  switch (candidate.toLowerCase()) {
    case "debug":
      return "debug";
    case "info":
      return "info";
    case "warn":
      return "warn";
    case "error":
      return "error";
    default:
      return "info";
  }
}

export function createLogger(options?: { scope?: string; level?: string | null }): AppLogger {
  const scope = options?.scope || "app";
  const level = normalizeLogLevel(options?.level);

  function isLevelEnabled(targetLevel: LogLevel) {
    return LOG_LEVEL_PRIORITY[targetLevel] >= LOG_LEVEL_PRIORITY[level];
  }

  function emit(targetLevel: LogLevel, message: string, fields?: Record<string, unknown>) {
    if (!isLevelEnabled(targetLevel)) {
      return;
    }

    const payload = JSON.stringify({
      timestamp: new Date().toISOString(),
      level: targetLevel,
      scope,
      message,
      ...serializeFields(fields),
    });

    if (targetLevel === "warn") {
      console.warn(payload);
      return;
    }

    if (targetLevel === "error") {
      console.error(payload);
      return;
    }

    console.log(payload);
  }

  return {
    level,
    scope,
    child(childScope: string) {
      return createLogger({
        scope: `${scope}:${childScope}`,
        level,
      });
    },
    isLevelEnabled,
    debug(message: string, fields?: Record<string, unknown>) {
      emit("debug", message, fields);
    },
    info(message: string, fields?: Record<string, unknown>) {
      emit("info", message, fields);
    },
    warn(message: string, fields?: Record<string, unknown>) {
      emit("warn", message, fields);
    },
    error(message: string, fields?: Record<string, unknown>) {
      emit("error", message, fields);
    },
  };
}

export function getRequestId(source: Request | Headers): string {
  const headers = source instanceof Request ? source.headers : source;
  return headers.get("x-request-id") || randomUUID();
}

function serializeFields(fields?: Record<string, unknown>): Record<string, unknown> {
  if (!fields) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, serializeValue(value)]),
  );
}

function serializeValue(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  if (value instanceof URL) {
    return value.toString();
  }

  if (value instanceof Headers) {
    return Object.fromEntries(value.entries());
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeValue(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        serializeValue(item),
      ]),
    );
  }

  return value;
}
