import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PluginBindingsSection } from "@/components/plugins/PluginBindingsSection";
import { Button } from "@/components/ui/button";
import { DetailField, DetailSection, TagList } from "@/components/resources/DetailSection";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { routesApi, servicesApi, type Route as RouteConfig, type Service } from "@/lib/api/client";
import { useDashboardSettings } from "@/lib/dashboard-settings";
import {
  formatList,
  formatTimestamp,
  getErrorMessage,
  parseCommaSeparatedInput,
  parseOptionalNumber,
} from "@/lib/dashboard-utils";
import { formatServiceEndpoint } from "@/lib/resource-display";
import { toast } from "sonner";
import { ArrowLeft, Pencil, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/services/$serviceId")({
  component: ServiceDetailPage,
});

interface ServiceFormState {
  name: string;
  url: string;
  protocol: "http" | "https" | "grpc" | "grpcs";
  host: string;
  port: string;
  path: string;
  connectTimeout: string;
  writeTimeout: string;
  readTimeout: string;
  retries: string;
  tags: string;
}

const EMPTY_FORM: ServiceFormState = {
  name: "",
  url: "",
  protocol: "http",
  host: "",
  port: "",
  path: "",
  connectTimeout: "60000",
  writeTimeout: "60000",
  readTimeout: "60000",
  retries: "5",
  tags: "",
};

