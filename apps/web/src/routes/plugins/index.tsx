import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
import {
  consumersApi,
  pluginsApi,
  routesApi,
  servicesApi,
  type Consumer,
  type Plugin,
  type Route as RouteConfig,
  type Service,
} from "@/lib/api/client";
import { useDashboardSettings } from "@/lib/dashboard-settings";
import {
  buildScopeLabel,
  confirmAction,
  formatTimestamp,
  getErrorMessage,
  joinCommaSeparated,
  parseCommaSeparatedInput,
  parseJsonInput,
  previewJson,
  stringifyJson,
} from "@/lib/dashboard-utils";
import { toast } from "sonner";
import {
  Pencil,
  Plug,
  Plus,
  RefreshCw,
  Search,
  ToggleLeft,
  ToggleRight,
  Trash2,
} from "lucide-react";

export const Route = createFileRoute("/plugins/")({
  component: PluginsPage,
});

interface PluginFormState {
  name: string;
  serviceId: string;
  routeId: string;
  consumerId: string;
  config: string;
  enabled: boolean;
  tags: string;
}

const EMPTY_FORM: PluginFormState = {
  name: "",
  serviceId: "",
  routeId: "",
  consumerId: "",
  config: "{}",
  enabled: true,
  tags: "",
};

function PluginsPage() {
  const { settings } = useDashboardSettings();
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [routes, setRoutes] = useState<RouteConfig[]>([]);
  const [consumers, setConsumers] = useState<Consumer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlugin, setEditingPlugin] = useState<Plugin | null>(null);
  const [formState, setFormState] = useState<PluginFormState>(EMPTY_FORM);

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

      const [pluginList, serviceList, routeList, consumerList] = await Promise.all([
        pluginsApi.list(),
        servicesApi.list(),
        routesApi.list(),
        consumersApi.list(),
      ]);

      setPlugins(pluginList);
      setServices(serviceList);
      setRoutes(routeList);
      setConsumers(consumerList);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Failed to load plugins"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function openCreateDialog() {
    setEditingPlugin(null);
    setFormState(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEditDialog(plugin: Plugin) {
    setEditingPlugin(plugin);
    setFormState({
      name: plugin.name,
      serviceId: plugin.serviceId || "",
      routeId: plugin.routeId || "",
      consumerId: plugin.consumerId || "",
      config: stringifyJson(plugin.config || {}),
      enabled: plugin.enabled ?? true,
      tags: joinCommaSeparated(plugin.tags),
    });
    setDialogOpen(true);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setSaving(true);

      const payload: Partial<Plugin> = {
        name: formState.name.trim(),
        serviceId: formState.serviceId || undefined,
        routeId: formState.routeId || undefined,
        consumerId: formState.consumerId || undefined,
        config: parseJsonInput<Record<string, unknown>>(formState.config, "Plugin config"),
        enabled: formState.enabled,
        tags: parseCommaSeparatedInput(formState.tags),
      };

      if (editingPlugin) {
        await pluginsApi.update(editingPlugin.id, payload);
        toast.success("Plugin updated");
      } else {
        await pluginsApi.create(payload);
        toast.success("Plugin created");
      }

      setDialogOpen(false);
      await loadData(true);
    } catch (saveError) {
      toast.error("Failed to save plugin", {
        description: getErrorMessage(saveError),
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(plugin: Plugin) {
    const shouldDelete = await confirmAction(
      `Delete plugin "${plugin.name}"? This cannot be undone.`,
    );
    if (!shouldDelete) {
      return;
    }

    try {
      await pluginsApi.delete(plugin.id);
      toast.success("Plugin deleted");
      await loadData(true);
    } catch (deleteError) {
      toast.error("Failed to delete plugin", {
        description: getErrorMessage(deleteError),
      });
    }
  }

  async function handleToggleEnabled(plugin: Plugin) {
    try {
      await pluginsApi.update(plugin.id, {
        enabled: !(plugin.enabled ?? true),
      });
      toast.success(plugin.enabled ? "Plugin disabled" : "Plugin enabled");
      await loadData(true);
    } catch (toggleError) {
      toast.error("Failed to update plugin", {
        description: getErrorMessage(toggleError),
      });
    }
  }

  const serviceNameById = useMemo(
    () => new Map(services.map((item) => [item.id, item.name])),
    [services],
  );
  const routeNameById = useMemo(
    () => new Map(routes.map((item) => [item.id, item.name])),
    [routes],
  );
  const consumerNameById = useMemo(
    () => new Map(consumers.map((item) => [item.id, item.username || item.customId || item.id])),
    [consumers],
  );

  const filteredPlugins = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return plugins;
    }

    return plugins.filter((plugin) => {
      const haystack = [
        plugin.name,
        plugin.serviceId ? serviceNameById.get(plugin.serviceId) : "",
        plugin.routeId ? routeNameById.get(plugin.routeId) : "",
        plugin.consumerId ? consumerNameById.get(plugin.consumerId) : "",
        joinCommaSeparated(plugin.tags),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [consumerNameById, plugins, routeNameById, searchQuery, serviceNameById]);

  const enabledPlugins = plugins.filter((plugin) => plugin.enabled ?? true).length;
  const scopedPlugins = plugins.filter(
    (plugin) => plugin.serviceId || plugin.routeId || plugin.consumerId,
  ).length;

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading plugins…</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Plugins</h1>
          <p className="text-sm text-muted-foreground">
            Configure policies and middleware for services, routes, consumers, or globally.
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
            Add Plugin
          </Button>
        </div>
      </div>

      {error ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">Unable to load plugins</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Total plugins"
          value={plugins.length}
          description="All installed plugins"
        />
        <MetricCard
          label="Enabled"
          value={enabledPlugins}
          description="Currently active policies"
        />
        <MetricCard
          label="Scoped"
          value={scopedPlugins}
          description="Bound to a route, service, or consumer"
        />
      </div>

      <Card>
        <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Plugin bindings</CardTitle>
            <CardDescription>
              {filteredPlugins.length} of {plugins.length} plugins shown
            </CardDescription>
          </div>
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by name, scope, or tag"
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {filteredPlugins.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
              <p className="text-sm font-medium text-foreground">No plugins matched</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Adjust the search query or create a new plugin.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plugin</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Config</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="w-[160px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPlugins.map((plugin) => (
                  <TableRow key={plugin.id}>
                    <TableCell>
                      <Link
                        to="/plugins/$pluginId"
                        params={{ pluginId: plugin.id }}
                        className="font-medium text-foreground underline-offset-4 hover:underline"
                      >
                        {plugin.name}
                      </Link>
                      {plugin.tags?.length ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {plugin.tags.map((tag) => (
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
                      {buildScopeLabel([
                        plugin.serviceId
                          ? `service:${serviceNameById.get(plugin.serviceId) || plugin.serviceId}`
                          : null,
                        plugin.routeId
                          ? `route:${routeNameById.get(plugin.routeId) || plugin.routeId}`
                          : null,
                        plugin.consumerId
                          ? `consumer:${consumerNameById.get(plugin.consumerId) || plugin.consumerId}`
                          : null,
                      ])}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {previewJson(plugin.config || {}, 120)}
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => void handleToggleEnabled(plugin)}
                        className="inline-flex items-center gap-2 text-sm font-medium text-foreground"
                      >
                        {(plugin.enabled ?? true) ? (
                          <ToggleRight className="h-5 w-5 text-emerald-600" />
                        ) : (
                          <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                        )}
                        {(plugin.enabled ?? true) ? "Enabled" : "Disabled"}
                      </button>
                    </TableCell>
                    <TableCell>
                      {formatTimestamp(plugin.updatedAt, settings.showRelativeTimes)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(plugin)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => void handleDelete(plugin)}
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
            <DialogTitle>{editingPlugin ? "Edit plugin" : "Create plugin"}</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="plugin-name">Name</Label>
              <Input
                id="plugin-name"
                value={formState.name}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="rate-limit"
                required
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="plugin-service">Service scope</Label>
                <Select
                  id="plugin-service"
                  value={formState.serviceId}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, serviceId: event.target.value }))
                  }
                >
                  <option value="">Global</option>
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="plugin-route">Route scope</Label>
                <Select
                  id="plugin-route"
                  value={formState.routeId}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, routeId: event.target.value }))
                  }
                >
                  <option value="">Global</option>
                  {routes.map((route) => (
                    <option key={route.id} value={route.id}>
                      {route.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="plugin-consumer">Consumer scope</Label>
                <Select
                  id="plugin-consumer"
                  value={formState.consumerId}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, consumerId: event.target.value }))
                  }
                >
                  <option value="">Global</option>
                  {consumers.map((consumer) => (
                    <option key={consumer.id} value={consumer.id}>
                      {consumer.username || consumer.customId || consumer.id}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <label className="flex items-center gap-3 rounded-lg border border-border px-4 py-3">
              <input
                type="checkbox"
                checked={formState.enabled}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, enabled: event.target.checked }))
                }
                className="h-4 w-4 rounded border-input"
              />
              <div>
                <p className="text-sm font-medium text-foreground">Plugin enabled</p>
                <p className="text-xs text-muted-foreground">
                  Disabled plugins remain stored but do not execute.
                </p>
              </div>
            </label>

            <div className="space-y-2">
              <Label htmlFor="plugin-config">Config JSON</Label>
              <textarea
                id="plugin-config"
                value={formState.config}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, config: event.target.value }))
                }
                className="min-h-40 w-full rounded-lg border border-input bg-transparent px-3 py-2 font-mono text-sm text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder='{"minute": 100}'
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="plugin-tags">Tags</Label>
              <Input
                id="plugin-tags"
                value={formState.tags}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, tags: event.target.value }))
                }
                placeholder="security, production"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {editingPlugin ? "Save Changes" : "Create Plugin"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
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
        <Plug className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold">{props.value}</div>
      </CardContent>
    </Card>
  );
}
