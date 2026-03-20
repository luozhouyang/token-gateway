# Development Guide

## Workspace Layout

- `packages/core`: runtime library for database, migrations, admin API, proxy engine, and unified server.
- `packages/cli`: publishable CLI package and the only end-user install target.
- `apps/web`: React admin UI, built as static assets and embedded into the CLI package.

## Packaging Model

This repository does not publish the web app as a standalone package.

The release model is:

1. Publish `@token-gateway/core` as a runtime library.
2. Publish `@token-gateway/cli` as the user-facing package.
3. Build `apps/web` into static assets and copy them into `packages/cli/dist/web`.
4. Start one HTTP server from the CLI that serves:
   - `/ui` for the React app
   - `/admin` for the admin API
   - `/` for proxy traffic

Important implications:

- End users only need to install `@token-gateway/cli`.
- `apps/web` is private and should not be published.
- `@token-gateway/cli` depends on `@token-gateway/core`, so `core` must be published before `cli`.

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

Before publishing:

1. Update the version in `packages/core/package.json`.
2. Update the version in `packages/cli/package.json`.
3. Keep the CLI dependency on `@token-gateway/core` aligned with the version you are publishing.

Because `packages/cli` uses a workspace dependency during development, the packed artifact must resolve to a real published `@token-gateway/core` version when released.

## Publish Order

Always publish in this order:

1. `@token-gateway/core`
2. `@token-gateway/cli`

Do not publish the CLI first. Consumers installing the CLI must be able to resolve the referenced `@token-gateway/core` version from the registry.

## Publish Commands

Vite+ does not provide a `publish` command, so publishing is done with the package manager.

Publish `core` first:

```bash
cd packages/core
pnpm publish --access public
```

Publish `cli` second:

```bash
cd packages/cli
pnpm publish --access public
```

Notes:

- For a first public release of a scoped package, keep `--access public`.
- `packages/cli` has a `prepack` script, so `pnpm publish` will automatically rebuild the final CLI bundle before upload.
- Even though `prepack` rebuilds the package, always run the validation steps first.

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

1. Users install `@token-gateway/cli`.
2. Users run the CLI binary:

```bash
proxy-engine start
```

3. The CLI starts the unified HTTP server.
4. The server exposes the embedded web UI at `/ui` and the admin API at `/admin`.
