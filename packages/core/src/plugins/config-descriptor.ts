export interface ConfigFieldVisibility {
  key: string;
  equals?: string | number | boolean | null;
  notEquals?: string | number | boolean | null;
}

export interface ConfigFieldOption {
  label: string;
  value: string;
}

interface ConfigFieldBase {
  key: string;
  label: string;
  description?: string;
  required?: boolean;
  placeholder?: string;
  advanced?: boolean;
  visibleWhen?: ConfigFieldVisibility;
}

export interface ConfigStringField extends ConfigFieldBase {
  kind: "string";
  input?: "text" | "password" | "url";
}

export interface ConfigNumberField extends ConfigFieldBase {
  kind: "number";
  min?: number;
  max?: number;
  step?: number;
}

export interface ConfigBooleanField extends ConfigFieldBase {
  kind: "boolean";
}

export interface ConfigSelectField extends ConfigFieldBase {
  kind: "select";
  options: ConfigFieldOption[];
}

export interface ConfigStringListField extends ConfigFieldBase {
  kind: "string-list";
  itemLabel?: string;
}

export interface ConfigNumberListField extends ConfigFieldBase {
  kind: "number-list";
  itemLabel?: string;
  min?: number;
  max?: number;
  step?: number;
}

export interface ConfigStringMapField extends ConfigFieldBase {
  kind: "string-map";
  keyLabel?: string;
  valueLabel?: string;
}

export interface ConfigObjectField extends ConfigFieldBase {
  kind: "object";
  fields?: ConfigFieldDefinition[];
  additionalProperties?: boolean;
}

export type ConfigFieldDefinition =
  | ConfigStringField
  | ConfigNumberField
  | ConfigBooleanField
  | ConfigSelectField
  | ConfigStringListField
  | ConfigNumberListField
  | ConfigStringMapField
  | ConfigObjectField;

export interface ConfigObjectDescriptor {
  fields: ConfigFieldDefinition[];
}
