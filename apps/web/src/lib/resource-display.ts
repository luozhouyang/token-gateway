import type { Consumer, Service } from "@/lib/api/client";

export function formatServiceEndpoint(service: Pick<Service, "url" | "host" | "port" | "path">) {
  if (service.url) {
    return service.url;
  }

  const host = service.host || "localhost";
  const port = service.port ? `:${service.port}` : "";
  const path = service.path || "";

  return `${host}${port}${path}`;
}

export function formatConsumerName(consumer: Pick<Consumer, "id" | "username" | "customId">) {
  return consumer.username || consumer.customId || consumer.id;
}
