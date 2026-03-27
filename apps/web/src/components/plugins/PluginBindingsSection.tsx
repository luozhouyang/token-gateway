import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DetailSection } from "@/components/resources/DetailSection";
import {
  PluginBindingDialog,
  type ScopedPluginTarget,
} from "@/components/plugins/PluginBindingDialog";
import { pluginsApi, type Plugin } from "@/lib/api/client";
import {
  confirmAction,
  formatTimestamp,
  getErrorMessage,
  joinCommaSeparated,
  previewJson,
} from "@/lib/dashboard-utils";
import { useDashboardSettings } from "@/lib/dashboard-settings";
import { toast } from "sonner";
import { Pencil, Plus, RefreshCw, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";

export interface PluginBindingsSectionProps {
  target: ScopedPluginTarget;
  title?: string;
  description?: string;
}

export function PluginBindingsSection(props: PluginBindingsSectionProps) {
  const { settings } = useDashboardSettings();
  const navigate = useNavigate();
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlugin, setEditingPlugin] = useState<Plugin | null>(null);

  useEffect(() => {
    void loadPlugins();
  }, [props.target.id, props.target.kind]);

  async function loadPlugins(isRefresh = false) {
    try {
      setError(null);

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setPlugins(await pluginsApi.list(getPluginFilters(props.target)));
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Failed to load scoped plugins"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function openCreateDialog() {
    setEditingPlugin(null);
    setDialogOpen(true);
  }

  function openEditDialog(plugin: Plugin) {
    setEditingPlugin(plugin);
    setDialogOpen(true);
  }

  async function handleToggleEnabled(plugin: Plugin) {
    try {
      await pluginsApi.update(plugin.id, { enabled: !(plugin.enabled ?? true) });
      toast.success(plugin.enabled ? "Plugin disabled" : "Plugin enabled");
      await loadPlugins(true);
    } catch (toggleError) {
      toast.error("Failed to update plugin", {
        description: getErrorMessage(toggleError),
      });
    }
  }

  async function handleDelete(plugin: Plugin) {
    const shouldDelete = await confirmAction(`Delete plugin "${plugin.name}"?`);
    if (!shouldDelete) {
      return;
    }

    try {
      await pluginsApi.delete(plugin.id);
      toast.success("Plugin deleted");
      await loadPlugins(true);
    } catch (deleteError) {
      toast.error("Failed to delete plugin", {
        description: getErrorMessage(deleteError),
      });
    }
  }

  return (
    <>
      <DetailSection
        title={props.title || "Plugins"}
        description={props.description || `Plugins directly attached to this ${props.target.kind}.`}
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => void loadPlugins(true)}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button type="button" onClick={openCreateDialog}>
              <Plus className="h-4 w-4" />
              Add Plugin
            </Button>
          </>
        }
      >
        {error ? (
          <div className="rounded-lg border border-destructive/40 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="py-8 text-sm text-muted-foreground">Loading plugins…</div>
        ) : plugins.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
            <p className="text-sm font-medium text-foreground">No plugins attached</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add a plugin that runs only for this {props.target.kind}.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plugin</TableHead>
                <TableHead>Config</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="w-[180px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plugins.map((plugin) => (
                <TableRow
                  key={plugin.id}
                  className="cursor-pointer"
                  role="link"
                  tabIndex={0}
                  onClick={() =>
                    void navigate({
                      to: "/plugins/$pluginId",
                      params: { pluginId: plugin.id },
                    })
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      void navigate({
                        to: "/plugins/$pluginId",
                        params: { pluginId: plugin.id },
                      });
                    }
                  }}
                >
                  <TableCell>
                    <Link
                      to="/plugins/$pluginId"
                      params={{ pluginId: plugin.id }}
                      onClick={(event) => event.stopPropagation()}
                      className="block font-medium text-foreground underline-offset-4 hover:underline"
                    >
                      {plugin.name}
                    </Link>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {plugin.tags?.length ? joinCommaSeparated(plugin.tags) : "No tags"}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {previewJson(plugin.config, 140)}
                  </TableCell>
                  <TableCell>{(plugin.enabled ?? true) ? "Enabled" : "Disabled"}</TableCell>
                  <TableCell>
                    {formatTimestamp(plugin.updatedAt, settings.showRelativeTimes)}
                  </TableCell>
                  <TableCell onClick={(event) => event.stopPropagation()}>
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
                        onClick={() => void handleToggleEnabled(plugin)}
                      >
                        {(plugin.enabled ?? true) ? (
                          <ToggleRight className="h-4 w-4" />
                        ) : (
                          <ToggleLeft className="h-4 w-4" />
                        )}
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
      </DetailSection>

      <PluginBindingDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        target={props.target}
        plugin={editingPlugin}
        onSaved={() => loadPlugins(true)}
      />
    </>
  );
}

function getPluginFilters(target: ScopedPluginTarget) {
  if (target.kind === "service") {
    return { serviceId: target.id };
  }

  if (target.kind === "route") {
    return { routeId: target.id };
  }

  return { consumerId: target.id };
}
