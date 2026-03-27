import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ScopedPluginDialog,
  type ScopedPluginTarget,
} from "@/components/plugins/ScopedPluginDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  joinCommaSeparated,
  parseCommaSeparatedInput,
  parseJsonInput,
  previewJson,
  stringifyJson,
} from "@/lib/dashboard-utils";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  Pencil,
  Plus,
  Plug,
  RefreshCw,
  Search,
  Trash2,
  Users,
} from "lucide-react";

export const Route = createFileRoute("/consumers/")({
  component: ConsumersPage,
});

interface ConsumerFormState {
  username: string;
  customId: string;
  tags: string;
}

interface CredentialFormState {
  credentialType: string;
  credential: string;
  tags: string;
}

const EMPTY_CONSUMER_FORM: ConsumerFormState = {
  username: "",
  customId: "",
  tags: "",
};

const EMPTY_CREDENTIAL_FORM: CredentialFormState = {
  credentialType: "key-auth",
  credential: JSON.stringify({ key: "" }, null, 2),
  tags: "",
};

function ConsumersPage() {
  const { settings } = useDashboardSettings();
  const [consumers, setConsumers] = useState<Consumer[]>([]);
  const [credentialsByConsumer, setCredentialsByConsumer] = useState<Record<string, Credential[]>>(
    {},
  );
  const [expandedConsumers, setExpandedConsumers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingConsumer, setSavingConsumer] = useState(false);
  const [savingCredential, setSavingCredential] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [consumerDialogOpen, setConsumerDialogOpen] = useState(false);
  const [credentialDialogOpen, setCredentialDialogOpen] = useState(false);
  const [editingConsumer, setEditingConsumer] = useState<Consumer | null>(null);
  const [pluginDialogOpen, setPluginDialogOpen] = useState(false);
  const [pluginTarget, setPluginTarget] = useState<ScopedPluginTarget | null>(null);
  const [credentialContext, setCredentialContext] = useState<{
    consumerId: string;
    credential: Credential | null;
  } | null>(null);
  const [consumerFormState, setConsumerFormState] =
    useState<ConsumerFormState>(EMPTY_CONSUMER_FORM);
  const [credentialFormState, setCredentialFormState] =
    useState<CredentialFormState>(EMPTY_CREDENTIAL_FORM);

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData(isRefresh = false) {
    try {
      setError(null);

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const consumerList = await consumersApi.list();
      const credentialEntries = await Promise.all(
        consumerList.map(async (consumer) => {
          const credentials = await credentialsApi.list(consumer.id);
          return [consumer.id, credentials] as const;
        }),
      );

      setConsumers(consumerList);
      setCredentialsByConsumer(Object.fromEntries(credentialEntries));
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Failed to load consumers"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function toggleExpand(consumerId: string) {
    setExpandedConsumers((current) => {
      const next = new Set(current);
      if (next.has(consumerId)) {
        next.delete(consumerId);
      } else {
        next.add(consumerId);
      }
      return next;
    });
  }

  function openCreateConsumerDialog() {
    setEditingConsumer(null);
    setConsumerFormState(EMPTY_CONSUMER_FORM);
    setConsumerDialogOpen(true);
  }

  function openEditConsumerDialog(consumer: Consumer) {
    setEditingConsumer(consumer);
    setConsumerFormState({
      username: consumer.username || "",
      customId: consumer.customId || "",
      tags: joinCommaSeparated(consumer.tags),
    });
    setConsumerDialogOpen(true);
  }

  function openCreateCredentialDialog(consumerId: string) {
    setCredentialContext({ consumerId, credential: null });
    setCredentialFormState(EMPTY_CREDENTIAL_FORM);
    setCredentialDialogOpen(true);
  }

  function openCreatePluginDialog(consumer: Consumer) {
    setPluginTarget({
      id: consumer.id,
      kind: "consumer",
      name: consumer.username || consumer.customId || consumer.id,
    });
    setPluginDialogOpen(true);
  }

  function openEditCredentialDialog(consumerId: string, credential: Credential) {
    setCredentialContext({ consumerId, credential });
    setCredentialFormState({
      credentialType: credential.credentialType,
      credential: stringifyJson(credential.credential),
      tags: joinCommaSeparated(credential.tags),
    });
    setCredentialDialogOpen(true);
  }

  async function handleConsumerSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setSavingConsumer(true);

      const payload: Partial<Consumer> = {
        username: consumerFormState.username.trim() || undefined,
        customId: consumerFormState.customId.trim() || undefined,
        tags: parseCommaSeparatedInput(consumerFormState.tags),
      };

      if (editingConsumer) {
        await consumersApi.update(editingConsumer.id, payload);
        toast.success("Consumer updated");
      } else {
        await consumersApi.create(payload);
        toast.success("Consumer created");
      }

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
    if (!credentialContext) {
      return;
    }

    try {
      setSavingCredential(true);

      const payload: Partial<Credential> = {
        credentialType: credentialFormState.credentialType.trim(),
        credential: parseJsonInput<Record<string, unknown>>(
          credentialFormState.credential,
          "Credential JSON",
        ),
        tags: parseCommaSeparatedInput(credentialFormState.tags),
      };

      if (credentialContext.credential) {
        await credentialsApi.update(
          credentialContext.consumerId,
          credentialContext.credential.id,
          payload,
        );
        toast.success("Credential updated");
      } else {
        await credentialsApi.create(credentialContext.consumerId, payload);
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

  async function handleDeleteConsumer(consumer: Consumer) {
    const name = consumer.username || consumer.customId || consumer.id;
    const shouldDelete = await confirmAction(
      `Delete consumer "${name}"? Related credentials will be lost.`,
    );
    if (!shouldDelete) {
      return;
    }

    try {
      await consumersApi.delete(consumer.id);
      toast.success("Consumer deleted");
      await loadData(true);
    } catch (deleteError) {
      toast.error("Failed to delete consumer", {
        description: getErrorMessage(deleteError),
      });
    }
  }

  async function handleDeleteCredential(consumerId: string, credential: Credential) {
    const shouldDelete = await confirmAction(`Delete credential "${credential.credentialType}"?`);
    if (!shouldDelete) {
      return;
    }

    try {
      await credentialsApi.delete(consumerId, credential.id);
      toast.success("Credential deleted");
      await loadData(true);
    } catch (deleteError) {
      toast.error("Failed to delete credential", {
        description: getErrorMessage(deleteError),
      });
    }
  }

  const filteredConsumers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return consumers;
    }

    return consumers.filter((consumer) => {
      const credentials = credentialsByConsumer[consumer.id] || [];
      const haystack = [
        consumer.username,
        consumer.customId,
        joinCommaSeparated(consumer.tags),
        ...credentials.map((credential) => credential.credentialType),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [consumers, credentialsByConsumer, searchQuery]);

  const totalCredentials = Object.values(credentialsByConsumer).reduce(
    (count, credentials) => count + credentials.length,
    0,
  );
  const credentialTypes = new Set(
    Object.values(credentialsByConsumer)
      .flat()
      .map((credential) => credential.credentialType),
  ).size;

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading consumers…</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Consumers</h1>
          <p className="text-sm text-muted-foreground">
            Register client identities and attach credentials for authentication plugins.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void loadData(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button type="button" onClick={openCreateConsumerDialog}>
            <Plus className="h-4 w-4" />
            Add Consumer
          </Button>
        </div>
      </div>

      {error ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">Unable to load consumers</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Total consumers"
          value={consumers.length}
          description="Registered identities"
        />
        <MetricCard
          label="Credentials"
          value={totalCredentials}
          description="Keys, secrets, and auth material"
        />
        <MetricCard
          label="Credential types"
          value={credentialTypes}
          description="Distinct auth formats in use"
        />
      </div>

      <Card>
        <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Consumer directory</CardTitle>
            <CardDescription>
              {filteredConsumers.length} of {consumers.length} consumers shown
            </CardDescription>
          </div>
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by username, custom ID, tag, or credential type"
              className="pl-9"
            />
          </div>
        </CardHeader>
      </Card>

      <div className="space-y-4">
        {filteredConsumers.length === 0 ? (
          <Card>
            <CardContent className="px-6 py-12 text-center">
              <p className="text-sm font-medium text-foreground">No consumers matched</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Adjust the search query or create a new consumer.
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredConsumers.map((consumer) => {
            const credentials = credentialsByConsumer[consumer.id] || [];
            const isExpanded = expandedConsumers.has(consumer.id);
            const displayName = consumer.username || consumer.customId || consumer.id;

            return (
              <Card key={consumer.id}>
                <CardHeader className="gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <CardTitle>
                      <Link
                        to="/consumers/$consumerId"
                        params={{ consumerId: consumer.id }}
                        className="underline-offset-4 hover:underline"
                      >
                        {displayName}
                      </Link>
                    </CardTitle>
                    <CardDescription>
                      {consumer.customId ? `Custom ID: ${consumer.customId}` : "No custom ID"} ·{" "}
                      {credentials.length} credential(s)
                    </CardDescription>
                    <div className="mt-3 text-xs text-muted-foreground">
                      Updated {formatTimestamp(consumer.updatedAt, settings.showRelativeTimes)}
                    </div>
                    {consumer.tags?.length ? (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {consumer.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => openCreateCredentialDialog(consumer.id)}
                    >
                      <Plus className="h-4 w-4" />
                      Add Credential
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => openCreatePluginDialog(consumer)}
                    >
                      <Plug className="h-4 w-4" />
                      Add Plugin
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditConsumerDialog(consumer)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => void handleDeleteConsumer(consumer)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleExpand(consumer.id)}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </CardHeader>

                {isExpanded ? (
                  <CardContent>
                    {credentials.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border px-6 py-10 text-center">
                        <p className="text-sm font-medium text-foreground">No credentials yet</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Add a credential to authenticate this consumer.
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
                                    onClick={() =>
                                      openEditCredentialDialog(consumer.id, credential)
                                    }
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() =>
                                      void handleDeleteCredential(consumer.id, credential)
                                    }
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
                  </CardContent>
                ) : null}
              </Card>
            );
          })
        )}
      </div>

      <Dialog open={consumerDialogOpen} onOpenChange={setConsumerDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingConsumer ? "Edit consumer" : "Create consumer"}</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleConsumerSubmit}>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
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
              <Label htmlFor="customId">Custom ID</Label>
              <Input
                id="customId"
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
                  setConsumerFormState((current) => ({ ...current, tags: event.target.value }))
                }
                placeholder="internal, partner"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setConsumerDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={savingConsumer}>
                {editingConsumer ? "Save Changes" : "Create Consumer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={credentialDialogOpen} onOpenChange={setCredentialDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {credentialContext?.credential ? "Edit credential" : "Create credential"}
            </DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleCredentialSubmit}>
            <div className="space-y-2">
              <Label htmlFor="credentialType">Credential type</Label>
              <Input
                id="credentialType"
                value={credentialFormState.credentialType}
                onChange={(event) =>
                  setCredentialFormState((current) => ({
                    ...current,
                    credentialType: event.target.value,
                  }))
                }
                placeholder="key-auth"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="credential-json">Credential JSON</Label>
              <textarea
                id="credential-json"
                value={credentialFormState.credential}
                onChange={(event) =>
                  setCredentialFormState((current) => ({
                    ...current,
                    credential: event.target.value,
                  }))
                }
                className="min-h-40 w-full rounded-lg border border-input bg-transparent px-3 py-2 font-mono text-sm text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder='{"key": "abc123"}'
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="credential-tags">Tags</Label>
              <Input
                id="credential-tags"
                value={credentialFormState.tags}
                onChange={(event) =>
                  setCredentialFormState((current) => ({ ...current, tags: event.target.value }))
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
                {credentialContext?.credential ? "Save Changes" : "Create Credential"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ScopedPluginDialog
        open={pluginDialogOpen}
        onOpenChange={(open) => {
          setPluginDialogOpen(open);
          if (!open) {
            setPluginTarget(null);
          }
        }}
        target={pluginTarget}
      />
    </div>
  );
}

function MetricCard(props: { label: string; value: number; description: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-sm">{props.label}</CardTitle>
          <CardDescription>{props.description}</CardDescription>
        </div>
        <Users className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold">{props.value}</div>
      </CardContent>
    </Card>
  );
}
