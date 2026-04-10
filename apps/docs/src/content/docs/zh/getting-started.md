---
title: 快速开始
description: 几分钟内上手 MiniGateway
---

import { Card, CardGrid, Steps } from '@astrojs/starlight/components';

本指南将帮助你在项目中设置 MiniGateway。

## 前置要求

- Node.js 24.x 或更高版本
- pnpm 10.x 或更高版本（推荐）

## 安装

<Steps>

### 克隆仓库

```bash
git clone https://github.com/luozhouyang/minigateway.git
cd minigateway
```

### 安装依赖

```bash
vp install
```

### 启动开发服务器

```bash
vp run web#dev
```

Web 应用将在 `http://localhost:3000` 上可用。

### 探索 API

打开浏览器并导航到 API 文档，查看可用的端点。

</Steps>

## 项目结构

```
minigateway/
├── apps/
│   ├── web/          # Web 控制台应用
│   ├── docs/         # 文档站点
│   └── website/      # 首页
├── packages/
│   ├── core/         # 核心网关引擎
│   └── cli/          # CLI 工具
└── tools/            # 开发工具
```

## 下一步

<CardGrid>
  <Card title="核心概念" icon="📚" href="/zh/core-concepts/">
    了解 MiniGateway 架构的基本概念。
  </Card>
  <Card title="配置" icon="⚙️" href="/zh/configuration/">
    配置网关路由、插件等。
  </Card>
  <Card title="API 参考" icon="📖" href="/zh/api-reference/">
    探索完整的 API 文档。
  </Card>
</CardGrid>
