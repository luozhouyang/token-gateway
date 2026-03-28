import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { StructuredObjectField } from "@/components/configs/ConfigFormRenderer";
import { PageHeader } from "@/components/layout/PageHeader";
import { MetricCard } from "@/components/resources/MetricCard";
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
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { normalizeStructuredObjectInput } from "@/lib/configs/resource-config";
import { targetsApi, upstreamsApi, type Target, type Upstream } from "@/lib/api/client";
import { useDashboardSettings } from "@/lib/dashboard-settings";
import {
  confirmAction,
  formatTimestamp,
  getErrorMessage,
  joinCommaSeparated,
  parseCommaSeparatedInput,
  parseOptionalNumber,
  previewJson,
} from "@/lib/dashboard-utils";
import { toast } from "sonner";
import { Pencil, Plus, RefreshCw, Search, Server, Trash2 } from "lucide-react";

export const Route = createFileRoute("/upstreams/")({
  component: UpstreamsPage,
});

interface UpstreamFormState {
  name: string;
  algorithm: string;
  hashOn: string;
  hashFallback: string;
  slots: string;
  healthcheck: Record<string, unknown>;
  tags: string;
}

interface TargetFormState {
  target: string;
  weight: string;
  tags: string;
}

const EMPTY_UPSTREAM_FORM: UpstreamFormState = {
  name: "",
  algorithm: "round-robin",
  hashOn: "none",
  hashFallback: "none",
  slots: "10000",
  healthcheck: {},
  tags: "",
};

const EMPTY_TARGET_FORM: TargetFormState = {
  target: "",
  weight: "100",
  tags: "",
};

