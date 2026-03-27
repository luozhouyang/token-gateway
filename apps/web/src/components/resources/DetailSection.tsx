import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { stringifyJson } from "@/lib/dashboard-utils";

export interface DetailSectionProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export function DetailSection(props: DetailSectionProps) {
  return (
    <Card>
      <CardHeader className="gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <CardTitle>{props.title}</CardTitle>
          {props.description ? <CardDescription>{props.description}</CardDescription> : null}
        </div>
        {props.actions ? <div className="flex flex-wrap gap-2">{props.actions}</div> : null}
      </CardHeader>
      <CardContent>{props.children}</CardContent>
    </Card>
  );
}

export interface DetailFieldProps {
  label: string;
  value?: React.ReactNode;
  mono?: boolean;
}

export function DetailField(props: DetailFieldProps) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {props.label}
      </div>
      <div
        className={
          props.mono ? "break-all font-mono text-sm text-foreground" : "text-sm text-foreground"
        }
      >
        {props.value ?? "—"}
      </div>
    </div>
  );
}

export function TagList({ tags }: { tags?: string[] | null }) {
  if (!tags?.length) {
    return <div className="text-sm text-muted-foreground">No tags</div>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <span key={tag} className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
          {tag}
        </span>
      ))}
    </div>
  );
}

export interface JsonPreviewProps {
  value: unknown;
  emptyLabel?: string;
}

export function JsonPreview(props: JsonPreviewProps) {
  const text = stringifyJson(props.value);
  const isEmptyObject = text === "{}";

  if (isEmptyObject && props.emptyLabel) {
    return <div className="text-sm text-muted-foreground">{props.emptyLabel}</div>;
  }

  return (
    <pre className="overflow-x-auto rounded-lg border border-border bg-muted/30 p-4 font-mono text-xs text-foreground">
      {text}
    </pre>
  );
}
