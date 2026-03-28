import { useEffect, useState } from "react";
import { ConfigFormRenderer, StructuredObjectField } from "@/components/configs/ConfigFormRenderer";
import { Button } from "@/components/ui/button";
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
import { normalizeStructuredObjectInputOrEmpty } from "@/lib/configs/resource-config";
import { pluginsApi, type Plugin, type PluginDefinitionSummary } from "@/lib/api/client";
import { getErrorMessage, parseCommaSeparatedInput } from "@/lib/dashboard-utils";
import { toast } from "sonner";

export type ScopedPluginTargetKind = "service" | "route" | "consumer";

export interface ScopedPluginTarget {
  id: string;
  kind: ScopedPluginTargetKind;
  name: string;
}

interface PluginFormState {
  name: string;
  config: Record<string, unknown>;
  enabled: boolean;
  tags: string;
}

const EMPTY_FORM: PluginFormState = {
  name: "",
  config: {},
  enabled: true,
  tags: "",
};

export interface PluginBindingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: ScopedPluginTarget | null;
  plugin?: Plugin | null;
  onSaved?: (plugin: Plugin) => Promise<void> | void;
}

export function PluginBindingDialog(props: PluginBindingDialogProps) {
  const [saving, setSaving] = useState(false);
  const [pluginDefinitions, setPluginDefinitions] = useState<PluginDefinitionSummary[]>([]);
  const [formState, setFormState] = useState<PluginFormState>(EMPTY_FORM);

  useEffect(() => {
    if (!props.open) {
      return;
    }

    void loadPluginDefinitions();
  }, [props.open]);

  useEffect(() => {
    if (!props.open) {
      return;
    }

    if (props.plugin) {
      setFormState({
        name: props.plugin.name,
        config: props.plugin.config || {},
        enabled: props.plugin.enabled ?? true,
        tags: props.plugin.tags?.join(", ") || "",
      });
      return;
    }

    setFormState(EMPTY_FORM);
  }, [props.open, props.plugin, props.target]);

  async function loadPluginDefinitions() {
    try {
      setPluginDefinitions(await pluginsApi.listDefinitions());
    } catch (error) {
      toast.error("Failed to load plugin definitions", {
        description: getErrorMessage(error),
      });
      setPluginDefinitions([]);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!props.target) {
      return;
    }

    try {
      setSaving(true);

      const payload: Partial<Plugin> = {
        name: formState.name.trim(),
        config: normalizeStructuredObjectInputOrEmpty(formState.config),
        enabled: formState.enabled,
        tags: parseCommaSeparatedInput(formState.tags),
      };

      if (props.target.kind === "service") {
        payload.serviceId = props.target.id;
      } else if (props.target.kind === "route") {
        payload.routeId = props.target.id;
      } else {
        payload.consumerId = props.target.id;
      }

      const plugin = props.plugin
        ? await pluginsApi.update(props.plugin.id, payload)
        : await pluginsApi.create(payload);

      toast.success(props.plugin ? "Plugin updated" : "Plugin created", {
        description: `Bound to ${formatTargetLabel(props.target)}`,
      });
      props.onOpenChange(false);
      await props.onSaved?.(plugin);
    } catch (error) {
      toast.error(props.plugin ? "Failed to update plugin" : "Failed to create plugin", {
        description: getErrorMessage(error),
      });
    } finally {
      setSaving(false);
    }
  }

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

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {props.plugin ? "Edit Plugin" : "Add Plugin"} for{" "}
            {props.target ? formatTargetTitle(props.target) : "Scope"}
          </DialogTitle>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
            <p className="text-sm font-medium text-foreground">Plugin scope</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {props.target ? formatTargetLabel(props.target) : "No target selected"}
            </p>
          </div>

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

          <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">Plugin enabled</p>
              <p className="text-xs text-muted-foreground">
                Disable the binding without removing it from this scope.
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
              description="Use structured fields for plugin config. Unknown plugins fall back to a generic object editor."
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
            <Button type="button" variant="outline" onClick={() => props.onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !props.target || !formState.name.trim()}>
              {props.plugin ? "Save Changes" : "Add Plugin"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function formatTargetTitle(target: ScopedPluginTarget): string {
  return `${capitalize(target.kind)} "${target.name}"`;
}

function formatTargetLabel(target: ScopedPluginTarget): string {
  return `${target.kind}:${target.name}`;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
