import { Badge } from "@/components/ui/badge";
import type {
  ConfigFieldDefinition,
  ConfigObjectDescriptor,
  ConfigObjectField,
  ConfigSelectField,
} from "@/lib/configs/types";
import {
  ensureNumberList,
  ensureRecord,
  ensureStringList,
  ensureStringMap,
  isFieldVisible,
  isPlainObject,
  splitObjectByKnownFields,
} from "@/lib/configs/utils";
import { stringifyJson } from "@/lib/dashboard-utils";
import { cn } from "@/lib/utils";

export interface ConfigValuePreviewProps {
  value: Record<string, unknown>;
  descriptor?: ConfigObjectDescriptor | null;
  emptyLabel?: string;
  showRawJson?: boolean;
}

export function ConfigValuePreview(props: ConfigValuePreviewProps) {
  const value = ensureRecord(props.value);

  if (Object.keys(value).length === 0) {
    return <div className="text-sm text-muted-foreground">{props.emptyLabel ?? "No values."}</div>;
  }

  return (
    <div className="space-y-4">
      {props.descriptor ? (
        <DescriptorObjectPreview descriptor={props.descriptor} value={value} depth={0} />
      ) : (
        <GenericObjectPreview value={value} depth={0} />
      )}

      {props.showRawJson ? (
        <details className="rounded-2xl border border-border/70 bg-muted/10 px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-foreground">Raw JSON</summary>
          <pre className="mt-3 overflow-x-auto rounded-2xl border border-border/70 bg-background/80 p-4 font-mono text-xs leading-6 text-foreground">
            {stringifyJson(value)}
          </pre>
        </details>
      ) : null}
    </div>
  );
}

function DescriptorObjectPreview(props: {
  descriptor: ConfigObjectDescriptor | ConfigObjectField;
  value: Record<string, unknown>;
  depth: number;
}) {
  const rootValue = ensureRecord(props.value);
  const fields = props.descriptor.fields ?? [];
  const visibleFields = fields.filter((field) => isFieldVisible(field, rootValue));
  const { additional } = splitObjectByKnownFields(rootValue, fields);
  const renderedFields = visibleFields.filter((field) =>
    hasRenderableValue(field, rootValue[field.key]),
  );

  if (renderedFields.length === 0 && Object.keys(additional).length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/10 px-4 py-3 text-sm text-muted-foreground">
        No configured values.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {renderedFields.map((field) => (
        <FieldPreviewCard
          key={field.key}
          label={field.label}
          description={field.description}
          depth={props.depth}
        >
          <DescriptorFieldValuePreview
            field={field}
            value={rootValue[field.key]}
            depth={props.depth + 1}
          />
        </FieldPreviewCard>
      ))}

      {Object.keys(additional).length > 0 ? (
        <FieldPreviewCard
          label="Additional values"
          description="Values stored on this plugin that are not modeled in the current descriptor."
          depth={props.depth}
        >
          <GenericObjectPreview value={additional} depth={props.depth + 1} />
        </FieldPreviewCard>
      ) : null}
    </div>
  );
}

function DescriptorFieldValuePreview(props: {
  field: ConfigFieldDefinition;
  value: unknown;
  depth: number;
}) {
  const { field, value } = props;

  if (field.kind === "string") {
    return (
      <PrimitivePreview value={value} mono={field.input === "password" || field.input === "url"} />
    );
  }

  if (field.kind === "number") {
    return <PrimitivePreview value={value} mono />;
  }

  if (field.kind === "boolean") {
    return (
      <Badge
        variant={value ? "default" : "secondary"}
        className="rounded-full px-3 py-1 text-xs font-medium"
      >
        {value ? "Yes" : "No"}
      </Badge>
    );
  }

  if (field.kind === "select") {
    return <PrimitivePreview value={resolveSelectLabel(field, value)} />;
  }

  if (field.kind === "string-list") {
    return <ListPreview values={ensureStringList(value)} />;
  }

  if (field.kind === "number-list") {
    return <ListPreview values={ensureNumberList(value).map((item) => String(item))} mono />;
  }

  if (field.kind === "string-map") {
    return <MapPreview value={ensureStringMap(value)} />;
  }

  const objectValue = ensureRecord(value);
  if (field.fields?.length) {
    return <DescriptorObjectPreview descriptor={field} value={objectValue} depth={props.depth} />;
  }

  return <GenericObjectPreview value={objectValue} depth={props.depth} />;
}

