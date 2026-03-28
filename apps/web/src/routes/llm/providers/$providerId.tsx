import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ConfigFormRenderer, StructuredObjectField } from "@/components/configs/ConfigFormRenderer";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  LLM_CLIENT_PROFILES,
  LLM_PROVIDER_PROTOCOLS,
  LLM_PROVIDER_VENDORS,
  llmModelsApi,
  llmProvidersApi,
  type LlmClientProfile,
  type LlmModel,
  type LlmProvider,
  type LlmProviderProtocol,
  type LlmProviderVendor,
} from "@/lib/api/client";
import { createLlmProviderConfigDescriptor } from "@/lib/configs/descriptors";
import {
  normalizeLlmProviderAuthInput,
  normalizeStringRecordInput,
  normalizeStructuredObjectInput,
  normalizeStructuredObjectInputOrEmpty,
} from "@/lib/configs/resource-config";
import { ensureRecord } from "@/lib/configs/utils";
import { useDashboardSettings } from "@/lib/dashboard-settings";
import {
  confirmAction,
  formatTimestamp,
  getErrorMessage,
  joinCommaSeparated,
  parseCommaSeparatedInput,
  previewJson,
} from "@/lib/dashboard-utils";
import { toast } from "sonner";
import { ArrowLeft, Bot, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";

export const Route = createFileRoute("/llm/providers/$providerId")({
  component: LlmProviderDetailPage,
});

interface ProviderFormState {
  name: string;
  displayName: string;
  vendor: LlmProviderVendor;
  protocol: LlmProviderProtocol;
  baseUrl: string;
  clients: string;
  headers: Record<string, unknown>;
  auth: Record<string, unknown>;
  adapterConfig: Record<string, unknown>;
  enabled: boolean;
  tags: string;
}

interface ModelFormState {
  name: string;
  upstreamModel: string;
  metadata: Record<string, unknown>;
  enabled: boolean;
  tags: string;
}

const EMPTY_PROVIDER_FORM: ProviderFormState = {
  name: "",
  displayName: "",
  vendor: "openai",
  protocol: "openai-compatible",
  baseUrl: "",
  clients: "",
  headers: {},
  auth: { type: "none" },
  adapterConfig: {},
  enabled: true,
  tags: "",
};

const EMPTY_MODEL_FORM: ModelFormState = {
  name: "",
  upstreamModel: "",
  metadata: {},
  enabled: true,
  tags: "",
};

const PROVIDER_CONFIG_DESCRIPTOR = createLlmProviderConfigDescriptor();

function LlmProviderDetailPage() {
  const { providerId } = Route.useParams();
  const { settings } = useDashboardSettings();
  const [provider, setProvider] = useState<LlmProvider | null>(null);
  const [models, setModels] = useState<LlmModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingProvider, setSavingProvider] = useState(false);
  const [savingModel, setSavingModel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providerDialogOpen, setProviderDialogOpen] = useState(false);
  const [modelDialogOpen, setModelDialogOpen] = useState(false);
  const [providerFormState, setProviderFormState] =
    useState<ProviderFormState>(EMPTY_PROVIDER_FORM);
  const [modelFormState, setModelFormState] = useState<ModelFormState>(EMPTY_MODEL_FORM);
  const [editingModel, setEditingModel] = useState<LlmModel | null>(null);

  useEffect(() => {
    void loadData();
  }, [providerId]);

  async function loadData(isRefresh = false) {
    try {
      setError(null);

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const [loadedProvider, loadedModels] = await Promise.all([
        llmProvidersApi.get(providerId),
        llmProvidersApi.listModels(providerId),
      ]);

      setProvider(loadedProvider);
      setModels(loadedModels);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Failed to load provider"));
      setProvider(null);
      setModels([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function openEditProviderDialog() {
    if (!provider) {
      return;
    }

    setProviderFormState({
      name: provider.name,
      displayName: provider.displayName || "",
      vendor: provider.vendor,
      protocol: provider.protocol,
      baseUrl: provider.baseUrl,
      clients: joinCommaSeparated(provider.clients),
      headers: provider.headers || {},
      auth: ensureRecord(provider.auth),
      adapterConfig: provider.adapterConfig || {},
      enabled: provider.enabled,
      tags: joinCommaSeparated(provider.tags),
    });
    setProviderDialogOpen(true);
  }

  function openCreateModelDialog() {
    setEditingModel(null);
    setModelFormState(EMPTY_MODEL_FORM);
    setModelDialogOpen(true);
  }

  function openEditModelDialog(model: LlmModel) {
    setEditingModel(model);
    setModelFormState({
      name: model.name,
      upstreamModel: model.upstreamModel,
      metadata: model.metadata || {},
      enabled: model.enabled,
      tags: joinCommaSeparated(model.tags),
    });
    setModelDialogOpen(true);
  }

  async function handleProviderSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!provider) {
      return;
    }

    try {
      setSavingProvider(true);

      await llmProvidersApi.update(provider.id, {
        name: providerFormState.name.trim(),
        displayName: providerFormState.displayName.trim() || undefined,
        vendor: providerFormState.vendor,
        protocol: providerFormState.protocol,
        baseUrl: providerFormState.baseUrl.trim(),
        clients: parseClientProfiles(providerFormState.clients),
        headers: normalizeStringRecordInput(providerFormState.headers),
        auth: normalizeLlmProviderAuthInput(providerFormState.auth),
        adapterConfig: normalizeStructuredObjectInputOrEmpty(providerFormState.adapterConfig),
        enabled: providerFormState.enabled,
        tags: parseCommaSeparatedInput(providerFormState.tags),
      });

      toast.success("LLM provider updated");
      setProviderDialogOpen(false);
      await loadData(true);
    } catch (saveError) {
      toast.error("Failed to save LLM provider", {
        description: getErrorMessage(saveError),
      });
    } finally {
      setSavingProvider(false);
    }
  }

  async function handleModelSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!provider) {
      return;
    }

    try {
      setSavingModel(true);

      const payload: Partial<LlmModel> = {
        name: modelFormState.name.trim(),
        upstreamModel: modelFormState.upstreamModel.trim(),
        metadata: normalizeStructuredObjectInput(modelFormState.metadata),
        enabled: modelFormState.enabled,
        tags: parseCommaSeparatedInput(modelFormState.tags),
      };

      if (editingModel) {
        await llmModelsApi.update(editingModel.id, payload);
        toast.success("LLM model updated");
      } else {
        await llmProvidersApi.createModel(provider.id, payload);
        toast.success("LLM model created");
      }

      setModelDialogOpen(false);
      await loadData(true);
    } catch (saveError) {
      toast.error("Failed to save LLM model", {
        description: getErrorMessage(saveError),
      });
    } finally {
      setSavingModel(false);
    }
  }

  async function handleDeleteModel(model: LlmModel) {
    const shouldDelete = await confirmAction(`Delete LLM model "${model.name}"?`);
    if (!shouldDelete) {
      return;
    }

    try {
      await llmModelsApi.delete(model.id);
      toast.success("LLM model deleted");
      await loadData(true);
    } catch (deleteError) {
      toast.error("Failed to delete LLM model", {
        description: getErrorMessage(deleteError),
      });
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading provider…</div>
      </div>
    );
  }

  if (!provider) {
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
            <CardTitle className="text-destructive">Unable to load provider</CardTitle>
            <CardDescription>{error || "Provider not found"}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

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
        eyebrow="Provider Detail"
        title={provider.displayName || provider.name}
        description="Provider connectivity, auth settings, and model catalog."
        icon={Bot}
        meta={
          <>
            <span>{provider.vendor}</span>
            <span>{provider.enabled ? "Enabled" : "Disabled"}</span>
            <span>{models.length} models</span>
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
            <Button type="button" variant="outline" onClick={openCreateModelDialog}>
              <Plus className="h-4 w-4" />
              Add Model
            </Button>
            <Button type="button" onClick={openEditProviderDialog}>
              <Pencil className="h-4 w-4" />
              Edit Provider
            </Button>
          </>
        }
      />

      {error ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">Unable to refresh provider</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <DetailSection title="Overview" description="Provider identity and transport settings.">
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <DetailField label="Name" value={provider.name} />
          <DetailField label="Display name" value={provider.displayName || "—"} />
          <DetailField label="Vendor" value={provider.vendor} />
          <DetailField label="Protocol" value={provider.protocol} />
          <DetailField label="Base URL" value={provider.baseUrl} mono />
          <DetailField label="Clients" value={joinCommaSeparated(provider.clients) || "Any"} />
          <DetailField label="Auth type" value={provider.auth.type} />
          <DetailField label="Status" value={provider.enabled ? "Enabled" : "Disabled"} />
          <DetailField
            label="Created"
            value={formatTimestamp(provider.createdAt, settings.showRelativeTimes)}
          />
          <DetailField
            label="Updated"
            value={formatTimestamp(provider.updatedAt, settings.showRelativeTimes)}
          />
          <div className="space-y-1 md:col-span-2 xl:col-span-1">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Tags
            </div>
            <TagList tags={provider.tags} />
          </div>
        </div>
      </DetailSection>

      <div className="grid gap-6 xl:grid-cols-3">
        <DetailSection title="Headers" description="Headers added to upstream requests.">
          <JsonPreview value={provider.headers} emptyLabel="No custom headers configured." />
        </DetailSection>
        <DetailSection title="Auth Config" description="Stored provider auth configuration.">
          <JsonPreview value={provider.auth} />
        </DetailSection>
        <DetailSection title="Adapter Config" description="Provider-specific adapter options.">
          <JsonPreview value={provider.adapterConfig} emptyLabel="No adapter config provided." />
        </DetailSection>
      </div>

      <DetailSection
        title="Models"
        description="Models registered under this provider."
        actions={
          <Button type="button" onClick={openCreateModelDialog}>
            <Plus className="h-4 w-4" />
            Add Model
          </Button>
        }
      >
        {models.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
            <p className="text-sm font-medium text-foreground">No models registered</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add a model to make this provider available to router plugins.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Model</TableHead>
                <TableHead>Metadata</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {models.map((model) => (
                <TableRow key={model.id}>
                  <TableCell>
                    <Link
                      to="/llm/models/$modelId"
                      params={{ modelId: model.id }}
                      className="font-medium text-foreground underline-offset-4 hover:underline"
                    >
                      {model.name}
                    </Link>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Upstream: {model.upstreamModel}
                    </div>
                    {model.tags.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {model.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {previewJson(model.metadata, 120)}
                  </TableCell>
                  <TableCell>{model.enabled ? "Enabled" : "Disabled"}</TableCell>
                  <TableCell>
                    {formatTimestamp(model.updatedAt, settings.showRelativeTimes)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditModelDialog(model)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => void handleDeleteModel(model)}
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

      <Dialog open={providerDialogOpen} onOpenChange={setProviderDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit provider</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleProviderSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="provider-name">Name</Label>
                <Input
                  id="provider-name"
                  value={providerFormState.name}
                  onChange={(event) =>
                    setProviderFormState((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="openai"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="provider-display-name">Display name</Label>
                <Input
                  id="provider-display-name"
                  value={providerFormState.displayName}
                  onChange={(event) =>
                    setProviderFormState((current) => ({
                      ...current,
                      displayName: event.target.value,
                    }))
                  }
                  placeholder="OpenAI Production"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="provider-vendor">Vendor</Label>
                <Select
                  id="provider-vendor"
                  value={providerFormState.vendor}
                  onChange={(event) =>
                    setProviderFormState((current) => ({
                      ...current,
                      vendor: event.target.value as LlmProviderVendor,
                    }))
                  }
                >
                  {LLM_PROVIDER_VENDORS.map((vendor) => (
                    <option key={vendor} value={vendor}>
                      {vendor}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="provider-protocol">Protocol</Label>
                <Select
                  id="provider-protocol"
                  value={providerFormState.protocol}
                  onChange={(event) =>
                    setProviderFormState((current) => ({
                      ...current,
                      protocol: event.target.value as LlmProviderProtocol,
                    }))
                  }
                >
                  {LLM_PROVIDER_PROTOCOLS.map((protocol) => (
                    <option key={protocol} value={protocol}>
                      {protocol}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="provider-clients">Client profiles</Label>
                <Input
                  id="provider-clients"
                  value={providerFormState.clients}
                  onChange={(event) =>
                    setProviderFormState((current) => ({
                      ...current,
                      clients: event.target.value,
                    }))
                  }
                  placeholder={LLM_CLIENT_PROFILES.join(", ")}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="provider-base-url">Base URL</Label>
              <Input
                id="provider-base-url"
                type="url"
                value={providerFormState.baseUrl}
                onChange={(event) =>
                  setProviderFormState((current) => ({ ...current, baseUrl: event.target.value }))
                }
                placeholder="https://api.openai.com/v1"
                required
              />
            </div>

            <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">Provider enabled</p>
                <p className="text-xs text-muted-foreground">
                  Disabled providers remain stored but cannot be selected for routing.
                </p>
              </div>
              <Switch
                checked={providerFormState.enabled}
                onCheckedChange={(checked) =>
                  setProviderFormState((current) => ({ ...current, enabled: checked }))
                }
              />
            </div>

            <ConfigFormRenderer
              fields={PROVIDER_CONFIG_DESCRIPTOR.fields}
              value={{
                headers: providerFormState.headers,
                auth: providerFormState.auth,
                adapterConfig: providerFormState.adapterConfig,
              }}
              onChange={(value) =>
                setProviderFormState((current) => ({
                  ...current,
                  headers: ensureRecord(value.headers),
                  auth: ensureRecord(value.auth),
                  adapterConfig: ensureRecord(value.adapterConfig),
                }))
              }
            />

            <div className="space-y-2">
              <Label htmlFor="provider-tags">Tags</Label>
              <Input
                id="provider-tags"
                value={providerFormState.tags}
                onChange={(event) =>
                  setProviderFormState((current) => ({ ...current, tags: event.target.value }))
                }
                placeholder="production, shared"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setProviderDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={savingProvider}>
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={modelDialogOpen} onOpenChange={setModelDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingModel ? "Edit model" : "Create model"}</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleModelSubmit}>
            <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
              <p className="text-sm font-medium text-foreground">Provider</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {provider.displayName || provider.name}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="model-name">Model name</Label>
                <Input
                  id="model-name"
                  value={modelFormState.name}
                  onChange={(event) =>
                    setModelFormState((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="gpt-4.1"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="model-upstream">Upstream model</Label>
                <Input
                  id="model-upstream"
                  value={modelFormState.upstreamModel}
                  onChange={(event) =>
                    setModelFormState((current) => ({
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
                checked={modelFormState.enabled}
                onCheckedChange={(checked) =>
                  setModelFormState((current) => ({ ...current, enabled: checked }))
                }
              />
            </div>

            <StructuredObjectField
              label="Metadata"
              description="Attach structured model metadata without editing a raw JSON blob."
              value={modelFormState.metadata}
              onChange={(metadata) => setModelFormState((current) => ({ ...current, metadata }))}
            />

            <div className="space-y-2">
              <Label htmlFor="model-tags">Tags</Label>
              <Input
                id="model-tags"
                value={modelFormState.tags}
                onChange={(event) =>
                  setModelFormState((current) => ({ ...current, tags: event.target.value }))
                }
                placeholder="chat, primary"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModelDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={savingModel}>
                {editingModel ? "Save Changes" : "Create Model"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function parseClientProfiles(value: string): LlmClientProfile[] | undefined {
  const parsed = parseCommaSeparatedInput(value) as LlmClientProfile[] | undefined;
  if (!parsed) {
    return undefined;
  }

  const invalidProfile = parsed.find((profile) => !LLM_CLIENT_PROFILES.includes(profile));
  if (invalidProfile) {
    throw new Error(`Unknown client profile: ${invalidProfile}`);
  }

  return parsed;
}
