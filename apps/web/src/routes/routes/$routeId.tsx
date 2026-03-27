import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PluginBindingsSection } from "@/components/plugins/PluginBindingsSection";
import { Button } from "@/components/ui/button";
import {
  DetailField,
  DetailSection,
  JsonPreview,
  TagList,
} from "@/components/resources/DetailSection";
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
import { routesApi, servicesApi, type Route as RouteConfig, type Service } from "@/lib/api/client";
import { useDashboardSettings } from "@/lib/dashboard-settings";
import {
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
import { ArrowLeft, Pencil, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/routes/$routeId")({
  component: RouteDetailPage,
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

function RouteDetailPage() {
  const { routeId } = Route.useParams();
  const { settings } = useDashboardSettings();
  const [route, setRoute] = useState<RouteConfig | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formState, setFormState] = useState<RouteFormState>(EMPTY_FORM);

  useEffect(() => {
    void loadData();
  }, [routeId]);

  async function loadData(isRefresh = false) {
    try {
      setError(null);

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const [loadedRoute, loadedServices] = await Promise.all([
        routesApi.get(routeId),
        servicesApi.list(),
      ]);

      setRoute(loadedRoute);
      setServices(loadedServices);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Failed to load route"));
      setRoute(null);
      setServices([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function openEditDialog() {
    if (!route) {
      return;
    }

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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!route) {
      return;
    }

    try {
      setSaving(true);

      await routesApi.update(route.id, {
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
      });

      toast.success("Route updated");
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

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading route…</div>
      </div>
    );
  }

  if (!route) {
    return (
      <div className="space-y-6">
        <Link
          to="/routes"
          className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to routes
        </Link>

        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">Unable to load route</CardTitle>
            <CardDescription>{error || "Route not found"}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const linkedService = services.find((service) => service.id === route.serviceId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <Link
            to="/routes"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to routes
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{route.name}</h1>
            <p className="text-sm text-muted-foreground">
              Request matching rules, linked service, and scoped plugins.
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
            Edit Route
          </Button>
        </div>
      </div>

      {error ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">Unable to refresh route</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <DetailSection title="Overview" description="Route bindings and match conditions.">
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <DetailField
            label="Service"
            value={
              route.serviceId ? (
                linkedService ? (
                  <Link
                    to="/services/$serviceId"
                    params={{ serviceId: linkedService.id }}
                    className="underline-offset-4 hover:underline"
                  >
                    {linkedService.name}
                  </Link>
                ) : (
                  route.serviceId
                )
              ) : (
                "Unbound"
              )
            }
          />
          <DetailField label="Protocols" value={formatList(route.protocols)} />
          <DetailField label="Methods" value={formatList(route.methods)} />
          <DetailField label="Hosts" value={formatList(route.hosts)} />
          <DetailField label="Paths" value={formatList(route.paths)} mono />
          <DetailField label="SNIs" value={formatList(route.snis)} />
          <DetailField label="Sources" value={formatList(route.sources)} />
          <DetailField label="Destinations" value={formatList(route.destinations)} />
          <DetailField label="Strip path" value={route.stripPath ? "Yes" : "No"} />
          <DetailField label="Preserve host" value={route.preserveHost ? "Yes" : "No"} />
          <DetailField label="Regex priority" value={route.regexPriority ?? 0} />
          <DetailField label="Path handling" value={route.pathHandling || "v0"} />
          <DetailField
            label="Created"
            value={formatTimestamp(route.createdAt, settings.showRelativeTimes)}
          />
          <DetailField
            label="Updated"
            value={formatTimestamp(route.updatedAt, settings.showRelativeTimes)}
          />
          <div className="space-y-1 md:col-span-2 xl:col-span-1">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Tags
            </div>
            <TagList tags={route.tags} />
          </div>
        </div>
      </DetailSection>

      <DetailSection title="Headers" description="Header matchers stored on this route.">
        <JsonPreview value={route.headers || {}} emptyLabel="No header matchers configured." />
      </DetailSection>

      <PluginBindingsSection
        target={{
          id: route.id,
          kind: "route",
          name: route.name,
        }}
        title="Scoped Plugins"
        description="Plugins that run only when this route matches the request."
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit route</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="route-name">Name</Label>
                <Input
                  id="route-name"
                  value={formState.name}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="orders-route"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="route-service">Service</Label>
                <Select
                  id="route-service"
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
                id="route-protocols"
                label="Protocols"
                value={formState.protocols}
                onChange={(value) => setFormState((current) => ({ ...current, protocols: value }))}
                placeholder="http, https"
              />
              <Field
                id="route-methods"
                label="Methods"
                value={formState.methods}
                onChange={(value) => setFormState((current) => ({ ...current, methods: value }))}
                placeholder="GET, POST"
              />
              <Field
                id="route-paths"
                label="Paths"
                value={formState.paths}
                onChange={(value) => setFormState((current) => ({ ...current, paths: value }))}
                placeholder="/orders, /health"
              />
              <Field
                id="route-hosts"
                label="Hosts"
                value={formState.hosts}
                onChange={(value) => setFormState((current) => ({ ...current, hosts: value }))}
                placeholder="api.example.com"
              />
              <Field
                id="route-snis"
                label="SNIs"
                value={formState.snis}
                onChange={(value) => setFormState((current) => ({ ...current, snis: value }))}
                placeholder="service.internal"
              />
              <Field
                id="route-sources"
                label="Sources"
                value={formState.sources}
                onChange={(value) => setFormState((current) => ({ ...current, sources: value }))}
                placeholder="10.0.0.0/24"
              />
              <Field
                id="route-destinations"
                label="Destinations"
                value={formState.destinations}
                onChange={(value) =>
                  setFormState((current) => ({ ...current, destinations: value }))
                }
                placeholder="192.168.1.10"
              />
              <div className="space-y-2">
                <Label htmlFor="route-priority">Regex priority</Label>
                <Input
                  id="route-priority"
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
                <Label htmlFor="route-path-handling">Path handling</Label>
                <Select
                  id="route-path-handling"
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
                id="route-tags"
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
                  <div>
                    <p className="text-sm font-medium text-foreground">Strip path</p>
                    <p className="text-xs text-muted-foreground">
                      Remove the matching route prefix before proxying upstream.
                    </p>
                  </div>
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
                  <div>
                    <p className="text-sm font-medium text-foreground">Preserve host</p>
                    <p className="text-xs text-muted-foreground">
                      Forward the original Host header instead of the service host.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="route-headers">Headers JSON</Label>
              <textarea
                id="route-headers"
                value={formState.headers}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, headers: event.target.value }))
                }
                className="min-h-40 w-full rounded-lg border border-input bg-transparent px-3 py-2 font-mono text-sm text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder='{"x-region": ["cn-sh", "cn-bj"]}'
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
