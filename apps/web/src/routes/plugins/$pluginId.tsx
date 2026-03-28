import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ConfigFormRenderer, StructuredObjectField } from "@/components/configs/ConfigFormRenderer";
import { ConfigValuePreview } from "@/components/configs/ConfigValuePreview";
import { PageHeader } from "@/components/layout/PageHeader";
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
import { Switch } from "@/components/ui/switch";
import { DetailField, DetailSection, TagList } from "@/components/resources/DetailSection";
import {
  consumersApi,
  pluginsApi,
  routesApi,
  servicesApi,
  type Consumer,
  type Plugin,
  type PluginDefinitionSummary,
  type Route as RouteConfig,
  type Service,
} from "@/lib/api/client";
import { normalizeStructuredObjectInputOrEmpty } from "@/lib/configs/resource-config";
import { useDashboardSettings } from "@/lib/dashboard-settings";
import {
  buildScopeLabel,
  formatTimestamp,
  getErrorMessage,
  joinCommaSeparated,
  parseCommaSeparatedInput,
} from "@/lib/dashboard-utils";
import { formatConsumerName } from "@/lib/resource-display";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Plug, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/plugins/$pluginId")({
  component: PluginDetailPage,
});

interface PluginFormState {
  name: string;
  serviceId: string;
  routeId: string;
  consumerId: string;
  config: Record<string, unknown>;
  enabled: boolean;
  tags: string;
}

const EMPTY_FORM: PluginFormState = {
  name: "",
  serviceId: "",
  routeId: "",
  consumerId: "",
  config: {},
  enabled: true,
  tags: "",
};

function PluginDetailPage() {
  const { pluginId } = Route.useParams();
  const { settings } = useDashboardSettings();
  const [plugin, setPlugin] = useState<Plugin | null>(null);
  const [pluginDefinitions, setPluginDefinitions] = useState<PluginDefinitionSummary[]>([]);
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

      const [loadedPlugin, loadedDefinitions, loadedServices, loadedRoutes, loadedConsumers] =
        await Promise.all([
          pluginsApi.get(pluginId),
          pluginsApi.listDefinitions(),
          servicesApi.list(),
          routesApi.list(),
          consumersApi.list(),
        ]);

      setPlugin(loadedPlugin);
      setPluginDefinitions(loadedDefinitions);
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
      config: plugin.config || {},
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
        config: normalizeStructuredObjectInputOrEmpty(formState.config),
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
  const currentDefinition = useMemo(
    () =>
      plugin
        ? (pluginDefinitions.find((definition) => definition.name === plugin.name) ?? null)
        : null,
    [plugin, pluginDefinitions],
  );
  const selectedDefinition = pluginDefinitions.find(
    (definition) => definition.name === formState.name.trim(),
  );
  const selectedPluginValue = selectedDefinition
    ? selectedDefinition.name
    : formState.name.trim().length > 0
      ? "__custom__"
      : "";

  function handlePluginSelectionChange(value: string) {
    if (value === "__custom__") {
      setFormState((current) => ({
        ...current,
        name:
          current.name && !pluginDefinitions.some((item) => item.name === current.name)
            ? current.name
            : "",
        config: {},
      }));
      return;
    }

    setFormState((current) => ({
      ...current,
      name: value,
      config: {},
    }));
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading plugin…</div>
      </div>
    );
  }

  if (!plugin) {
    return (
      <div className="page-enter page-stack">
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
    <div className="page-enter page-stack">
      <Link
        to="/plugins"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to plugins
      </Link>
      <PageHeader
        eyebrow="Plugin Detail"
        title={plugin.name}
        description="Plugin binding details, scope targets, and configuration."
        icon={Plug}
        meta={
          <>
            <span>{(plugin.enabled ?? true) ? "Enabled" : "Disabled"}</span>
            <span>
              {buildScopeLabel([
                plugin.serviceId ? `service:${linkedService?.name || plugin.serviceId}` : null,
                plugin.routeId ? `route:${linkedRoute?.name || plugin.routeId}` : null,
                plugin.consumerId
                  ? `consumer:${linkedConsumer ? formatConsumerName(linkedConsumer) : plugin.consumerId}`
                  : null,
              ])}
            </span>
            <span>Updated {formatTimestamp(plugin.updatedAt, settings.showRelativeTimes)}</span>
          </>
        }
        actions={
          <>
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
          </>
        }
      />

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

      <DetailSection
        title="Config"
        description="Structured plugin configuration stored on this binding."
      >
        <ConfigValuePreview
          descriptor={currentDefinition?.configDescriptor}
          value={plugin.config || {}}
          emptyLabel="No plugin config provided."
          showRawJson
        />
      </DetailSection>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit plugin</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="plugin-name-select">Plugin</Label>
              <Select
                id="plugin-name-select"
                value={selectedPluginValue}
                onChange={(event) => handlePluginSelectionChange(event.target.value)}
              >
                <option value="">Select plugin</option>
                {pluginDefinitions.map((definition) => (
                  <option key={definition.name} value={definition.name}>
                    {definition.displayName}
                  </option>
                ))}
                <option value="__custom__">Custom plugin</option>
              </Select>
            </div>

            {selectedPluginValue === "__custom__" ? (
              <div className="space-y-2">
                <Label htmlFor="plugin-name">Plugin name</Label>
                <Input
                  id="plugin-name"
                  value={formState.name}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="my-company-plugin"
                  required
                />
              </div>
            ) : null}

            {selectedDefinition ? (
              <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
                <p className="text-sm font-medium text-foreground">
                  {selectedDefinition.displayName}
                </p>
                {selectedDefinition.description ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {selectedDefinition.description}
                  </p>
                ) : null}
              </div>
            ) : null}

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

            <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">Plugin enabled</p>
                <p className="text-xs text-muted-foreground">
                  Disabled plugins remain stored but do not execute.
                </p>
              </div>
              <Switch
                checked={formState.enabled}
                onCheckedChange={(checked) =>
                  setFormState((current) => ({ ...current, enabled: checked }))
                }
              />
            </div>

            {selectedDefinition?.configDescriptor ? (
              <ConfigFormRenderer
                fields={selectedDefinition.configDescriptor.fields}
                value={formState.config}
                onChange={(config) => setFormState((current) => ({ ...current, config }))}
                showAdvancedJson
                advancedJsonLabel="Advanced plugin config"
              />
            ) : formState.name.trim() ? (
              <StructuredObjectField
                label="Plugin config"
                description="Unknown plugins fall back to a generic object editor."
                value={formState.config}
                onChange={(config) => setFormState((current) => ({ ...current, config }))}
              />
            ) : (
              <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                Select a plugin to configure its fields.
              </div>
            )}

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
              <Button type="submit" disabled={saving || !formState.name.trim()}>
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
