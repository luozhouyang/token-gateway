import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
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
  DetailField,
  DetailSection,
  JsonPreview,
  TagList,
} from "@/components/resources/DetailSection";
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
  formatTimestamp,
  getErrorMessage,
  joinCommaSeparated,
  parseCommaSeparatedInput,
  parseJsonInput,
  stringifyJson,
} from "@/lib/dashboard-utils";
import { formatConsumerName } from "@/lib/resource-display";
import { toast } from "sonner";
import { ArrowLeft, Pencil, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/plugins/$pluginId")({
  component: PluginDetailPage,
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

function PluginDetailPage() {
  const { pluginId } = Route.useParams();
  const { settings } = useDashboardSettings();
  const [plugin, setPlugin] = useState<Plugin | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [routes, setRoutes] = useState<RouteConfig[]>([]);
  const [consumers, setConsumers] = useState<Consumer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formState, setFormState] = useState<PluginFormState>(EMPTY_FORM);

  useEffect(() => {
    void loadData();
  }, [pluginId]);

  async function loadData(isRefresh = false) {
    try {
      setError(null);

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const [loadedPlugin, loadedServices, loadedRoutes, loadedConsumers] = await Promise.all([
        pluginsApi.get(pluginId),
        servicesApi.list(),
        routesApi.list(),
        consumersApi.list(),
      ]);

      setPlugin(loadedPlugin);
      setServices(loadedServices);
      setRoutes(loadedRoutes);
      setConsumers(loadedConsumers);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Failed to load plugin"));
      setPlugin(null);
      setServices([]);
      setRoutes([]);
      setConsumers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function openEditDialog() {
    if (!plugin) {
      return;
    }

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
    if (!plugin) {
      return;
    }

    try {
      setSaving(true);

      await pluginsApi.update(plugin.id, {
        name: formState.name.trim(),
        serviceId: formState.serviceId || undefined,
        routeId: formState.routeId || undefined,
        consumerId: formState.consumerId || undefined,
        config: parseJsonInput<Record<string, unknown>>(formState.config, "Plugin config"),
        enabled: formState.enabled,
        tags: parseCommaSeparatedInput(formState.tags),
      });

      toast.success("Plugin updated");
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

  const serviceById = useMemo(
    () => new Map(services.map((service) => [service.id, service])),
    [services],
  );
  const routeById = useMemo(() => new Map(routes.map((route) => [route.id, route])), [routes]);
  const consumerById = useMemo(
    () => new Map(consumers.map((consumer) => [consumer.id, consumer])),
    [consumers],
  );

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading plugin…</div>
      </div>
    );
  }

  if (!plugin) {
    return (
      <div className="space-y-6">
        <Link
          to="/plugins"
          className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to plugins
        </Link>

        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">Unable to load plugin</CardTitle>
            <CardDescription>{error || "Plugin not found"}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const linkedService = plugin.serviceId ? serviceById.get(plugin.serviceId) : null;
  const linkedRoute = plugin.routeId ? routeById.get(plugin.routeId) : null;
  const linkedConsumer = plugin.consumerId ? consumerById.get(plugin.consumerId) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <Link
            to="/plugins"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to plugins
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{plugin.name}</h1>
            <p className="text-sm text-muted-foreground">
              Plugin binding details, scope targets, and configuration.
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
            Edit Plugin
          </Button>
        </div>
      </div>

      {error ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">Unable to refresh plugin</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <DetailSection title="Overview" description="Binding scope and execution state.">
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <DetailField label="Name" value={plugin.name} />
          <DetailField label="Status" value={(plugin.enabled ?? true) ? "Enabled" : "Disabled"} />
          <DetailField
            label="Scope"
            value={buildScopeLabel([
              plugin.serviceId ? `service:${linkedService?.name || plugin.serviceId}` : null,
              plugin.routeId ? `route:${linkedRoute?.name || plugin.routeId}` : null,
              plugin.consumerId
                ? `consumer:${linkedConsumer ? formatConsumerName(linkedConsumer) : plugin.consumerId}`
                : null,
            ])}
          />
          <DetailField
            label="Created"
            value={formatTimestamp(plugin.createdAt, settings.showRelativeTimes)}
          />
          <DetailField
            label="Updated"
            value={formatTimestamp(plugin.updatedAt, settings.showRelativeTimes)}
          />
          <div className="space-y-1 md:col-span-2 xl:col-span-1">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Tags
            </div>
            <TagList tags={plugin.tags} />
          </div>
        </div>
      </DetailSection>

      <DetailSection
        title="Scope Targets"
        description="Resources this plugin is directly bound to."
      >
        <div className="grid gap-6 md:grid-cols-3">
          <DetailField
            label="Service"
            value={
              plugin.serviceId ? (
                linkedService ? (
                  <Link
                    to="/services/$serviceId"
                    params={{ serviceId: linkedService.id }}
                    className="underline-offset-4 hover:underline"
                  >
                    {linkedService.name}
                  </Link>
                ) : (
                  plugin.serviceId
                )
              ) : (
                "Global"
              )
            }
          />
          <DetailField
            label="Route"
            value={
              plugin.routeId ? (
                linkedRoute ? (
                  <Link
                    to="/routes/$routeId"
                    params={{ routeId: linkedRoute.id }}
                    className="underline-offset-4 hover:underline"
                  >
                    {linkedRoute.name}
                  </Link>
                ) : (
                  plugin.routeId
                )
              ) : (
                "Global"
              )
            }
          />
          <DetailField
            label="Consumer"
            value={
              plugin.consumerId ? (
                linkedConsumer ? (
                  <Link
                    to="/consumers/$consumerId"
                    params={{ consumerId: linkedConsumer.id }}
                    className="underline-offset-4 hover:underline"
                  >
                    {formatConsumerName(linkedConsumer)}
                  </Link>
                ) : (
                  plugin.consumerId
                )
              ) : (
                "Global"
              )
            }
          />
        </div>
      </DetailSection>

      <DetailSection title="Config" description="JSON configuration stored on this plugin binding.">
        <JsonPreview value={plugin.config || {}} emptyLabel="No plugin config provided." />
      </DetailSection>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit plugin</DialogTitle>
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
                      {formatConsumerName(consumer)}
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
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
