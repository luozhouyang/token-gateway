# MiniGateway

A lightweight, high-performance LLM API proxy gateway with built-in web dashboard.

## Features

- **High Performance** - Built on [Hono](https://hono.dev/) framework for lightning-fast request handling with minimal overhead
- **LLM Gateway** - Designed specifically for LLM API proxying with provider adapters and model mapping
- **Plugin System** - Extensible plugin architecture for authentication, rate limiting, transformations, and more
- **Load Balancing** - Multiple algorithms including round-robin, least connections, and health-aware routing
- **Admin API** - Complete RESTful API for managing services, routes, consumers, and configurations
- **Web Dashboard** - Modern React-based dashboard for visual management and real-time monitoring

## Packages

| Package                                | Description                                                             |
| -------------------------------------- | ----------------------------------------------------------------------- |
| [`@minigateway/core`](./packages/core) | Core gateway engine with proxy logic, load balancing, and plugin system |
| [`@minigateway/cli`](./packages/cli)   | CLI tools for running and managing MiniGateway                          |

## Installation

### Prerequisites

- Node.js 24.x or later
- pnpm 10.x or later

### From Source

```bash
git clone https://github.com/luozhouyang/minigateway.git
cd minigateway
pnpm install
pnpm build
```

### NPM (Coming Soon)

```bash
npm install -g @minigateway/cli
```

## Quick Start

Start the gateway server:

```bash
# From source
pnpm exec minigateway start

# Or with options
pnpm exec minigateway start --port 8080 --log-level debug
```

### CLI Options

| Option        | Description                              | Default                         |
| ------------- | ---------------------------------------- | ------------------------------- |
| `--port`      | Server port                              | 8080                            |
| `--db`        | Database file path                       | `~/.minigateway/minigateway.db` |
| `--log-level` | Log verbosity (debug, info, warn, error) | info                            |
| `--no-ui`     | Disable Web UI                           | false                           |

## Configuration

MiniGateway uses a YAML-based configuration file. Example:

```yaml
services:
  - name: my-api
    routes:
      - path: /api/v1/*
        methods: ["GET", "POST"]
        plugins:
          - name: key-auth
          - name: rate-limit
            config:
              limit: 100
              window: 60
    upstream:
      name: backend
      targets:
        - url: http://localhost:3000
          weight: 100
```

See the [Configuration Guide](https://minigateway.luozhouyang.com/getting-started/configuration/) for detailed options.

## Plugins

Built-in plugins include:

| Plugin                 | Description                            |
| ---------------------- | -------------------------------------- |
| `key-auth`             | API key authentication                 |
| `rate-limit`           | Request rate limiting                  |
| `cors`                 | Cross-origin resource sharing          |
| `logger`               | Request/response logging               |
| `request-transformer`  | Modify request headers/body            |
| `response-transformer` | Modify response headers/body           |
| `llm-router`           | LLM provider routing and model mapping |

See [Plugins Overview](https://minigateway.luozhouyang.com/plugins/overview/) for plugin development guide.

## Development

```bash
# Install dependencies
pnpm install

# Run checks (format, lint, type-check)
pnpm check

# Run tests
pnpm test

# Build all packages
pnpm build

# Run full validation
pnpm ready
```

### Project Structure

```
minigateway/
├── apps/
│   ├── web/          # Web dashboard (React)
│   ├── docs/         # Documentation site (Astro/Starlight)
│   └── website/      # Landing page
├── packages/
│   ├── core/         # Core gateway engine
│   └── cli/          # CLI tools
├── tools/            # Development tools
└── pnpm-workspace.yaml
```

## Documentation

Full documentation is available at [minigateway.luozhouyang.com](https://minigateway.luozhouyang.com).

## License

[MIT](./LICENSE) - Luo Zhou Yang

## Contributing

Contributions are welcome! Please read the documentation and submit pull requests to the main repository.
