# Changesets

This repository uses Changesets to manage npm releases for publishable packages.

## Packages Managed by Changesets

- `@minigateway/core`
- `@minigateway/cli`

The following workspace packages are ignored by the release workflow:

- `web`
- `website`

## Common Commands

Create a changeset:

```bash
./node_modules/.bin/changeset
```

Apply version bumps from pending changesets:

```bash
./node_modules/.bin/changeset version
```

Publish versioned packages to npm:

```bash
./node_modules/.bin/changeset publish
```
