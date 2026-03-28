import { useEffect, useState, type ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { ConfigFieldDefinition, ConfigObjectField } from "@/lib/configs/types";
import {
  createDefaultObjectFromDescriptor,
  ensureNumberList,
  ensureRecord,
  ensureStringList,
  ensureStringMap,
  isFieldVisible,
  isPlainObject,
  splitObjectByKnownFields,
} from "@/lib/configs/utils";
import { cn } from "@/lib/utils";

export interface ConfigFormRendererProps {
  fields: ConfigFieldDefinition[];
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
  disabled?: boolean;
  showAdvancedJson?: boolean;
  advancedJsonLabel?: string;
}

export interface StructuredObjectFieldProps {
  label: string;
  description?: string;
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
  disabled?: boolean;
  showAdvancedJson?: boolean;
}

type ConfigValueKind = "string" | "number" | "boolean" | "object" | "array" | "null";

export function ConfigFormRenderer(props: ConfigFormRendererProps) {
  const rootValue = ensureRecord(props.value);

  function handleFieldChange(key: string, value: unknown) {
    props.onChange({
      ...rootValue,
      [key]: value,
    });
  }

  return (
    <div className="space-y-4">
      {props.fields
        .filter((field) => isFieldVisible(field, rootValue))
        .map((field) => (
          <FieldRenderer
            key={field.key}
            field={field}
            rootValue={rootValue}
            value={rootValue[field.key]}
            onChange={(value) => handleFieldChange(field.key, value)}
            disabled={props.disabled}
          />
        ))}

      {props.showAdvancedJson ? (
        <AdvancedJsonEditor
          label={props.advancedJsonLabel ?? "Advanced JSON"}
          value={rootValue}
          onChange={props.onChange}
        />
      ) : null}
    </div>
  );
}

export function StructuredObjectField(props: StructuredObjectFieldProps) {
  const value = ensureRecord(props.value);

  return (
    <FieldShell label={props.label} description={props.description}>
      <ConfigObjectEditor
        value={value}
        onChange={props.onChange}
        disabled={props.disabled}
        depth={0}
      />
      {props.showAdvancedJson !== false ? (
        <AdvancedJsonEditor label="Advanced JSON" value={value} onChange={props.onChange} />
      ) : null}
    </FieldShell>
  );
}

function FieldRenderer(props: {
  field: ConfigFieldDefinition;
  rootValue: Record<string, unknown>;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
}) {
  const { field, value, onChange, disabled } = props;

  if (field.kind === "boolean") {
    return (
      <div className="flex items-center justify-between gap-4 rounded-lg border border-border/70 bg-muted/20 px-4 py-3">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{field.label}</p>
          {field.description ? (
            <p className="text-sm text-muted-foreground">{field.description}</p>
          ) : null}
        </div>
        <Switch
          checked={Boolean(value)}
          disabled={disabled}
          onCheckedChange={(nextValue) => onChange(nextValue)}
        />
      </div>
    );
  }

  if (field.kind === "string") {
    return (
      <FieldShell label={field.label} description={field.description} required={field.required}>
        <Input
          type={field.input ?? "text"}
          value={typeof value === "string" ? value : ""}
          placeholder={field.placeholder}
          required={field.required}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
      </FieldShell>
    );
  }

  if (field.kind === "number") {
    return (
      <FieldShell label={field.label} description={field.description} required={field.required}>
        <NumberInput
          value={typeof value === "number" ? value : undefined}
          min={field.min}
          max={field.max}
          step={field.step}
          disabled={disabled}
          placeholder={field.placeholder}
          required={field.required}
          onChange={onChange}
        />
      </FieldShell>
    );
  }

  if (field.kind === "select") {
    return (
      <FieldShell label={field.label} description={field.description} required={field.required}>
        <Select
          value={typeof value === "string" ? value : (field.options[0]?.value ?? "")}
          required={field.required}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        >
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </FieldShell>
    );
  }

  if (field.kind === "string-list") {
    return (
      <FieldShell label={field.label} description={field.description} required={field.required}>
        <StringListEditor
          value={ensureStringList(value)}
          itemLabel={field.itemLabel}
          disabled={disabled}
          onChange={onChange}
        />
      </FieldShell>
    );
  }

  if (field.kind === "number-list") {
    return (
      <FieldShell label={field.label} description={field.description} required={field.required}>
        <NumberListEditor
          value={ensureNumberList(value)}
          itemLabel={field.itemLabel}
          min={field.min}
          max={field.max}
          step={field.step}
          disabled={disabled}
          onChange={onChange}
        />
      </FieldShell>
    );
  }

  if (field.kind === "string-map") {
    return (
      <FieldShell label={field.label} description={field.description} required={field.required}>
        <StringMapEditor
          value={ensureStringMap(value)}
          disabled={disabled}
          keyLabel={field.keyLabel}
          valueLabel={field.valueLabel}
          onChange={onChange}
        />
      </FieldShell>
    );
  }

  return (
    <FieldShell label={field.label} description={field.description} required={field.required}>
      <ObjectFieldRenderer field={field} value={value} onChange={onChange} disabled={disabled} />
    </FieldShell>
  );
}

function ObjectFieldRenderer(props: {
  field: ConfigObjectField;
  value: unknown;
  onChange: (value: Record<string, unknown>) => void;
  disabled?: boolean;
}) {
  const currentValue = ensureRecord(props.value);

  if (!props.field.fields?.length) {
    return (
      <>
        <ConfigObjectEditor
          value={currentValue}
          onChange={props.onChange}
          disabled={props.disabled}
          depth={0}
        />
        <AdvancedJsonEditor label="Advanced JSON" value={currentValue} onChange={props.onChange} />
      </>
    );
  }

  const { known, additional } = splitObjectByKnownFields(currentValue, props.field.fields);
  const knownValue = {
    ...createDefaultObjectFromDescriptor(props.field),
    ...known,
  };

  return (
    <div className="space-y-4">
      <ConfigFormRenderer
        fields={props.field.fields}
        value={knownValue}
        disabled={props.disabled}
        onChange={(nextValue) =>
          props.onChange(
            props.field.additionalProperties ? { ...nextValue, ...additional } : nextValue,
          )
        }
      />

      {props.field.additionalProperties ? (
        <StructuredObjectField
          label="Additional values"
          description="Add vendor-specific keys that are not modeled as dedicated fields."
          value={additional}
          disabled={props.disabled}
          onChange={(nextValue) => props.onChange({ ...knownValue, ...nextValue })}
        />
      ) : null}
    </div>
  );
}

function StringListEditor(props: {
  value: string[];
  itemLabel?: string;
  disabled?: boolean;
  onChange: (value: string[]) => void;
}) {
  const values = props.value.length > 0 ? props.value : [""];

  return (
    <div className="space-y-2">
      {values.map((item, index) => (
        <div key={`${index}-${item}`} className="flex items-center gap-2">
          <Input
            value={item}
            disabled={props.disabled}
            placeholder={props.itemLabel ?? "Value"}
            onChange={(event) => {
              const nextValue = [...values];
              nextValue[index] = event.target.value;
              props.onChange(nextValue);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            disabled={props.disabled || values.length === 1}
            onClick={() => props.onChange(values.filter((_, itemIndex) => itemIndex !== index))}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={props.disabled}
        onClick={() => props.onChange([...values, ""])}
      >
        <Plus className="h-4 w-4" />
        Add {props.itemLabel?.toLowerCase() ?? "item"}
      </Button>
    </div>
  );
}

function NumberListEditor(props: {
  value: number[];
  itemLabel?: string;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  onChange: (value: number[]) => void;
}) {
  const values = props.value.length > 0 ? props.value : [0];

  return (
    <div className="space-y-2">
      {values.map((item, index) => (
        <div key={`${index}-${item}`} className="flex items-center gap-2">
          <NumberInput
            value={item}
            min={props.min}
            max={props.max}
            step={props.step}
            disabled={props.disabled}
            placeholder={props.itemLabel ?? "Value"}
            onChange={(nextValue) => {
              const valuesCopy = [...values];
              valuesCopy[index] = typeof nextValue === "number" ? nextValue : 0;
              props.onChange(valuesCopy);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            disabled={props.disabled || values.length === 1}
            onClick={() => props.onChange(values.filter((_, itemIndex) => itemIndex !== index))}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={props.disabled}
        onClick={() => props.onChange([...values, 0])}
      >
        <Plus className="h-4 w-4" />
        Add {props.itemLabel?.toLowerCase() ?? "number"}
      </Button>
    </div>
  );
}

function StringMapEditor(props: {
  value: Record<string, string>;
  keyLabel?: string;
  valueLabel?: string;
  disabled?: boolean;
  onChange: (value: Record<string, string>) => void;
}) {
  const entries = Object.entries(props.value).map(
    ([key, value]) => [key, value] as [string, string],
  );
  const rows: Array<[string, string]> = entries.length > 0 ? entries : [["", ""]];

  function writeRows(nextRows: Array<[string, string]>) {
    props.onChange(Object.fromEntries(nextRows));
  }

  return (
    <div className="space-y-2">
      {rows.map(([key, value], index) => (
        <div
          key={`${index}-${key}`}
          className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
        >
          <Input
            value={key}
            disabled={props.disabled}
            placeholder={props.keyLabel ?? "Key"}
            onChange={(event) => {
              const nextRows = [...rows];
              nextRows[index] = [event.target.value, value];
              writeRows(nextRows);
            }}
          />
          <Input
            value={value}
            disabled={props.disabled}
            placeholder={props.valueLabel ?? "Value"}
            onChange={(event) => {
              const nextRows = [...rows];
              nextRows[index] = [key, event.target.value];
              writeRows(nextRows);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            disabled={props.disabled || rows.length === 1}
            onClick={() => writeRows(rows.filter((_, rowIndex) => rowIndex !== index))}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={props.disabled}
        onClick={() => writeRows([...rows, ["", ""]])}
      >
        <Plus className="h-4 w-4" />
        Add entry
      </Button>
    </div>
  );
}

function ConfigObjectEditor(props: {
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
  disabled?: boolean;
  depth: number;
}) {
  const entries = Object.entries(props.value);

  function updateEntry(index: number, nextKey: string, nextValue: unknown) {
    const nextEntries = [...entries];
    nextEntries[index] = [nextKey, nextValue];
    props.onChange(Object.fromEntries(nextEntries));
  }

  return (
    <div className="space-y-3">
      {entries.length > 0 ? (
        entries.map(([key, value], index) => (
          <div
            key={`${props.depth}-${index}-${key}`}
            className={cn(
              "space-y-3 rounded-lg border border-border/70 bg-background/80 p-3",
              props.depth > 0 ? "bg-muted/10" : "bg-background/80",
            )}
          >
            <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_180px_auto]">
              <Input
                value={key}
                disabled={props.disabled}
                placeholder="field_name"
                onChange={(event) => updateEntry(index, event.target.value, value)}
              />
              <Select
                value={resolveValueKind(value)}
                disabled={props.disabled}
                onChange={(event) =>
                  updateEntry(
                    index,
                    key,
                    createDefaultValueForKind(event.target.value as ConfigValueKind),
                  )
                }
              >
                <option value="string">String</option>
                <option value="number">Number</option>
                <option value="boolean">Boolean</option>
                <option value="object">Object</option>
                <option value="array">Array</option>
                <option value="null">Null</option>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                disabled={props.disabled}
                onClick={() =>
                  props.onChange(
                    Object.fromEntries(entries.filter((_, itemIndex) => itemIndex !== index)),
                  )
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <ConfigValueEditor
              value={value}
              disabled={props.disabled}
              depth={props.depth + 1}
              onChange={(nextValue) => updateEntry(index, key, nextValue)}
            />
          </div>
        ))
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-muted/10 px-4 py-3 text-sm text-muted-foreground">
          No fields added yet.
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={props.disabled}
        onClick={() =>
          props.onChange({
            ...props.value,
            [createUniqueKey(props.value)]: "",
          })
        }
      >
        <Plus className="h-4 w-4" />
        Add field
      </Button>
    </div>
  );
}

function ConfigArrayEditor(props: {
  value: unknown[];
  onChange: (value: unknown[]) => void;
  disabled?: boolean;
  depth: number;
}) {
  const items = props.value.length > 0 ? props.value : [""];

  return (
    <div className="space-y-3">
      {items.map((value, index) => (
        <div
          key={`${props.depth}-${index}`}
          className="space-y-3 rounded-lg border border-border/70 bg-background/80 p-3"
        >
          <div className="grid gap-2 md:grid-cols-[180px_auto]">
            <Select
              value={resolveValueKind(value)}
              disabled={props.disabled}
              onChange={(event) => {
                const nextItems = [...items];
                nextItems[index] = createDefaultValueForKind(event.target.value as ConfigValueKind);
                props.onChange(nextItems);
              }}
            >
              <option value="string">String</option>
              <option value="number">Number</option>
              <option value="boolean">Boolean</option>
              <option value="object">Object</option>
              <option value="array">Array</option>
              <option value="null">Null</option>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              disabled={props.disabled || items.length === 1}
              onClick={() => props.onChange(items.filter((_, itemIndex) => itemIndex !== index))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          <ConfigValueEditor
            value={value}
            disabled={props.disabled}
            depth={props.depth + 1}
            onChange={(nextValue) => {
              const nextItems = [...items];
              nextItems[index] = nextValue;
              props.onChange(nextItems);
            }}
          />
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={props.disabled}
        onClick={() => props.onChange([...items, ""])}
      >
        <Plus className="h-4 w-4" />
        Add item
      </Button>
    </div>
  );
}

function ConfigValueEditor(props: {
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
  depth: number;
}) {
  const kind = resolveValueKind(props.value);

  if (kind === "string") {
    return (
      <Input
        value={typeof props.value === "string" ? props.value : ""}
        disabled={props.disabled}
        placeholder="Value"
        onChange={(event) => props.onChange(event.target.value)}
      />
    );
  }

  if (kind === "number") {
    return (
      <NumberInput
        value={typeof props.value === "number" ? props.value : undefined}
        disabled={props.disabled}
        placeholder="Value"
        onChange={props.onChange}
      />
    );
  }

  if (kind === "boolean") {
    return (
      <div className="flex items-center justify-between gap-4 rounded-lg border border-border/70 bg-muted/20 px-4 py-3">
        <span className="text-sm text-foreground">Boolean value</span>
        <Switch
          checked={Boolean(props.value)}
          disabled={props.disabled}
          onCheckedChange={(nextValue) => props.onChange(nextValue)}
        />
      </div>
    );
  }

  if (kind === "object") {
    return (
      <ConfigObjectEditor
        value={ensureRecord(props.value)}
        onChange={props.onChange}
        disabled={props.disabled}
        depth={props.depth}
      />
    );
  }

  if (kind === "array") {
    return (
      <ConfigArrayEditor
        value={Array.isArray(props.value) ? props.value : []}
        onChange={props.onChange}
        disabled={props.disabled}
        depth={props.depth}
      />
    );
  }

  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/10 px-4 py-3 text-sm text-muted-foreground">
      This field is currently set to null. Use the type selector to replace it with another value.
    </div>
  );
}

function AdvancedJsonEditor(props: {
  label: string;
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
}) {
  const [text, setText] = useState(() => JSON.stringify(props.value, null, 2));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setText(JSON.stringify(props.value, null, 2));
  }, [props.value]);

  return (
    <details className="rounded-lg border border-border/70 bg-muted/10 px-4 py-3">
      <summary className="cursor-pointer text-sm font-medium text-foreground">
        {props.label}
      </summary>
      <div className="mt-3 space-y-3">
        <Textarea
          value={text}
          onChange={(event) => {
            const nextText = event.target.value;
            setText(nextText);

            if (!nextText.trim()) {
              props.onChange({});
              setError(null);
              return;
            }

            try {
              const parsed = JSON.parse(nextText) as unknown;
              if (!isPlainObject(parsed)) {
                setError("The advanced editor only accepts a JSON object at the root.");
                return;
              }

              props.onChange(parsed);
              setError(null);
            } catch (parseError) {
              setError(parseError instanceof Error ? parseError.message : "Invalid JSON");
            }
          }}
          className="min-h-40 font-mono"
        />

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </div>
    </details>
  );
}

function NumberInput(props: {
  value: number | undefined;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  placeholder?: string;
  required?: boolean;
  onChange: (value: number | undefined) => void;
}) {
  const [text, setText] = useState(() => (props.value === undefined ? "" : String(props.value)));

  useEffect(() => {
    setText(props.value === undefined ? "" : String(props.value));
  }, [props.value]);

  return (
    <Input
      type="number"
      value={text}
      min={props.min}
      max={props.max}
      step={props.step}
      disabled={props.disabled}
      placeholder={props.placeholder}
      required={props.required}
      onChange={(event) => {
        const nextText = event.target.value;
        setText(nextText);

        if (!nextText.trim()) {
          props.onChange(undefined);
          return;
        }

        const parsed = Number(nextText);
        if (Number.isFinite(parsed)) {
          props.onChange(parsed);
        }
      }}
    />
  );
}

function FieldShell(props: {
  label: string;
  description?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-4">
      <div className="space-y-1">
        <Label>
          {props.label}
          {props.required ? <span className="ml-1 text-destructive">*</span> : null}
        </Label>
        {props.description ? (
          <p className="text-sm text-muted-foreground">{props.description}</p>
        ) : null}
      </div>
      {props.children}
    </div>
  );
}

function resolveValueKind(value: unknown): ConfigValueKind {
  if (value === null) {
    return "null";
  }

  if (Array.isArray(value)) {
    return "array";
  }

  if (isPlainObject(value)) {
    return "object";
  }

  if (typeof value === "number") {
    return "number";
  }

  if (typeof value === "boolean") {
    return "boolean";
  }

  return "string";
}

function createDefaultValueForKind(kind: ConfigValueKind): unknown {
  switch (kind) {
    case "string":
      return "";
    case "number":
      return 0;
    case "boolean":
      return false;
    case "object":
      return {};
    case "array":
      return [];
    case "null":
      return null;
  }
}

function createUniqueKey(value: Record<string, unknown>): string {
  let index = Object.keys(value).length + 1;
  let key = `field_${index}`;

  while (Object.prototype.hasOwnProperty.call(value, key)) {
    index += 1;
    key = `field_${index}`;
  }

  return key;
}