function GenericObjectPreview(props: { value: Record<string, unknown>; depth: number }) {
  const entries = Object.entries(props.value).filter(([key]) => key.trim().length > 0);

  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/10 px-4 py-3 text-sm text-muted-foreground">
        No configured values.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map(([key, value]) => (
        <div
          key={`${props.depth}-${key}`}
          className={cn(
            "rounded-2xl border border-border/60 bg-background/75 p-4 shadow-sm",
            props.depth > 0 ? "bg-muted/5" : "bg-background/75",
          )}
        >
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            {key}
          </div>
          <div className="mt-3">
            <GenericValuePreview value={value} depth={props.depth + 1} />
          </div>
        </div>
      ))}
    </div>
  );
}

function GenericValuePreview(props: { value: unknown; depth: number }) {
  if (Array.isArray(props.value)) {
    const allPrimitive = props.value.every(
      (item) =>
        typeof item === "string" ||
        typeof item === "number" ||
        typeof item === "boolean" ||
        item === null,
    );

    if (allPrimitive) {
      return <ListPreview values={props.value.map((item) => formatPrimitive(item))} mono />;
    }

    return (
      <div className="space-y-3">
        {props.value.map((item, index) => (
          <div
            key={`${props.depth}-${index}`}
            className="rounded-2xl border border-border/60 bg-muted/5 p-4 shadow-sm"
          >
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Item {index + 1}
            </div>
            <div className="mt-3">
              <GenericValuePreview value={item} depth={props.depth + 1} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isPlainObject(props.value)) {
    return <GenericObjectPreview value={props.value} depth={props.depth} />;
  }

  return <PrimitivePreview value={props.value} mono={typeof props.value === "number"} />;
}

function FieldPreviewCard(props: {
  label: string;
  description?: string;
  depth: number;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "space-y-3 rounded-2xl border border-border/60 bg-background/75 p-4 shadow-sm",
        props.depth > 0 ? "bg-muted/5" : "bg-background/75",
      )}
    >
      <div className="space-y-1">
        <div className="text-sm font-medium text-foreground">{props.label}</div>
        {props.description ? (
          <div className="text-sm text-muted-foreground">{props.description}</div>
        ) : null}
      </div>
      {props.children}
    </div>
  );
}

function PrimitivePreview(props: { value: unknown; mono?: boolean }) {
  return (
    <div
      className={cn(
        "break-words text-sm text-foreground",
        props.mono ? "font-mono text-[13px]" : undefined,
      )}
    >
      {formatPrimitive(props.value)}
    </div>
  );
}

function ListPreview(props: { values: string[]; mono?: boolean }) {
  if (props.values.length === 0) {
    return <div className="text-sm text-muted-foreground">No values configured.</div>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {props.values.map((value, index) => (
        <Badge
          key={`${value}-${index}`}
          variant="outline"
          className={cn(
            "rounded-full bg-background/80 px-3 py-1 text-xs font-medium",
            props.mono ? "font-mono" : undefined,
          )}
        >
          {value}
        </Badge>
      ))}
    </div>
  );
}

function MapPreview(props: { value: Record<string, string> }) {
  const entries = Object.entries(props.value);
  if (entries.length === 0) {
    return <div className="text-sm text-muted-foreground">No values configured.</div>;
  }

  return (
    <div className="space-y-2">
      {entries.map(([key, value]) => (
        <div
          key={key}
          className="grid gap-3 rounded-2xl border border-border/60 bg-muted/5 p-3 md:grid-cols-[minmax(0,180px)_minmax(0,1fr)]"
        >
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {key}
          </div>
          <div className="break-words font-mono text-[13px] text-foreground">{value}</div>
        </div>
      ))}
    </div>
  );
}

function hasRenderableValue(field: ConfigFieldDefinition, value: unknown): boolean {
  switch (field.kind) {
    case "string":
      return typeof value === "string" && value.trim().length > 0;
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "boolean":
      return typeof value === "boolean";
    case "select":
      return typeof value === "string" && value.length > 0;
    case "string-list":
      return ensureStringList(value).some((item) => item.trim().length > 0);
    case "number-list":
      return ensureNumberList(value).length > 0;
    case "string-map":
      return Object.keys(ensureStringMap(value)).length > 0;
    case "object": {
      const objectValue = ensureRecord(value);
      return Object.keys(objectValue).length > 0;
    }
  }
}

function resolveSelectLabel(field: ConfigSelectField, value: unknown): string {
  if (typeof value !== "string") {
    return "—";
  }

  return field.options.find((option) => option.value === value)?.label ?? value;
}

function formatPrimitive(value: unknown): string {
  if (value === null) {
    return "null";
  }

  if (value === undefined) {
    return "—";
  }

  if (typeof value === "string") {
    return value || "—";
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return stringifyJson(value);
}
