import { useEffect, useState } from "react";
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
import { pluginsApi, type Plugin } from "@/lib/api/client";
import {
  getErrorMessage,
  parseCommaSeparatedInput,
  parseJsonInput,
  stringifyJson,
} from "@/lib/dashboard-utils";
import { toast } from "sonner";

export type ScopedPluginTargetKind = "service" | "route" | "consumer";

export interface ScopedPluginTarget {
  id: string;
  kind: ScopedPluginTargetKind;
  name: string;
}

interface PluginFormState {
  name: string;
  config: string;
  enabled: boolean;
  tags: string;
}

const EMPTY_FORM: PluginFormState = {
  name: "",
  config: "{}",
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
  const [formState, setFormState] = useState<PluginFormState>(EMPTY_FORM);

  useEffect(() => {
    if (!props.open) {
      return;
    }

    if (props.plugin) {
      setFormState({
        name: props.plugin.name,
        config: stringifyJson(props.plugin.config || {}),
        enabled: props.plugin.enabled ?? true,
        tags: props.plugin.tags?.join(", ") || "",
      });
      return;
    }

    setFormState(EMPTY_FORM);
  }, [props.open, props.plugin, props.target]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!props.target) {
      return;
    }

    try {
      setSaving(true);

      const payload: Partial<Plugin> = {
        name: formState.name.trim(),
        config: parseJsonInput<Record<string, unknown>>(formState.config, "Plugin config"),
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
                Disable the binding without removing it from this scope.
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
              placeholder={stringifyJson({})}
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
            <Button type="button" variant="outline" onClick={() => props.onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !props.target}>
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