function ServiceDetailPage() {
  const { serviceId } = Route.useParams();
  const { settings } = useDashboardSettings();
  const [service, setService] = useState<Service | null>(null);
  const [relatedRoutes, setRelatedRoutes] = useState<RouteConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formState, setFormState] = useState<ServiceFormState>(EMPTY_FORM);

  useEffect(() => {
    void loadData();
  }, [serviceId]);

  async function loadData(isRefresh = false) {
    try {
      setError(null);

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const [loadedService, loadedRoutes] = await Promise.all([
        servicesApi.get(serviceId),
        routesApi.list({ serviceId }),
      ]);

      setService(loadedService);
      setRelatedRoutes(loadedRoutes);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Failed to load service"));
      setService(null);
      setRelatedRoutes([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function openEditDialog() {
    if (!service) {
      return;
    }

    setFormState({
      name: service.name,
      url: service.url || "",
      protocol: (service.protocol as ServiceFormState["protocol"]) || "http",
      host: service.host || "",
      port: service.port ? String(service.port) : "",
      path: service.path || "",
      connectTimeout: service.connectTimeout ? String(service.connectTimeout) : "",
      writeTimeout: service.writeTimeout ? String(service.writeTimeout) : "",
      readTimeout: service.readTimeout ? String(service.readTimeout) : "",
      retries: service.retries ? String(service.retries) : "",
      tags: service.tags?.join(", ") || "",
    });
    setDialogOpen(true);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!service) {
      return;
    }

    try {
      setSaving(true);

      await servicesApi.update(service.id, {
        name: formState.name.trim(),
        url: formState.url.trim() || undefined,
        protocol: formState.protocol,
        host: formState.host.trim() || undefined,
        port: parseOptionalNumber(formState.port),
        path: formState.path.trim() || undefined,
        connectTimeout: parseOptionalNumber(formState.connectTimeout),
        writeTimeout: parseOptionalNumber(formState.writeTimeout),
        readTimeout: parseOptionalNumber(formState.readTimeout),
        retries: parseOptionalNumber(formState.retries),
        tags: parseCommaSeparatedInput(formState.tags),
      });

      toast.success("Service updated");
      setDialogOpen(false);
      await loadData(true);
    } catch (saveError) {
      toast.error("Failed to save service", {
        description: getErrorMessage(saveError),
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading service…</div>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4">
          <Link
            to="/services"
            className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to services
          </Link>
        </div>

        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">Unable to load service</CardTitle>
            <CardDescription>{error || "Service not found"}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <Link
            to="/services"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to services
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{service.name}</h1>
            <p className="text-sm text-muted-foreground">
              Service details, related routes, and scoped plugins.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void loadData(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button type="button" onClick={openEditDialog}>
            <Pencil className="h-4 w-4" />
            Edit Service
          </Button>
        </div>
      </div>

      {error ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">Unable to refresh service</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <DetailSection title="Overview" description="Connection settings and runtime behavior.">
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <DetailField label="Endpoint" value={formatServiceEndpoint(service)} mono />
          <DetailField label="Protocol" value={service.protocol || "http"} />
          <DetailField label="Host" value={service.host || "—"} />
          <DetailField label="Port" value={service.port ?? "—"} />
          <DetailField label="Path" value={service.path || "—"} mono />
          <DetailField label="Retries" value={service.retries ?? 0} />
          <DetailField label="Connect timeout" value={`${service.connectTimeout ?? "—"} ms`} />
          <DetailField label="Write timeout" value={`${service.writeTimeout ?? "—"} ms`} />
          <DetailField label="Read timeout" value={`${service.readTimeout ?? "—"} ms`} />
          <DetailField
            label="Created"
            value={formatTimestamp(service.createdAt, settings.showRelativeTimes)}
          />
          <DetailField
            label="Updated"
            value={formatTimestamp(service.updatedAt, settings.showRelativeTimes)}
          />
          <div className="space-y-1">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Tags
            </div>
            <TagList tags={service.tags} />
          </div>
        </div>
      </DetailSection>

      <DetailSection title="Related Routes" description="Routes currently bound to this service.">
        {relatedRoutes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
            <p className="text-sm font-medium text-foreground">No routes attached</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Bind a route to this service to see it here.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Route</TableHead>
                <TableHead>Matchers</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {relatedRoutes.map((route) => (
                <TableRow key={route.id}>
                  <TableCell>
                    <Link
                      to="/routes/$routeId"
                      params={{ routeId: route.id }}
                      className="font-medium text-foreground underline-offset-4 hover:underline"
                    >
                      {route.name}
                    </Link>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Protocols: {formatList(route.protocols)}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    <div>Paths: {formatList(route.paths)}</div>
                    <div>Methods: {formatList(route.methods)}</div>
                    <div>Hosts: {formatList(route.hosts)}</div>
                  </TableCell>
                  <TableCell>
                    {formatTimestamp(route.updatedAt, settings.showRelativeTimes)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DetailSection>

      <PluginBindingsSection
        target={{
          id: service.id,
          kind: "service",
          name: service.name,
        }}
        title="Scoped Plugins"
        description="Plugins that run only for requests resolved to this service."
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit service</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="service-name">Name</Label>
              <Input
                id="service-name"
                value={formState.name}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="orders-service"
                required
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="service-url">URL</Label>
                <Input
                  id="service-url"
                  type="url"
                  value={formState.url}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, url: event.target.value }))
                  }
                  placeholder="http://localhost:8080"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="service-protocol">Protocol</Label>
                <Select
                  id="service-protocol"
                  value={formState.protocol}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      protocol: event.target.value as ServiceFormState["protocol"],
                    }))
                  }
                >
                  <option value="http">http</option>
                  <option value="https">https</option>
                  <option value="grpc">grpc</option>
                  <option value="grpcs">grpcs</option>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="service-host">Host</Label>
                <Input
                  id="service-host"
                  value={formState.host}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, host: event.target.value }))
                  }
                  placeholder="localhost"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="service-port">Port</Label>
                <Input
                  id="service-port"
                  type="number"
                  value={formState.port}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, port: event.target.value }))
                  }
                  placeholder="8080"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="service-path">Path</Label>
                <Input
                  id="service-path"
                  value={formState.path}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, path: event.target.value }))
                  }
                  placeholder="/api"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="service-connect-timeout">Connect timeout</Label>
                <Input
                  id="service-connect-timeout"
                  type="number"
                  value={formState.connectTimeout}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      connectTimeout: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="service-write-timeout">Write timeout</Label>
                <Input
                  id="service-write-timeout"
                  type="number"
                  value={formState.writeTimeout}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, writeTimeout: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="service-read-timeout">Read timeout</Label>
                <Input
                  id="service-read-timeout"
                  type="number"
                  value={formState.readTimeout}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, readTimeout: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="service-retries">Retries</Label>
                <Input
                  id="service-retries"
                  type="number"
                  value={formState.retries}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, retries: event.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="service-tags">Tags</Label>
              <Input
                id="service-tags"
                value={formState.tags}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, tags: event.target.value }))
                }
                placeholder="internal, critical"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
