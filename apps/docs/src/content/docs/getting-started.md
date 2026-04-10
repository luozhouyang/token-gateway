---
title: Getting Started
description: Get up and running with MiniGateway in minutes
---

import { Card, CardGrid, Steps } from '@astrojs/starlight/components';

This guide will help you set up MiniGateway in your project.

## Prerequisites

- Node.js 24.x or later
- pnpm 10.x or later (recommended)

## Installation

<Steps>

### Clone the repository

```bash
git clone https://github.com/luozhouyang/minigateway.git
cd minigateway
```

### Install dependencies

```bash
vp install
```

### Start the development server

```bash
vp run web#dev
```

The web application will be available at `http://localhost:3000`.

### Explore the API

Open your browser and navigate to the API documentation to see available endpoints.

</Steps>

## Project Structure

```
minigateway/
├── apps/
│   ├── web/          # Web dashboard application
│   ├── docs/         # Documentation site
│   └── website/      # Landing page
├── packages/
│   ├── core/         # Core gateway engine
│   └── cli/          # CLI tools
└── tools/            # Development tools
```

## Next Steps

<CardGrid>
  <Card title="Core Concepts" icon="📚" href="/core-concepts/">
    Learn the fundamental concepts behind MiniGateway's architecture.
  </Card>
  <Card title="Configuration" icon="⚙️" href="/configuration/">
    Configure your gateway routes, plugins, and more.
  </Card>
  <Card title="API Reference" icon="📖" href="/api-reference/">
    Explore the complete API documentation.
  </Card>
</CardGrid>
