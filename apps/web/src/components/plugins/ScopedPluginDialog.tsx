import {
  PluginBindingDialog,
  type ScopedPluginTarget,
} from "@/components/plugins/PluginBindingDialog";
import type { Plugin } from "@/lib/api/client";

export type { ScopedPluginTarget } from "@/components/plugins/PluginBindingDialog";

export interface ScopedPluginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: ScopedPluginTarget | null;
  onCreated?: (plugin: Plugin) => Promise<void> | void;
}

export function ScopedPluginDialog(props: ScopedPluginDialogProps) {
  return (
    <PluginBindingDialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      target={props.target}
      onSaved={props.onCreated}
    />
  );
}
