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
import { routesApi, servicesApi, type Route as RouteConfig, type Service } from "@/lib/api/client";
import { useDashboardSettings } from "@/lib/dashboard-settings";
import {
  confirmAction,
  formatList,
  formatTimestamp,
  getErrorMessage,
  joinCommaSeparated,
  parseCommaSeparatedInput,
  parseJsonInput,
  parseOptionalNumber,
  stringifyJson,
} from "@/lib/dashboard-utils";
import { toast } from "sonner";
import { Pencil, Plus, Plug, RefreshCw, Route as RouteIcon, Search, Trash2 } from "lucide-react";

export const Route = createFileRoute("/routes/")({
  component: RoutesPage,
});

interface RouteFormState {
  name: string;
  serviceId: string;
  protocols: string;
  methods: string;
  hosts: string;
  paths: string;
  snis: string;
  sources: string;
  destinations: string;
  headers: string;
  stripPath: boolean;
  preserveHost: boolean;
  regexPriority: string;
  pathHandling: "v0" | "v1";
  tags: string;
}

const EMPTY_FORM: RouteFormState = {
  name: "",
  serviceId: "",
  protocols: "http, https",
  methods: "",
  hosts: "",
  paths: "",
  snis: "",
  sources: "",
  destinations: "",
  headers: "{}",
  stripPath: false,
  preserveHost: false,
  regexPriority: "0",
  pathHandling: "v0",
  tags: "",
};

