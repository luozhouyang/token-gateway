import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type MetricTone = "lime" | "sky" | "amber" | "rose" | "slate";

const toneClasses: Record<MetricTone, string> = {
  lime: "bg-primary/12 text-primary ring-primary/14",
  sky: "bg-chart-2/12 text-chart-2 ring-chart-2/14",
  amber: "bg-chart-4/12 text-chart-4 ring-chart-4/14",
  rose: "bg-chart-5/12 text-chart-5 ring-chart-5/14",
  slate: "bg-muted text-muted-foreground ring-border",
};

export interface MetricCardProps {
  label: string;
  value: number | string;
  description: string;
  icon?: LucideIcon;
  tone?: MetricTone;
  className?: string;
  footer?: React.ReactNode;
}

export function MetricCard({
  label,
  value,
  description,
  icon: Icon,
  tone = "lime",
  className,
  footer,
}: MetricCardProps) {
  return (
    <Card
      className={cn(
        "overflow-hidden border-border/70 bg-card/95 shadow-[0_18px_50px_-36px_hsl(var(--foreground)/0.28)]",
        className,
      )}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-3">
        <div className="space-y-1">
          <CardTitle className="text-sm font-medium text-foreground">{label}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <div
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-2xl ring-1",
            toneClasses[tone],
          )}
        >
          {Icon ? (
            <Icon className="h-5 w-5" />
          ) : (
            <div className="h-2.5 w-2.5 rounded-full bg-current" />
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-3xl font-semibold tracking-tight text-foreground">{value}</div>
        {footer}
      </CardContent>
    </Card>
  );
}
