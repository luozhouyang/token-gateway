import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ConfigFormRenderer, StructuredObjectField } from "@/components/configs/ConfigFormRenderer";
import { PageHeader } from "@/components/layout/PageHeader";
import { PluginBindingsSection } from "@/components/plugins/PluginBindingsSection";
import { Button } from "@/components/ui/button";
import { DetailField, DetailSection, TagList } from "@/components/resources/DetailSection";
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
import { keyAuthCredentialDescriptor } from "@/lib/configs/descriptors";
import {
  normalizeKeyAuthCredentialInput,
  normalizeStructuredObjectInputOrEmpty,
} from "@/lib/configs/resource-config";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { consumersApi, credentialsApi, type Consumer, type Credential } from "@/lib/api/client";
import { useDashboardSettings } from "@/lib/dashboard-settings";
import {
  confirmAction,
  formatTimestamp,
  getErrorMessage,
  parseCommaSeparatedInput,
  previewJson,
} from "@/lib/dashboard-utils";
import { formatConsumerName } from "@/lib/resource-display";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Plus, RefreshCw, Trash2, Users } from "lucide-react";

export const Route = createFileRoute("/consumers/$consumerId")({
  component: ConsumerDetailPage,
});

interface ConsumerFormState {
  username: string;
  customId: string;
  tags: string;
}

interface CredentialFormState {
  credentialType: string;
  credential: Record<string, unknown>;
  tags: string;
}

const EMPTY_CONSUMER_FORM: ConsumerFormState = {
  username: "",
  customId: "",
  tags: "",
};

const EMPTY_CREDENTIAL_FORM: CredentialFormState = {
  credentialType: "key-auth",
  credential: { key: "" },
  tags: "",
};