function RoutesPage() {
  const { settings } = useDashboardSettings();
  const [routes, setRoutes] = useState<RouteConfig[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<RouteConfig | null>(null);
  const [formState, setFormState] = useState<RouteFormState>(EMPTY_FORM);
  const [pluginDialogOpen, setPluginDialogOpen] = useState(false);
  const [pluginTarget, setPluginTarget] = useState<ScopedPluginTarget | null>(null);

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData(isRefresh = false) {
    try {
      setError(null);

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const [loadedRoutes, loadedServices] = await Promise.all([
        routesApi.list(),
        servicesApi.list(),
      ]);

      setRoutes(loadedRoutes);
      setServices(loadedServices);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Failed to load routes"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function openCreateDialog() {
    setEditingRoute(null);
    setFormState(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEditDialog(route: RouteConfig) {
    setEditingRoute(route);
    setFormState({
      name: route.name,
      serviceId: route.serviceId || "",
      protocols: joinCommaSeparated(route.protocols),
      methods: joinCommaSeparated(route.methods),
      hosts: joinCommaSeparated(route.hosts),
      paths: joinCommaSeparated(route.paths),
      snis: joinCommaSeparated(route.snis),
      sources: joinCommaSeparated(route.sources),
      destinations: joinCommaSeparated(route.destinations),
      headers: stringifyJson(route.headers || {}),
      stripPath: route.stripPath ?? false,
      preserveHost: route.preserveHost ?? false,
      regexPriority: String(route.regexPriority ?? 0),
      pathHandling: (route.pathHandling as "v0" | "v1") || "v0",
      tags: joinCommaSeparated(route.tags),
    });
    setDialogOpen(true);
  }

  function openAddPluginDialog(route: RouteConfig) {
    setPluginTarget({
      id: route.id,
      kind: "route",
      name: route.name,
    });
    setPluginDialogOpen(true);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setSaving(true);

      const payload: Partial<RouteConfig> = {
        name: formState.name.trim(),
        serviceId: formState.serviceId || undefined,
        protocols: parseCommaSeparatedInput(formState.protocols),
        methods: parseCommaSeparatedInput(formState.methods, { uppercase: true }),
        hosts: parseCommaSeparatedInput(formState.hosts),
        paths: parseCommaSeparatedInput(formState.paths),
        snis: parseCommaSeparatedInput(formState.snis),
        sources: parseCommaSeparatedInput(formState.sources),
        destinations: parseCommaSeparatedInput(formState.destinations),
        headers: parseJsonInput<Record<string, string | string[]>>(formState.headers, "Headers"),
        stripPath: formState.stripPath,
        preserveHost: formState.preserveHost,
        regexPriority: parseOptionalNumber(formState.regexPriority),
        pathHandling: formState.pathHandling,
        tags: parseCommaSeparatedInput(formState.tags),
      };

      if (editingRoute) {
        await routesApi.update(editingRoute.id, payload);
        toast.success("Route updated");
      } else {
        await routesApi.create(payload);
        toast.success("Route created");
      }

      setDialogOpen(false);
      await loadData(true);
    } catch (saveError) {
      toast.error("Failed to save route", {
        description: getErrorMessage(saveError),
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(route: RouteConfig) {
    const shouldDelete = await confirmAction(
      `Delete route "${route.name}"? This cannot be undone.`,
    );
    if (!shouldDelete) {
      return;
    }

    try {
      await routesApi.delete(route.id);
      toast.success("Route deleted");
      await loadData(true);
    } catch (deleteError) {
      toast.error("Failed to delete route", {
        description: getErrorMessage(deleteError),
      });
    }
  }

  const serviceNameById = useMemo(() => {
    return new Map(services.map((service) => [service.id, service.name]));
  }, [services]);

  const filteredRoutes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return routes;
    }

    return routes.filter((route) => {
      const haystack = [
        route.name,
        route.serviceId ? serviceNameById.get(route.serviceId) : "",
        joinCommaSeparated(route.paths),
        joinCommaSeparated(route.methods),
        joinCommaSeparated(route.hosts),
        joinCommaSeparated(route.tags),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [routes, searchQuery, serviceNameById]);

  const attachedRoutes = routes.filter((route) => Boolean(route.serviceId)).length;
  const pathRoutes = routes.filter((route) => (route.paths?.length || 0) > 0).length;

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading routes…</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Routes</h1>
          <p className="text-sm text-muted-foreground">
            Define request matching rules and bind them to services.
          </p>
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
          <Button type="button" onClick={openCreateDialog}>
            <Plus className="h-4 w-4" />
            Add Route
          </Button>
        </div>
      </div>

      {error ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">Unable to load routes</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Total routes" value={routes.length} description="All request rules" />
        <MetricCard
          label="Attached services"
          value={attachedRoutes}
          description="Routes already bound to a service"
        />
        <MetricCard
          label="Path matches"
          value={pathRoutes}
          description="Routes matching by path prefixes"
        />
      </div>

      <Card>
        <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Routing rules</CardTitle>
            <CardDescription>
              {filteredRoutes.length} of {routes.length} routes shown
            </CardDescription>
          </div>
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by name, method, path, host, tag, or service"
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {filteredRoutes.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
              <p className="text-sm font-medium text-foreground">No routes matched</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Adjust the search query or create a new route.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Route</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Matchers</TableHead>
                  <TableHead>Flags</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="w-[220px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRoutes.map((route) => (
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
                      {route.tags?.length ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {route.tags.map((tag) => (
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
                      {route.serviceId ? (
                        <Link
                          to="/services/$serviceId"
                          params={{ serviceId: route.serviceId }}
                          className="underline-offset-4 hover:text-foreground hover:underline"
                        >
                          {serviceNameById.get(route.serviceId) || route.serviceId}
                        </Link>
                      ) : (
                        "Unbound"
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div>Paths: {formatList(route.paths)}</div>
                      <div>Methods: {formatList(route.methods)}</div>
                      <div>Hosts: {formatList(route.hosts)}</div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div>Strip path: {route.stripPath ? "Yes" : "No"}</div>
                      <div>Preserve host: {route.preserveHost ? "Yes" : "No"}</div>
                      <div>Priority: {route.regexPriority ?? 0}</div>
                    </TableCell>
                    <TableCell>
                      {formatTimestamp(route.updatedAt, settings.showRelativeTimes)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openAddPluginDialog(route)}
                        >
                          <Plug className="h-4 w-4" />
                          Add Plugin
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(route)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => void handleDelete(route)}
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
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingRoute ? "Edit route" : "Create route"}</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formState.name}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="orders-route"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="serviceId">Service</Label>
                <Select
                  id="serviceId"
                  value={formState.serviceId}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, serviceId: event.target.value }))
                  }
                >
                  <option value="">Unbound</option>
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field
                id="protocols"
                label="Protocols"
                value={formState.protocols}
                onChange={(value) => setFormState((current) => ({ ...current, protocols: value }))}
                placeholder="http, https"
              />
              <Field
                id="methods"
                label="Methods"
                value={formState.methods}
                onChange={(value) => setFormState((current) => ({ ...current, methods: value }))}
                placeholder="GET, POST"
              />
              <Field
                id="paths"
                label="Paths"
                value={formState.paths}
                onChange={(value) => setFormState((current) => ({ ...current, paths: value }))}
                placeholder="/orders, /health"
              />
              <Field
                id="hosts"
                label="Hosts"
                value={formState.hosts}
                onChange={(value) => setFormState((current) => ({ ...current, hosts: value }))}
                placeholder="api.example.com"
              />
              <Field
                id="snis"
                label="SNIs"
                value={formState.snis}
                onChange={(value) => setFormState((current) => ({ ...current, snis: value }))}
                placeholder="service.internal"
              />
              <Field
                id="sources"
                label="Sources"
                value={formState.sources}
                onChange={(value) => setFormState((current) => ({ ...current, sources: value }))}
                placeholder="10.0.0.0/24"
              />
              <Field
                id="destinations"
                label="Destinations"
                value={formState.destinations}
                onChange={(value) =>
                  setFormState((current) => ({ ...current, destinations: value }))
                }
                placeholder="192.168.1.10"
              />
              <div className="space-y-2">
                <Label htmlFor="regexPriority">Regex priority</Label>
                <Input
                  id="regexPriority"
                  type="number"
                  value={formState.regexPriority}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      regexPriority: event.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pathHandling">Path handling</Label>
                <Select
                  id="pathHandling"
                  value={formState.pathHandling}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      pathHandling: event.target.value as "v0" | "v1",
                    }))
                  }
                >
                  <option value="v0">v0</option>
                  <option value="v1">v1</option>
                </Select>
              </div>
              <Field
                id="tags"
                label="Tags"
                value={formState.tags}
                onChange={(value) => setFormState((current) => ({ ...current, tags: value }))}
                placeholder="public, priority"
              />
            </div>

            <div className="rounded-lg border border-border p-4">
              <p className="text-sm font-medium text-foreground">Booleans</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="flex items-center gap-3 rounded-lg border border-border px-4 py-3">
                  <input
                    type="checkbox"
                    checked={formState.stripPath}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        stripPath: event.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-input"
                  />
                  <span className="text-sm text-foreground">Strip path</span>
                </label>
                <label className="flex items-center gap-3 rounded-lg border border-border px-4 py-3">
                  <input
                    type="checkbox"
                    checked={formState.preserveHost}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        preserveHost: event.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-input"
                  />
                  <span className="text-sm text-foreground">Preserve host</span>
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="headers">Headers JSON</Label>
              <textarea
                id="headers"
                value={formState.headers}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, headers: event.target.value }))
                }
                className="min-h-32 w-full rounded-lg border border-input bg-transparent px-3 py-2 font-mono text-sm text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder='{"x-version": ["v1"]}'
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {editingRoute ? "Save Changes" : "Create Route"}
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

function MetricCard(props: { label: string; value: number; description: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-sm">{props.label}</CardTitle>
          <CardDescription>{props.description}</CardDescription>
        </div>
        <RouteIcon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold">{props.value}</div>
      </CardContent>
    </Card>
  );
}

function Field(props: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={props.id}>{props.label}</Label>
      <Input
        id={props.id}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        placeholder={props.placeholder}
      />
    </div>
  );
}
