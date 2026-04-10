---
title: Core Concepts
description: Understand the fundamental concepts of MiniGateway
---

import { Card, CardGrid } from '@astrojs/starlight/components';

MiniGateway is built around a few core concepts that make it flexible and powerful.

## Architecture Overview

MiniGateway follows a modular architecture with three main components:

<CardGrid>
  <Card title="Core Engine" icon="⚙️">
    The heart of MiniGateway - handles routing, proxy logic, and request transformation.
  </Card>
  <Card title="Plugin System" icon="🔌">
    Extensible plugins for authentication, rate limiting, logging, and custom transformations.
  </Card>
  <Card title="Web Dashboard" icon="📊">
    A modern dashboard for monitoring, configuration, and real-time analytics.
  </Card>
</CardGrid>

## Routing

Routes define how incoming requests are matched and forwarded to target services.

### Route Matching

Routes are matched using path patterns with support for:

- **Exact matching**: `/api/users` matches exactly that path
- **Wildcard matching**: `/api/*` matches any path starting with `/api/`
- **Parameter matching**: `/api/users/:id` extracts `id` as a parameter

### Route Configuration

Each route can be configured with:

| Property  | Description                             |
| --------- | --------------------------------------- |
| `path`    | The incoming path pattern to match      |
| `target`  | The destination URL to proxy to         |
| `methods` | HTTP methods to allow (GET, POST, etc.) |
| `plugins` | Plugins to apply for this route         |
| `timeout` | Request timeout in milliseconds         |

## Plugins

Plugins extend MiniGateway's functionality. They can be applied globally or to specific routes.

### Built-in Plugins

| Plugin       | Purpose                          |
| ------------ | -------------------------------- |
| `auth`       | Authentication and authorization |
| `rate-limit` | Request rate limiting            |
| `transform`  | Request/response transformation  |
| `cache`      | Response caching                 |
| `logger`     | Request logging                  |

### Custom Plugins

You can create custom plugins by implementing the `Plugin` interface:

```typescript
interface Plugin {
  name: string;
  onRequest?: (context: RequestContext) => Promise<void>;
  onResponse?: (context: ResponseContext) => Promise<void>;
}
```

## Storage

MiniGateway uses a database for storing configuration and runtime data.

### Supported Databases

- **SQLite**: Local development and small deployments
- **LibSQL**: Turso/LibSQL for distributed edge deployments
- **PostgreSQL**: Enterprise deployments (planned)

### Schema

The core schema includes:

- `routes`: Route definitions
- `plugins`: Plugin configurations
- `logs`: Request/response logs
- `metrics`: Performance metrics
