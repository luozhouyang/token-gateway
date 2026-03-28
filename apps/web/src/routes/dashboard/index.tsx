import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { MetricCard } from "@/components/resources/MetricCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { consumersApi, pluginsApi, routesApi, servicesApi, upstreamsApi } from "@/lib/api/client";
import { useDashboardSettings } from "@/lib/dashboard-settings";
import {
  buildScopeLabel,
  formatTimestamp,
  getErrorMessage,
  sortByCreatedAtDescending,
} from "@/lib/dashboard-utils";
import type { Consumer, Plugin, Route as RouteConfig, Service, Upstream } from "@/lib/api/client";
import {
  Activity,
  ArrowRight,
  Cable,
  Plug,
  RefreshCw,
  Route as RouteIcon,
  Server,
  Settings2,
  Users,
} from "lucide-react";

export const Route = createFileRoute("/dashboard/")({
  component: Dashboard,
});

interface DashboardStats {
  services: number;
  routes: number;
  upstreams: number;
  consumers: number;
  plugins: number;
}

interface RecentItem {
  id: string;
  name: string;
  type: keyof DashboardStats;
  details: string;
  createdAt: string;
}

const DEFAULT_STATS: DashboardStats = {
  services: 0,
  routes: 0,
  upstreams: 0,
  consumers: 0,
  plugins: 0,
};

const resourceLinks: Record<keyof DashboardStats, string> = {
  services: "/services",
  routes: "/routes",
  upstreams: "/upstreams",
  consumers: "/consumers",
  plugins: "/plugins",
};

