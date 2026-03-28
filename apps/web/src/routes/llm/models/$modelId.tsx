import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { StructuredObjectField } from "@/components/configs/ConfigFormRenderer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import {
  DetailField,
  DetailSection,
  JsonPreview,
  TagList,
} from "@/components/resources/DetailSection";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { normalizeStructuredObjectInput } from "@/lib/configs/resource-config";
import { llmModelsApi, llmProvidersApi, type LlmModel, type LlmProvider } from "@/lib/api/client";
import { useDashboardSettings } from "@/lib/dashboard-settings";
import {
  formatTimestamp,
  getErrorMessage,
  joinCommaSeparated,
  parseCommaSeparatedInput,
} from "@/lib/dashboard-utils";
import { toast } from "sonner";
import { ArrowLeft, Bot, Pencil, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/llm/models/$modelId")({
  component: LlmModelDetailPage,
});

interface ModelFormState {
  providerId: string;
  name: string;
  upstreamModel: string;
  metadata: Record<string, unknown>;
  enabled: boolean;
  tags: string;
}

const EMPTY_MODEL_FORM: ModelFormState = {
  providerId: "",
  name: "",
  upstreamModel: "",
  metadata: {},
  enabled: true,
  tags: "",
};

function LlmModelDetailPage() {
  const { modelId } = Route.useParams();
  const { settings } = useDashboardSettings();
  const [model, setModel] = useState<LlmModel | null>(null);
  const [providers, setProviders] = useState<LlmProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formState, setFormState] = useState<ModelFormState>(EMPTY_MODEL_FORM);

  useEffect(() => {
    void loadData();
  }, [modelId]);

  async function loadData(isRefresh = false) {
    try {
      setError(null);

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const [loadedModel, loadedProviders] = await Promise.all([
        llmModelsApi.get(modelId),
        llmProvidersApi.list(),
      ]);

      setModel(loadedModel);
      setProviders(loadedProviders);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Failed to load model"));
      setModel(null);
      setProviders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function openEditDialog() {
    if (!model) {
      return;
    }

    setFormState({
      providerId: model.providerId,
      name: model.name,
      upstreamModel: model.upstreamModel,
      metadata: model.metadata || {},
      enabled: model.enabled,
      tags: joinCommaSeparated(model.tags),
    });
    setDialogOpen(true);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!model) {
      return;
    }

    try {
      setSaving(true);

      await llmModelsApi.update(model.id, {
        providerId: formState.providerId,
        name: formState.name.trim(),
        upstreamModel: formState.upstreamModel.trim(),
        metadata: normalizeStructuredObjectInput(formState.metadata),
        enabled: formState.enabled,
        tags: parseCommaSeparatedInput(formState.tags),
      });

      toast.success("LLM model updated");
      setDialogOpen(false);
      await loadData(true);
    } catch (saveError) {
      toast.error("Failed to save LLM model", {
        description: getErrorMessage(saveError),
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading model…</div>
      </div>
    );
  }

  if (!model) {
    return (
      <div className="page-enter page-stack">
        <Link
          to="/llm"
          className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to LLM resources
        </Link>

        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">Unable to load model</CardTitle>
            <CardDescription>{error || "Model not found"}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const provider = providers.find((item) => item.id === model.providerId);

  return (
    <div className="page-enter page-stack">
      <Link
        to="/llm"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to LLM resources
      </Link>
      <PageHeader
        eyebrow="Model Detail"
        title={model.name}
        description="Model mapping, provider association, and routing metadata."
        icon={Bot}
        meta={
          <>
            <span>{provider ? provider.displayName || provider.name : model.providerId}</span>
            <span>{model.enabled ? "Enabled" : "Disabled"}</span>
            <span>Updated {formatTimestamp(model.updatedAt, settings.showRelativeTimes)}</span>
          </>
        }
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => void loadData(true)}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button type="button" onClick={openEditDialog}>
              <Pencil className="h-4 w-4" />
              Edit Model
            </Button>
          </>
        }
      />

      {error ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">Unable to refresh model</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <DetailSection title="Overview" description="Model identity and provider mapping.">
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <DetailField label="Name" value={model.name} />
          <DetailField label="Upstream model" value={model.upstreamModel} />
          <DetailField
            label="Provider"
            value={
              provider ? (
                <Link
                  to="/llm/providers/$providerId"
                  params={{ providerId: provider.id }}
                  className="underline-offset-4 hover:underline"
                >
                  {provider.displayName || provider.name}
                </Link>
              ) : (
                model.providerId
              )
            }
          />
          <DetailField label="Status" value={model.enabled ? "Enabled" : "Disabled"} />
          <DetailField
            label="Created"
            value={formatTimestamp(model.createdAt, settings.showRelativeTimes)}
          />
          <DetailField
            label="Updated"
            value={formatTimestamp(model.updatedAt, settings.showRelativeTimes)}
          />
          <div className="space-y-1 md:col-span-2 xl:col-span-1">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Tags
            </div>
            <TagList tags={model.tags} />
          </div>
        </div>
      </DetailSection>

      <DetailSection
        title="Metadata"
        description="Structured metadata exposed to router plugins and dashboards."
      >
        <JsonPreview value={model.metadata} emptyLabel="No metadata configured." />
      </DetailSection>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit model</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="model-provider">Provider</Label>
              <Select
                id="model-provider"
                value={formState.providerId}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, providerId: event.target.value }))
                }
              >
                <option value="" disabled>
                  Select provider
                </option>
                {providers.map((providerOption) => (
                  <option key={providerOption.id} value={providerOption.id}>
                    {providerOption.displayName || providerOption.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="model-name">Model name</Label>
                <Input
                  id="model-name"
                  value={formState.name}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="gpt-4.1"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="model-upstream">Upstream model</Label>
                <Input
                  id="model-upstream"
                  value={formState.upstreamModel}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      upstreamModel: event.target.value,
                    }))
                  }
                  placeholder="gpt-4.1"
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">Model enabled</p>
                <p className="text-xs text-muted-foreground">
                  Disabled models remain stored but are hidden from routing selection.
                </p>
              </div>
              <Switch
                checked={formState.enabled}
                onCheckedChange={(checked) =>
                  setFormState((current) => ({ ...current, enabled: checked }))
                }
              />
            </div>

            <StructuredObjectField
              label="Metadata"
              description="Attach structured model metadata without editing a raw JSON blob."
              value={formState.metadata}
              onChange={(metadata) => setFormState((current) => ({ ...current, metadata }))}
            />

            <div className="space-y-2">
              <Label htmlFor="model-tags">Tags</Label>
              <Input
                id="model-tags"
                value={formState.tags}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, tags: event.target.value }))
                }
                placeholder="chat, primary"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !formState.providerId}>
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
