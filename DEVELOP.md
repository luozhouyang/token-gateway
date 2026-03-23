# Development Guide

## Workspace Layout

- `packages/core`: runtime library for database, migrations, admin API, proxy engine, and unified server.
- `packages/cli`: publishable CLI package and the only end-user install target.
- `apps/web`: React admin UI, built as static assets and embedded into the CLI package.

## Packaging Model

This repository does not publish the web app as a standalone package.

The release model is:

1. Publish `@minigateway/core` as a runtime library.
2. Publish `@minigateway/cli` as the user-facing package.
3. Build `apps/web` into static assets and copy them into `packages/cli/dist/web`.
4. Start one HTTP server from the CLI that serves:
   - `/ui` for the React app
   - `/admin` for the admin API
   - `/` for proxy traffic

Important implications:

- End users only need to install `@minigateway/cli`.
- `apps/web` is private and should not be published.
- `@minigateway/cli` depends on `@minigateway/core`, so `core` must be published before `cli`.

## Prerequisites

- Node.js `>= 22.12.0`
- `vp` installed and available in `PATH`
- `pnpm` installed because the workspace package manager is `pnpm@10`

Install dependencies from the repository root:

```bash
vp install
```

## Build Commands

### Build Everything

From the repository root:

```bash
vp run build -r
```

This builds all workspace packages, including:

- `packages/core`
- `packages/cli`
- `apps/web`

### Build Individual Parts

Build `core` only:

```bash
cd packages/core
vp run build
```

Build `web` only:

```bash
cd apps/web
vp build
```

Build the CLI source only:

```bash
cd packages/cli
vp run build
```

Build the publishable CLI bundle:

```bash
cd packages/cli
vp run bundle
```

`vp run bundle` is the important packaging command for the CLI. It does all of the following:

1. Builds `packages/core`
2. Builds `apps/web`
3. Builds `packages/cli`
4. Copies built web assets into `packages/cli/dist/web`

## Validation Before Publishing

Run these commands from the repository root:

```bash
vp run check -r
vp run test -r
vp run build -r
```

Then build the final CLI bundle:

```bash
cd packages/cli
vp run bundle
```

Optional smoke test for the packaged CLI artifact:

```bash
node packages/cli/dist/index.mjs start --port 8099 --db /tmp/token-gateway-dev.db
```

Then verify:

- `http://127.0.0.1:8099/admin/health`
- `http://127.0.0.1:8099/ui/`

## Versioning Rules

This repository uses `changesets` for versioning and release management.

Only these packages are managed for npm release:

- `@minigateway/core`
- `@minigateway/cli`

The following workspace packages are ignored by `changesets`:

- `web`
- `website`

## Changesets Workflow

Create a changeset whenever a merged change should affect the published version of `@minigateway/core`, `@minigateway/cli`, or both.

Create a changeset from the repository root:

```bash
./node_modules/.bin/changeset
```

The CLI will ask you to:

1. Select the packages to release.
2. Choose the bump type for each selected package.
3. Write a short summary that explains the user-visible change.

Package selection guidance:

- Choose `@minigateway/core` when the change affects runtime APIs, server behavior, storage, migrations, proxy logic, or code consumed by the CLI.
- Choose `@minigateway/cli` when the change affects CLI commands, CLI packaging, startup behavior, or the shipped web bundle.
- Choose both when the CLI depends on new or changed behavior in `core`.

Bump type guidance:

- `patch`: bug fixes, internal fixes, packaging fixes, or behavior corrections that should not break existing users.
- `minor`: new backward-compatible features, commands, options, endpoints, or UI capabilities.
- `major`: breaking CLI behavior, breaking config changes, removed APIs, or incompatible runtime changes.

The command creates a markdown file in `.changeset/`. Commit that file together with the code change.

Inspect pending releases:

```bash
./node_modules/.bin/changeset status --verbose
```

This shows which packages will be bumped and at what version level.

To apply version bumps locally:

```bash
./node_modules/.bin/changeset version
```

`changeset version` updates:

- package versions in `package.json`
- internal dependency ranges between released packages
- `pnpm-lock.yaml`

After running it:

1. Review the version changes.
2. Commit the updated package manifests and lockfile.
3. Do not add extra unrelated changes before publishing.

Because `packages/cli` uses a workspace dependency during development, the packed artifact must resolve to a real published `@minigateway/core` version when released. `changesets` handles the package version bumps, and `pnpm` resolves the workspace dependency correctly during publish.

## Publish Order

Always publish in this order:

1. `@minigateway/core`
2. `@minigateway/cli`

Do not publish the CLI first. Consumers installing the CLI must be able to resolve the referenced `@minigateway/core` version from the registry.

## Publish Commands

### Recommended: GitHub Actions Release Workflow

The repository includes `.github/workflows/release.yml`.

Behavior:

1. On pushes to `main`, the workflow installs dependencies and runs:
   - `vp run check -r`
   - `vp run test -r`
   - `vp run build -r`
2. If pending changesets exist, it opens or updates a version PR.
3. If the version PR has been merged and there are packages ready to publish, it publishes them to npm.

Required repository secret:

- `NPM_TOKEN`: npm automation token with publish permission

Required GitHub repository permissions:

- `contents: write`
- `pull-requests: write`

### Local Publish

If you want to publish manually from your machine:

1. Create and commit a changeset.
2. Check pending release output if needed:

```bash
./node_modules/.bin/changeset status --verbose
```

3. Apply versions:

```bash
./node_modules/.bin/changeset version
```

4. Commit the version bump changes.
5. Validate the workspace:

```bash
vp run check -r
vp run test -r
vp run build -r
```

6. Publish with Changesets:

```bash
./node_modules/.bin/changeset publish
```

Notes:

- `packages/core` and `packages/cli` both publish with `access: public`.
- `packages/core` now has a `prepack` script, and `packages/cli` already had one.
- `packages/cli` will rebuild and embed the web assets automatically during publish.
- `changeset publish` uses `pnpm publish` in this workspace, so the workspace dependency from `@minigateway/cli` to `@minigateway/core` is resolved correctly at publish time.
- For local manual publishing, keep the publish order in mind: `@minigateway/core` must exist in npm before users can install the released CLI version.

## Packing Without Publishing

To inspect the package tarball locally before publishing:

```bash
cd packages/core
pnpm pack
```

```bash
cd packages/cli
pnpm pack
```

For the CLI package, `pnpm pack` will also trigger `prepack`, which means the tarball should already contain:

- `dist/index.mjs`
- `dist/web/*`

## Expected Release Outcome

After a successful release:

1. Users install `@minigateway/cli`.
2. Users run the CLI binary:

```bash
proxy-engine start
```

3. The CLI starts the unified HTTP server.
4. The server exposes the embedded web UI at `/ui` and the admin API at `/admin`.