function Dashboard() {
  const { settings } = useDashboardSettings();
  const [stats, setStats] = useState<DashboardStats>(DEFAULT_STATS);
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    void loadDashboard();
  }, []);

  useEffect(() => {
    if (settings.dashboardAutoRefreshSeconds <= 0) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void loadDashboard(true);
    }, settings.dashboardAutoRefreshSeconds * 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [settings.dashboardAutoRefreshSeconds]);

  async function loadDashboard(isRefresh = false) {
    try {
      setError(null);

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const [services, routes, upstreams, consumers, plugins] = await Promise.all([
        servicesApi.list(),
        routesApi.list(),
        upstreamsApi.list(),
        consumersApi.list(),
        pluginsApi.list(),
      ]);

      setStats({
        services: services.length,
        routes: routes.length,
        upstreams: upstreams.length,
        consumers: consumers.length,
        plugins: plugins.length,
      });
      setRecentItems(buildRecentItems(services, routes, upstreams, consumers, plugins));
      setLastUpdatedAt(new Date().toISOString());
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Failed to load dashboard"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const linkedRoutes = useMemo(() => {
    return stats.routes > 0 ? `${stats.routes} routes configured` : "No routes configured";
  }, [stats.routes]);

  const activePlugins = useMemo(() => {
    return stats.plugins > 0 ? `${stats.plugins} plugins installed` : "No plugins installed";
  }, [stats.plugins]);

  const statCards = [
    {
      key: "services" as const,
      title: "Services",
      value: stats.services,
      description: "Configured upstream services",
      icon: Server,
      tone: "sky" as const,
    },
    {
      key: "routes" as const,
      title: "Routes",
      value: stats.routes,
      description: "Request matching rules",
      icon: RouteIcon,
      tone: "lime" as const,
    },
    {
      key: "upstreams" as const,
      title: "Upstreams",
      value: stats.upstreams,
      description: "Load balancing groups",
      icon: Settings2,
      tone: "amber" as const,
    },
    {
      key: "consumers" as const,
      title: "Consumers",
      value: stats.consumers,
      description: "Registered API consumers",
      icon: Users,
      tone: "slate" as const,
    },
    {
      key: "plugins" as const,
      title: "Plugins",
      value: stats.plugins,
      description: "Installed policy extensions",
      icon: Plug,
      tone: "rose" as const,
    },
  ];

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading dashboard…</div>
      </div>
    );
  }

  return (
    <div className="page-enter page-stack">
      <PageHeader
        eyebrow="Operations"
        title="Dashboard"
        description="Monitor gateway health, traffic topology, and the newest resources from a single control plane."
        icon={Activity}
        meta={
          <>
            <span>
              API base <span className="font-medium text-foreground">{settings.apiBaseUrl}</span>
            </span>
            {lastUpdatedAt ? (
              <span>Last sync {formatTimestamp(lastUpdatedAt, settings.showRelativeTimes)}</span>
            ) : null}
          </>
        }
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => void loadDashboard(true)}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button type="button" asChild>
              <Link to="/services">
                Open Resources
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </>
        }
      />

      {error ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">Dashboard unavailable</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {statCards.map((card) => (
          <MetricCard
            key={card.key}
            label={card.title}
            value={card.value}
            description={card.description}
            icon={card.icon}
            tone={card.tone}
            footer={
              <Link
                to={resourceLinks[card.key]}
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                View {card.title.toLowerCase()}
                <ArrowRight className="h-4 w-4" />
              </Link>
            }
          />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Gateway health</CardTitle>
              <CardDescription>Derived from the current admin inventory</CardDescription>
            </div>
            <Activity className="h-5 w-5 text-chart-1" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="h-2.5 w-2.5 rounded-full bg-chart-1" />
              <span className="font-medium text-foreground">
                {stats.services > 0 || stats.routes > 0
                  ? "Admin API reachable and resources loaded"
                  : "Admin API reachable but no resources configured"}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{linkedRoutes}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Traffic topology</CardTitle>
              <CardDescription>How requests are distributed today</CardDescription>
            </div>
            <Cable className="h-5 w-5 text-chart-2" />
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">{stats.routes}</span> routes fan out
              into{" "}
              <span className="font-medium text-foreground">
                {Math.max(stats.services, stats.upstreams)}
              </span>{" "}
              backends.
            </p>
            <p>{activePlugins}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Automation</CardTitle>
              <CardDescription>Runtime dashboard behaviors</CardDescription>
            </div>
            <RefreshCw className="h-5 w-5 text-chart-4" />
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              Auto refresh:{" "}
              <span className="font-medium text-foreground">
                {settings.dashboardAutoRefreshSeconds > 0
                  ? `Every ${settings.dashboardAutoRefreshSeconds}s`
                  : "Manual only"}
              </span>
            </p>
            <p>
              Timestamp mode:{" "}
              <span className="font-medium text-foreground">
                {settings.showRelativeTimes ? "Relative" : "Locale"}
              </span>
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent resources</CardTitle>
          <CardDescription>The newest items created across your gateway</CardDescription>
        </CardHeader>
        <CardContent>
          {recentItems.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
              <p className="text-sm font-medium text-foreground">No resources yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Start by creating a service, route, consumer, upstream, or plugin.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[120px]">Open</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentItems.map((item) => (
                  <TableRow key={`${item.type}-${item.id}`}>
                    <TableCell className="capitalize">{item.type.slice(0, -1)}</TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-muted-foreground">{item.details}</TableCell>
                    <TableCell>
                      {formatTimestamp(item.createdAt, settings.showRelativeTimes)}
                    </TableCell>
                    <TableCell>
                      <Link
                        to={resourceLinks[item.type]}
                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                      >
                        Open
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function buildRecentItems(
  services: Service[],
  routes: RouteConfig[],
  upstreams: Upstream[],
  consumers: Consumer[],
  plugins: Plugin[],
): RecentItem[] {
  return sortByCreatedAtDescending([
    ...services.map((service) => ({
      id: service.id,
      name: service.name,
      type: "services" as const,
      details: service.url || buildScopeLabel([service.protocol, service.host, service.path]),
      createdAt: service.createdAt,
    })),
    ...routes.map((route) => ({
      id: route.id,
      name: route.name,
      type: "routes" as const,
      details: buildScopeLabel([
        route.serviceId ? `service:${route.serviceId}` : null,
        route.paths?.[0],
        route.methods?.[0],
      ]),
      createdAt: route.createdAt,
    })),
    ...upstreams.map((upstream) => ({
      id: upstream.id,
      name: upstream.name,
      type: "upstreams" as const,
      details: buildScopeLabel([upstream.algorithm, upstream.hashOn]),
      createdAt: upstream.createdAt,
    })),
    ...consumers.map((consumer) => ({
      id: consumer.id,
      name: consumer.username || consumer.customId || consumer.id,
      type: "consumers" as const,
      details: buildScopeLabel([consumer.customId, ...(consumer.tags || []).slice(0, 1)]),
      createdAt: consumer.createdAt,
    })),
    ...plugins.map((plugin) => ({
      id: plugin.id,
      name: plugin.name,
      type: "plugins" as const,
      details: buildScopeLabel([
        plugin.serviceId ? `service:${plugin.serviceId}` : null,
        plugin.routeId ? `route:${plugin.routeId}` : null,
        plugin.consumerId ? `consumer:${plugin.consumerId}` : null,
      ]),
      createdAt: plugin.createdAt,
    })),
  ]).slice(0, 10);
}
