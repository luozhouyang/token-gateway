import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ScopedPluginDialog,
  type ScopedPluginTarget,
} from "@/components/plugins/ScopedPluginDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { servicesApi, type Service } from "@/lib/api/client";
import { useDashboardSettings } from "@/lib/dashboard-settings";
import {
  confirmAction,
  formatTimestamp,
  getErrorMessage,
  joinCommaSeparated,
  parseCommaSeparatedInput,
  parseOptionalNumber,
} from "@/lib/dashboard-utils";
import { toast } from "sonner";
import { Pencil, Plus, Plug, RefreshCw, Search, Server, Trash2 } from "lucide-react";

export const Route = createFileRoute("/services/")({
  component: ServicesPage,
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

function ServicesPage() {
  const { settings } = useDashboardSettings();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [formState, setFormState] = useState<ServiceFormState>(EMPTY_FORM);
  const [pluginDialogOpen, setPluginDialogOpen] = useState(false);
  const [pluginTarget, setPluginTarget] = useState<ScopedPluginTarget | null>(null);

  useEffect(() => {
    void loadServices();
  }, []);

  async function loadServices(isRefresh = false) {
    try {
      setError(null);

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setServices(await servicesApi.list());
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Failed to load services"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function openCreateDialog() {
    setEditingService(null);
    setFormState(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEditDialog(service: Service) {
    setEditingService(service);
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
      tags: joinCommaSeparated(service.tags),
    });
    setDialogOpen(true);
  }

  function openAddPluginDialog(service: Service) {
    setPluginTarget({
      id: service.id,
      kind: "service",
      name: service.name,
    });
    setPluginDialogOpen(true);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setSaving(true);

      const payload: Partial<Service> = {
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
      };

      if (editingService) {
        await servicesApi.update(editingService.id, payload);
        toast.success("Service updated");
      } else {
        await servicesApi.create(payload);
        toast.success("Service created");
      }

      setDialogOpen(false);
      await loadServices(true);
    } catch (saveError) {
      toast.error("Failed to save service", {
        description: getErrorMessage(saveError),
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(service: Service) {
    const shouldDelete = await confirmAction(
      `Delete service "${service.name}"? This cannot be undone.`,
    );
    if (!shouldDelete) {
      return;
    }

    try {
      await servicesApi.delete(service.id);
      toast.success("Service deleted");
      await loadServices(true);
    } catch (deleteError) {
      toast.error("Failed to delete service", {
        description: getErrorMessage(deleteError),
      });
    }
  }

  const filteredServices = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return services;
    }

    return services.filter((service) => {
      const haystack = [
        service.name,
        service.url,
        service.host,
        service.path,
        joinCommaSeparated(service.tags),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [searchQuery, services]);

  const urlBackedServices = services.filter((service) => Boolean(service.url)).length;
  const taggedServices = services.filter((service) => (service.tags?.length || 0) > 0).length;

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading services…</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Services</h1>
          <p className="text-sm text-muted-foreground">
            Manage upstream destinations that routes and plugins depend on.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void loadServices(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button type="button" onClick={openCreateDialog}>
            <Plus className="h-4 w-4" />
            Add Service
          </Button>
        </div>
      </div>

      {error ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">Unable to load services</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          icon={Server}
          label="Total services"
          value={services.length}
          description="All configured upstream destinations"
        />
        <MetricCard
          icon={Server}
          label="URL based"
          value={urlBackedServices}
          description="Services using a direct URL"
        />
        <MetricCard
          icon={Search}
          label="Tagged"
          value={taggedServices}
          description="Services with management tags"
        />
      </div>

      <Card>
        <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Service inventory</CardTitle>
            <CardDescription>
              {filteredServices.length} of {services.length} services shown
            </CardDescription>
          </div>
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by name, host, URL, path, or tag"
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {filteredServices.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
              <p className="text-sm font-medium text-foreground">No services matched</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Adjust the search query or create a new service.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead>Endpoint</TableHead>
                  <TableHead>Timeouts</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="w-[220px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredServices.map((service) => (
                  <TableRow key={service.id}>
                    <TableCell>
                      <Link
                        to="/services/$serviceId"
                        params={{ serviceId: service.id }}
                        className="font-medium text-foreground underline-offset-4 hover:underline"
                      >
                        {service.name}
                      </Link>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Protocol: {service.protocol || "http"}
                      </div>
                      {service.tags?.length ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {service.tags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatServiceEndpoint(service)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div>Connect: {service.connectTimeout ?? "—"}ms</div>
                      <div>Write: {service.writeTimeout ?? "—"}ms</div>
                      <div>Read: {service.readTimeout ?? "—"}ms</div>
                      <div>Retries: {service.retries ?? 0}</div>
                    </TableCell>
                    <TableCell>
                      {formatTimestamp(service.updatedAt, settings.showRelativeTimes)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openAddPluginDialog(service)}
                        >
                          <Plug className="h-4 w-4" />
                          Add Plugin
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(service)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => void handleDelete(service)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingService ? "Edit service" : "Create service"}</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
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
                <Label htmlFor="url">URL</Label>
                <Input
                  id="url"
                  type="url"
                  value={formState.url}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, url: event.target.value }))
                  }
                  placeholder="http://localhost:8080"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="protocol">Protocol</Label>
                <Select
                  id="protocol"
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
                <Label htmlFor="host">Host</Label>
                <Input
                  id="host"
                  value={formState.host}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, host: event.target.value }))
                  }
                  placeholder="localhost"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="port">Port</Label>
                <Input
                  id="port"
                  type="number"
                  value={formState.port}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, port: event.target.value }))
                  }
                  placeholder="8080"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="path">Path</Label>
                <Input
                  id="path"
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
                <Label htmlFor="connectTimeout">Connect timeout</Label>
                <Input
                  id="connectTimeout"
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
                <Label htmlFor="writeTimeout">Write timeout</Label>
                <Input
                  id="writeTimeout"
                  type="number"
                  value={formState.writeTimeout}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, writeTimeout: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="readTimeout">Read timeout</Label>
                <Input
                  id="readTimeout"
                  type="number"
                  value={formState.readTimeout}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, readTimeout: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="retries">Retries</Label>
                <Input
                  id="retries"
                  type="number"
                  value={formState.retries}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, retries: event.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                value={formState.tags}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, tags: event.target.value }))
                }
                placeholder="internal, primary"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {editingService ? "Save Changes" : "Create Service"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ScopedPluginDialog
        open={pluginDialogOpen}
        onOpenChange={(open) => {
          setPluginDialogOpen(open);
          if (!open) {
            setPluginTarget(null);
          }
        }}
        target={pluginTarget}
      />
    </div>
  );
}

function MetricCard(props: {
  icon: typeof Server;
  label: string;
  value: number;
  description: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-sm">{props.label}</CardTitle>
          <CardDescription>{props.description}</CardDescription>
        </div>
        <props.icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold">{props.value}</div>
      </CardContent>
    </Card>
  );
}

function formatServiceEndpoint(service: Service): string {
  if (service.url) {
    return service.url;
  }

  if (!service.host) {
    return "No endpoint configured";
  }

  const port = service.port ? `:${service.port}` : "";
  return `${service.protocol || "http"}://${service.host}${port}${service.path || ""}`;
}