function UpstreamsPage() {
  const { settings } = useDashboardSettings();
  const [upstreams, setUpstreams] = useState<Upstream[]>([]);
  const [targetsByUpstream, setTargetsByUpstream] = useState<Record<string, Target[]>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingUpstream, setSavingUpstream] = useState(false);
  const [savingTarget, setSavingTarget] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [upstreamDialogOpen, setUpstreamDialogOpen] = useState(false);
  const [targetDialogOpen, setTargetDialogOpen] = useState(false);
  const [editingUpstream, setEditingUpstream] = useState<Upstream | null>(null);
  const [targetContext, setTargetContext] = useState<{
    upstreamId: string;
    target: Target | null;
  } | null>(null);
  const [upstreamFormState, setUpstreamFormState] =
    useState<UpstreamFormState>(EMPTY_UPSTREAM_FORM);
  const [targetFormState, setTargetFormState] = useState<TargetFormState>(EMPTY_TARGET_FORM);

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

      const upstreamList = await upstreamsApi.list();
      const targetEntries = await Promise.all(
        upstreamList.map(async (upstream) => {
          const targets = await targetsApi.list(upstream.id);
          return [upstream.id, targets] as const;
        }),
      );

      setUpstreams(upstreamList);
      setTargetsByUpstream(Object.fromEntries(targetEntries));
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Failed to load upstreams"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function openCreateUpstreamDialog() {
    setEditingUpstream(null);
    setUpstreamFormState(EMPTY_UPSTREAM_FORM);
    setUpstreamDialogOpen(true);
  }

  function openEditUpstreamDialog(upstream: Upstream) {
    setEditingUpstream(upstream);
    setUpstreamFormState({
      name: upstream.name,
      algorithm: upstream.algorithm || "round-robin",
      hashOn: upstream.hashOn || "none",
      hashFallback: upstream.hashFallback || "none",
      slots: String(upstream.slots ?? 10000),
      healthcheck: upstream.healthcheck || {},
      tags: joinCommaSeparated(upstream.tags),
    });
    setUpstreamDialogOpen(true);
  }

  function openCreateTargetDialog(upstreamId: string) {
    setTargetContext({ upstreamId, target: null });
    setTargetFormState(EMPTY_TARGET_FORM);
    setTargetDialogOpen(true);
  }

  function openEditTargetDialog(upstreamId: string, target: Target) {
    setTargetContext({ upstreamId, target });
    setTargetFormState({
      target: target.target,
      weight: String(target.weight ?? 100),
      tags: joinCommaSeparated(target.tags),
    });
    setTargetDialogOpen(true);
  }

  async function handleUpstreamSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setSavingUpstream(true);

      const payload: Partial<Upstream> = {
        name: upstreamFormState.name.trim(),
        algorithm: upstreamFormState.algorithm,
        hashOn: upstreamFormState.hashOn,
        hashFallback: upstreamFormState.hashFallback,
        slots: parseOptionalNumber(upstreamFormState.slots),
        healthcheck: normalizeStructuredObjectInput(upstreamFormState.healthcheck),
        tags: parseCommaSeparatedInput(upstreamFormState.tags),
      };

      if (editingUpstream) {
        await upstreamsApi.update(editingUpstream.id, payload);
        toast.success("Upstream updated");
      } else {
        await upstreamsApi.create(payload);
        toast.success("Upstream created");
      }

      setUpstreamDialogOpen(false);
      await loadData(true);
    } catch (saveError) {
      toast.error("Failed to save upstream", {
        description: getErrorMessage(saveError),
      });
    } finally {
      setSavingUpstream(false);
    }
  }

  async function handleTargetSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!targetContext) {
      return;
    }

    try {
      setSavingTarget(true);

      const payload: Partial<Target> = {
        target: targetFormState.target.trim(),
        weight: parseOptionalNumber(targetFormState.weight),
        tags: parseCommaSeparatedInput(targetFormState.tags),
      };

      if (targetContext.target) {
        await targetsApi.update(targetContext.upstreamId, targetContext.target.id, payload);
        toast.success("Target updated");
      } else {
        await targetsApi.create(targetContext.upstreamId, payload);
        toast.success("Target created");
      }

      setTargetDialogOpen(false);
      await loadData(true);
    } catch (saveError) {
      toast.error("Failed to save target", {
        description: getErrorMessage(saveError),
      });
    } finally {
      setSavingTarget(false);
    }
  }

  async function handleDeleteUpstream(upstream: Upstream) {
    const shouldDelete = await confirmAction(
      `Delete upstream "${upstream.name}"? Existing targets will be lost.`,
    );
    if (!shouldDelete) {
      return;
    }

    try {
      await upstreamsApi.delete(upstream.id);
      toast.success("Upstream deleted");
      await loadData(true);
    } catch (deleteError) {
      toast.error("Failed to delete upstream", {
        description: getErrorMessage(deleteError),
      });
    }
  }

  async function handleDeleteTarget(upstreamId: string, target: Target) {
    const shouldDelete = await confirmAction(
      `Delete target "${target.target}" from this upstream?`,
    );
    if (!shouldDelete) {
      return;
    }

    try {
      await targetsApi.delete(upstreamId, target.id);
      toast.success("Target deleted");
      await loadData(true);
    } catch (deleteError) {
      toast.error("Failed to delete target", {
        description: getErrorMessage(deleteError),
      });
    }
  }

  const filteredUpstreams = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return upstreams;
    }

    return upstreams.filter((upstream) => {
      const targets = targetsByUpstream[upstream.id] || [];
      const haystack = [
        upstream.name,
        upstream.algorithm,
        upstream.hashOn,
        upstream.hashFallback,
        joinCommaSeparated(upstream.tags),
        ...targets.map((target) => target.target),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [searchQuery, targetsByUpstream, upstreams]);

  const totalTargets = Object.values(targetsByUpstream).reduce(
    (count, targets) => count + targets.length,
    0,
  );
  const hashUpstreams = upstreams.filter((upstream) => upstream.algorithm === "hash").length;

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading upstreams…</div>
      </div>
    );
  }

  return (
    <div className="page-enter page-stack">
      <PageHeader
        eyebrow="Network Topology"
        title="Upstreams"
        description="Manage balancing groups, target pools, and hashing strategies for traffic distribution."
        icon={Server}
        meta={
          <>
            <span>{upstreams.length} upstreams</span>
            <span>{totalTargets} targets</span>
            <span>{hashUpstreams} hash-based</span>
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
            <Button type="button" onClick={openCreateUpstreamDialog}>
              <Plus className="h-4 w-4" />
              Add Upstream
            </Button>
          </>
        }
      />

      {error ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">Unable to load upstreams</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Total upstreams"
          value={upstreams.length}
          description="All balancing groups"
          icon={Server}
          tone="sky"
        />
        <MetricCard
          label="Total targets"
          value={totalTargets}
          description="Backend nodes across every group"
          icon={Search}
          tone="lime"
        />
        <MetricCard
          label="Hash algorithm"
          value={hashUpstreams}
          description="Upstreams using deterministic hashing"
          icon={RefreshCw}
          tone="amber"
        />
      </div>

      <Card>
        <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Upstream inventory</CardTitle>
            <CardDescription>
              {filteredUpstreams.length} of {upstreams.length} upstreams shown
            </CardDescription>
          </div>
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by name, algorithm, tag, or target"
              className="pl-9"
            />
          </div>
        </CardHeader>
      </Card>

      <div className="space-y-4">
        {filteredUpstreams.length === 0 ? (
          <Card>
            <CardContent className="px-6 py-12 text-center">
              <p className="text-sm font-medium text-foreground">No upstreams matched</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Adjust the search query or create a new upstream.
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredUpstreams.map((upstream) => {
            const targets = targetsByUpstream[upstream.id] || [];

            return (
              <Card key={upstream.id}>
                <CardHeader className="gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <CardTitle>{upstream.name}</CardTitle>
                    <CardDescription>
                      {upstream.algorithm || "round-robin"} · {targets.length} target(s) · slots{" "}
                      {upstream.slots ?? 10000}
                    </CardDescription>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>Hash on: {upstream.hashOn || "none"}</span>
                      <span>Fallback: {upstream.hashFallback || "none"}</span>
                      <span>
                        Updated: {formatTimestamp(upstream.updatedAt, settings.showRelativeTimes)}
                      </span>
                    </div>
                    {upstream.tags?.length ? (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {upstream.tags.map((tag) => (
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
                      onClick={() => openCreateTargetDialog(upstream.id)}
                    >
                      <Plus className="h-4 w-4" />
                      Add Target
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditUpstreamDialog(upstream)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => void handleDeleteUpstream(upstream)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="rounded-lg border border-border bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Healthcheck
                    </p>
                    <p className="mt-2 font-mono text-sm text-foreground">
                      {previewJson(upstream.healthcheck || {}, 180)}
                    </p>
                  </div>

                  {targets.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border px-6 py-10 text-center">
                      <p className="text-sm font-medium text-foreground">No targets yet</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Add a target so this upstream can forward traffic.
                      </p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Target</TableHead>
                          <TableHead>Weight</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead className="w-[120px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {targets.map((target) => (
                          <TableRow key={target.id}>
                            <TableCell>
                              <div className="font-medium">{target.target}</div>
                              {target.tags?.length ? (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {target.tags.map((tag) => (
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
                            <TableCell>{target.weight ?? 100}</TableCell>
                            <TableCell>
                              {formatTimestamp(target.createdAt, settings.showRelativeTimes)}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openEditTargetDialog(upstream.id, target)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => void handleDeleteTarget(upstream.id, target)}
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
              </Card>
            );
          })
        )}
      </div>

      <Dialog open={upstreamDialogOpen} onOpenChange={setUpstreamDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingUpstream ? "Edit upstream" : "Create upstream"}</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleUpstreamSubmit}>
            <div className="space-y-2">
              <Label htmlFor="upstream-name">Name</Label>
              <Input
                id="upstream-name"
                value={upstreamFormState.name}
                onChange={(event) =>
                  setUpstreamFormState((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="orders-upstream"
                required
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="algorithm">Algorithm</Label>
                <Select
                  id="algorithm"
                  value={upstreamFormState.algorithm}
                  onChange={(event) =>
                    setUpstreamFormState((current) => ({
                      ...current,
                      algorithm: event.target.value,
                    }))
                  }
                >
                  <option value="round-robin">round-robin</option>
                  <option value="least-connections">least-connections</option>
                  <option value="hash">hash</option>
                  <option value="weighted-round-robin">weighted-round-robin</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="slots">Slots</Label>
                <Input
                  id="slots"
                  type="number"
                  value={upstreamFormState.slots}
                  onChange={(event) =>
                    setUpstreamFormState((current) => ({ ...current, slots: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hashOn">Hash on</Label>
                <Input
                  id="hashOn"
                  value={upstreamFormState.hashOn}
                  onChange={(event) =>
                    setUpstreamFormState((current) => ({ ...current, hashOn: event.target.value }))
                  }
                  placeholder="none"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hashFallback">Hash fallback</Label>
                <Input
                  id="hashFallback"
                  value={upstreamFormState.hashFallback}
                  onChange={(event) =>
                    setUpstreamFormState((current) => ({
                      ...current,
                      hashFallback: event.target.value,
                    }))
                  }
                  placeholder="none"
                />
              </div>
            </div>

            <StructuredObjectField
              label="Healthcheck"
              description="Define active or passive healthcheck settings without editing raw JSON."
              value={upstreamFormState.healthcheck}
              onChange={(healthcheck) =>
                setUpstreamFormState((current) => ({
                  ...current,
                  healthcheck,
                }))
              }
            />

            <div className="space-y-2">
              <Label htmlFor="upstream-tags">Tags</Label>
              <Input
                id="upstream-tags"
                value={upstreamFormState.tags}
                onChange={(event) =>
                  setUpstreamFormState((current) => ({ ...current, tags: event.target.value }))
                }
                placeholder="internal, critical"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setUpstreamDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={savingUpstream}>
                {editingUpstream ? "Save Changes" : "Create Upstream"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={targetDialogOpen} onOpenChange={setTargetDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{targetContext?.target ? "Edit target" : "Create target"}</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleTargetSubmit}>
            <div className="space-y-2">
              <Label htmlFor="target">Target</Label>
              <Input
                id="target"
                value={targetFormState.target}
                onChange={(event) =>
                  setTargetFormState((current) => ({ ...current, target: event.target.value }))
                }
                placeholder="10.0.0.42:8080"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="weight">Weight</Label>
              <Input
                id="weight"
                type="number"
                value={targetFormState.weight}
                onChange={(event) =>
                  setTargetFormState((current) => ({ ...current, weight: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="target-tags">Tags</Label>
              <Input
                id="target-tags"
                value={targetFormState.tags}
                onChange={(event) =>
                  setTargetFormState((current) => ({ ...current, tags: event.target.value }))
                }
                placeholder="zone-a, canary"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTargetDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={savingTarget}>
                {targetContext?.target ? "Save Changes" : "Create Target"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