function ConsumerDetailPage() {
  const { consumerId } = Route.useParams();
  const { settings } = useDashboardSettings();
  const [consumer, setConsumer] = useState<Consumer | null>(null);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingConsumer, setSavingConsumer] = useState(false);
  const [savingCredential, setSavingCredential] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consumerDialogOpen, setConsumerDialogOpen] = useState(false);
  const [credentialDialogOpen, setCredentialDialogOpen] = useState(false);
  const [consumerFormState, setConsumerFormState] =
    useState<ConsumerFormState>(EMPTY_CONSUMER_FORM);
  const [credentialFormState, setCredentialFormState] =
    useState<CredentialFormState>(EMPTY_CREDENTIAL_FORM);
  const [editingCredential, setEditingCredential] = useState<Credential | null>(null);

  useEffect(() => {
    void loadData();
  }, [consumerId]);

  async function loadData(isRefresh = false) {
    try {
      setError(null);

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const [loadedConsumer, loadedCredentials] = await Promise.all([
        consumersApi.get(consumerId),
        credentialsApi.list(consumerId),
      ]);

      setConsumer(loadedConsumer);
      setCredentials(loadedCredentials);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Failed to load consumer"));
      setConsumer(null);
      setCredentials([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function openEditConsumerDialog() {
    if (!consumer) {
      return;
    }

    setConsumerFormState({
      username: consumer.username || "",
      customId: consumer.customId || "",
      tags: consumer.tags?.join(", ") || "",
    });
    setConsumerDialogOpen(true);
  }

  function openCreateCredentialDialog() {
    setEditingCredential(null);
    setCredentialFormState(EMPTY_CREDENTIAL_FORM);
    setCredentialDialogOpen(true);
  }

  function openEditCredentialDialog(credential: Credential) {
    setEditingCredential(credential);
    setCredentialFormState({
      credentialType: credential.credentialType,
      credential: credential.credential || {},
      tags: credential.tags?.join(", ") || "",
    });
    setCredentialDialogOpen(true);
  }

  async function handleConsumerSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!consumer) {
      return;
    }

    try {
      setSavingConsumer(true);

      await consumersApi.update(consumer.id, {
        username: consumerFormState.username.trim() || undefined,
        customId: consumerFormState.customId.trim() || undefined,
        tags: parseCommaSeparatedInput(consumerFormState.tags),
      });

      toast.success("Consumer updated");
      setConsumerDialogOpen(false);
      await loadData(true);
    } catch (saveError) {
      toast.error("Failed to save consumer", {
        description: getErrorMessage(saveError),
      });
    } finally {
      setSavingConsumer(false);
    }
  }

  async function handleCredentialSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!consumer) {
      return;
    }

    try {
      setSavingCredential(true);

      const payload: Partial<Credential> = {
        credentialType: credentialFormState.credentialType.trim(),
        credential:
          credentialFormState.credentialType.trim() === "key-auth"
            ? normalizeKeyAuthCredentialInput(credentialFormState.credential)
            : normalizeStructuredObjectInputOrEmpty(credentialFormState.credential),
        tags: parseCommaSeparatedInput(credentialFormState.tags),
      };

      if (editingCredential) {
        await credentialsApi.update(consumer.id, editingCredential.id, payload);
        toast.success("Credential updated");
      } else {
        await credentialsApi.create(consumer.id, payload);
        toast.success("Credential created");
      }

      setCredentialDialogOpen(false);
      await loadData(true);
    } catch (saveError) {
      toast.error("Failed to save credential", {
        description: getErrorMessage(saveError),
      });
    } finally {
      setSavingCredential(false);
    }
  }

  async function handleDeleteCredential(credential: Credential) {
    if (!consumer) {
      return;
    }

    const shouldDelete = await confirmAction(`Delete credential "${credential.credentialType}"?`);
    if (!shouldDelete) {
      return;
    }

    try {
      await credentialsApi.delete(consumer.id, credential.id);
      toast.success("Credential deleted");
      await loadData(true);
    } catch (deleteError) {
      toast.error("Failed to delete credential", {
        description: getErrorMessage(deleteError),
      });
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading consumer…</div>
      </div>
    );
  }

  if (!consumer) {
    return (
      <div className="page-enter page-stack">
        <Link
          to="/consumers"
          className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to consumers
        </Link>

        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">Unable to load consumer</CardTitle>
            <CardDescription>{error || "Consumer not found"}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const consumerName = formatConsumerName(consumer);

  return (
    <div className="page-enter page-stack">
      <Link
        to="/consumers"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to consumers
      </Link>
      <PageHeader
        eyebrow="Consumer Detail"
        title={consumerName}
        description="Consumer identity, credentials, and scoped plugins."
        icon={Users}
        meta={
          <>
            <span>{credentials.length} credentials</span>
            <span>Created {formatTimestamp(consumer.createdAt, settings.showRelativeTimes)}</span>
            <span>Updated {formatTimestamp(consumer.updatedAt, settings.showRelativeTimes)}</span>
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
            <Button type="button" onClick={openEditConsumerDialog}>
              <Pencil className="h-4 w-4" />
              Edit Consumer
            </Button>
          </>
        }
      />

      {error ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">Unable to refresh consumer</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <DetailSection title="Overview" description="Identity fields stored for this consumer.">
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <DetailField label="Username" value={consumer.username || "—"} />
          <DetailField label="Custom ID" value={consumer.customId || "—"} />
          <DetailField
            label="Created"
            value={formatTimestamp(consumer.createdAt, settings.showRelativeTimes)}
          />
          <DetailField
            label="Updated"
            value={formatTimestamp(consumer.updatedAt, settings.showRelativeTimes)}
          />
          <div className="space-y-1 md:col-span-2 xl:col-span-1">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Tags
            </div>
            <TagList tags={consumer.tags} />
          </div>
        </div>
      </DetailSection>

      <DetailSection
        title="Credentials"
        description="Authentication material attached directly to this consumer."
        actions={
          <Button type="button" onClick={openCreateCredentialDialog}>
            <Plus className="h-4 w-4" />
            Add Credential
          </Button>
        }
      >
        {credentials.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
            <p className="text-sm font-medium text-foreground">No credentials yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add a credential to authenticate requests for this consumer.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Credential</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {credentials.map((credential) => (
                <TableRow key={credential.id}>
                  <TableCell>
                    <div className="font-medium">{credential.credentialType}</div>
                    {credential.tags?.length ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {credential.tags.map((tag) => (
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
                    {previewJson(credential.credential, 140)}
                  </TableCell>
                  <TableCell>
                    {formatTimestamp(credential.createdAt, settings.showRelativeTimes)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditCredentialDialog(credential)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => void handleDeleteCredential(credential)}
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

      <PluginBindingsSection
        target={{
          id: consumer.id,
          kind: "consumer",
          name: consumerName,
        }}
        title="Scoped Plugins"
        description="Plugins that run only for this consumer."
      />

      <Dialog open={consumerDialogOpen} onOpenChange={setConsumerDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit consumer</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleConsumerSubmit}>
            <div className="space-y-2">
              <Label htmlFor="consumer-username">Username</Label>
              <Input
                id="consumer-username"
                value={consumerFormState.username}
                onChange={(event) =>
                  setConsumerFormState((current) => ({
                    ...current,
                    username: event.target.value,
                  }))
                }
                placeholder="client-a"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="consumer-custom-id">Custom ID</Label>
              <Input
                id="consumer-custom-id"
                value={consumerFormState.customId}
                onChange={(event) =>
                  setConsumerFormState((current) => ({
                    ...current,
                    customId: event.target.value,
                  }))
                }
                placeholder="tenant-42"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="consumer-tags">Tags</Label>
              <Input
                id="consumer-tags"
                value={consumerFormState.tags}
                onChange={(event) =>
                  setConsumerFormState((current) => ({
                    ...current,
                    tags: event.target.value,
                  }))
                }
                placeholder="premium, internal"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setConsumerDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={savingConsumer}>
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={credentialDialogOpen} onOpenChange={setCredentialDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingCredential ? "Edit credential" : "Create credential"}</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleCredentialSubmit}>
            <div className="space-y-2">
              <Label htmlFor="credential-type">Credential type</Label>
              <Input
                id="credential-type"
                value={credentialFormState.credentialType}
                onChange={(event) =>
                  setCredentialFormState((current) => ({
                    ...current,
                    credentialType: event.target.value,
                    credential:
                      event.target.value.trim() === "key-auth"
                        ? normalizeKeyAuthCredentialInput(current.credential)
                        : current.credential,
                  }))
                }
                placeholder="key-auth"
                required
              />
            </div>

            {credentialFormState.credentialType.trim() === "key-auth" ? (
              <ConfigFormRenderer
                fields={keyAuthCredentialDescriptor.fields}
                value={credentialFormState.credential}
                onChange={(credential) =>
                  setCredentialFormState((current) => ({
                    ...current,
                    credential,
                  }))
                }
              />
            ) : (
              <StructuredObjectField
                label="Credential fields"
                description="Configure credential properties as structured data instead of raw JSON."
                value={credentialFormState.credential}
                onChange={(credential) =>
                  setCredentialFormState((current) => ({
                    ...current,
                    credential,
                  }))
                }
              />
            )}

            <div className="space-y-2">
              <Label htmlFor="credential-tags">Tags</Label>
              <Input
                id="credential-tags"
                value={credentialFormState.tags}
                onChange={(event) =>
                  setCredentialFormState((current) => ({
                    ...current,
                    tags: event.target.value,
                  }))
                }
                placeholder="mobile, production"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCredentialDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={savingCredential}>
                {editingCredential ? "Save Changes" : "Create Credential"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
