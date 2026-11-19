# Contributing to UltraForce for Salesforce

**为 UltraForce for Salesforce 作贡献**

Thank you for your interest in contributing! This guide will help you get started.

感谢您有兴趣参与贡献！本指南将帮助您上手。

## Prerequisites

**先决条件**

- [Node.js](https://nodejs.org/) 22, as used in CI (ESM project) / [Node.js](https://nodejs.org/) 22，与 CI 一致（ESM 项目）
- [pnpm](https://pnpm.io/) 9.15.9, pinned in `package.json` via `packageManager` / `package.json` 的 `packageManager` 字段固定 pnpm 版本为 9.15.9
- Chrome or Chromium browser / Chrome 或 Chromium 浏览器
- A Salesforce org and the Salesforce CLI for live-org E2E tests / 仅真实组织端到端测试需要 Salesforce 组织及 Salesforce CLI

## Getting Started

**开始开发**

Clone the repository, install dependencies, and start the development server with hot reload.

克隆仓库，安装依赖并启动支持热重载的开发服务器。

```bash
git clone https://github.com/dormonbear/UltraForce
cd UltraForce
pnpm install
pnpm dev
```

### Load the Extension in Chrome

**在 Chrome 中加载扩展**

1. Open `chrome://extensions/`. / 打开 `chrome://extensions/`。
2. Enable **Developer mode**. / 启用 **开发者模式**。
3. Click **Load unpacked**. / 点击 **加载已解压的扩展程序**。
4. Select `build/chrome-mv3-dev`, created by `pnpm dev`. / 选择由 `pnpm dev` 生成的 `build/chrome-mv3-dev` 目录。

## Development Commands

**开发命令**

| Command / 命令 | Runs / 执行 | Description / 说明 |
| --- | --- | --- |
| `pnpm dev` | `plasmo dev` | Start the dev server with hot reload / 启动支持热重载的开发服务器 |
| `pnpm build` | `plasmo build` | Build the production extension / 构建生产版扩展 |
| `pnpm test:run` | `vitest --run` | Run unit tests / 运行单元测试 |
| `pnpm lint` | `oxlint src` | Check source with Oxlint / 使用 Oxlint 检查源码 |
| `pnpm lint:fix` | `oxlint src --fix` | Apply Oxlint fixes / 应用 Oxlint 自动修复 |
| `pnpm format` | `oxfmt src` | Format source with Oxfmt / 使用 Oxfmt 格式化源码 |
| `pnpm format:check` | `oxfmt --check src` | Check source formatting / 检查源码格式 |
| `pnpm type-check` | `tsc --noEmit` | Check TypeScript types / 检查 TypeScript 类型 |

## Code Style

**代码风格**

Oxfmt uses no semicolons, single quotes, no trailing commas, and a print width of 120 characters. Husky runs Oxlint with fixes and then Oxfmt on staged source files. Run `pnpm lint`, `pnpm format:check`, and `pnpm type-check` before committing.

Oxfmt 规定不使用分号、使用单引号、不保留尾随逗号，行宽为 120 字符。Husky 在暂存的源码文件上先运行 Oxlint 自动修复，再运行 Oxfmt。提交前请运行 `pnpm lint`、`pnpm format:check` 和 `pnpm type-check`。

## Project Structure

**项目结构**

| Directory / 目录 | Purpose / 用途 |
| --- | --- |
| `src/background/` | Service worker for cookie access and session auth / 处理 Cookie 访问及会话认证的服务工作线程 |
| `src/components/` | React UI, including the search modal and settings / React 界面，包括搜索窗口和设置 |
| `src/contents/` | Content scripts injected into Salesforce pages / 注入 Salesforce 页面的内容脚本 |
| `src/lib/` | Search, API, caching, and parsing / 搜索、API、缓存和解析 |
| `src/types/` | TypeScript types / TypeScript 类型 |
| `tests/e2e/` | Playwright end-to-end tests / Playwright 端到端测试 |

- `src/lib/window-manager.ts` mounts the React UI into Shadow DOM. / 将 React 界面挂载到 Shadow DOM。
- `src/lib/salesforce-api.ts` handles Salesforce API calls and metadata fetching. / 处理 Salesforce API 请求和元数据获取。
- `src/lib/fuzzy-search.ts` implements fuzzy search using MiniSearch. / 通过 MiniSearch 实现模糊搜索。
- `src/lib/command-parser.ts` parses commands such as `:o` and `:c`. / 解析 `:o` 和 `:c` 等命令。
- `src/contents/salesforce-search.tsx` is the primary content-script entry point. / 是主要的内容脚本入口。

## Testing

**测试**

### Unit Tests

**单元测试**

```bash
pnpm test:run
```

Unit tests use Vitest, jsdom, and React Testing Library. Test files sit alongside source files as `*.test.ts` or `*.test.tsx`.

单元测试使用 Vitest、jsdom 和 React Testing Library。测试文件与源码放在同一目录，文件名以 `.test.ts` 或 `.test.tsx` 结尾。

### E2E Tests

**端到端测试**

The synthetic browser jobs in [CI](.github/workflows/ci.yml) run four specs with synthetic Salesforce responses and require no Salesforce org or CLI login.

[CI](.github/workflows/ci.yml) 的合成浏览器任务运行四个使用模拟 Salesforce 响应的测试文件，无需 Salesforce 组织或 CLI 登录。

| CI spec / CI 测试文件 | Chromium mode / Chromium 模式 |
| --- | --- |
| `localization.spec.ts` | Headless (`headless: true`) / 无头 |
| `auth-boundary.spec.ts` | Headless (`headless: true`) / 无头 |
| `privacy.spec.ts` | Headed (`headless: false`) / 有界面 |
| `setup-search-race.spec.ts` | Headed (`headless: false`) / 有界面 |

Run the subset locally with the commands below. The headed specs need a display. Ubuntu CI provides a virtual display with `xvfb-run`, and Windows CI runs Playwright directly.

使用下面的命令可在本地运行该子集。有界面测试需要显示环境。Ubuntu CI 通过 `xvfb-run` 提供虚拟显示，Windows CI 则直接运行 Playwright。

```bash
pnpm exec playwright install chromium
pnpm build:e2e
pnpm exec playwright test tests/e2e/localization.spec.ts tests/e2e/auth-boundary.spec.ts tests/e2e/privacy.spec.ts tests/e2e/setup-search-race.spec.ts
```

Live-org specs that use the shared extension fixture need an authenticated Salesforce CLI org alias named `ultraforce`, with test data from [agent-script-recipes](https://github.com/trailheadapps/agent-script-recipes). The shared fixture uses full Chromium in new headless mode and runs headless by default. For visible debugging of those specs, set `E2E_VISIBLE=1` or pass `--headed`. Specs that explicitly set a browser mode keep their own setting.

使用共享扩展测试夹具的真实组织用例需要 Salesforce CLI 中已认证且别名为 `ultraforce` 的组织，并使用 [agent-script-recipes](https://github.com/trailheadapps/agent-script-recipes) 的测试数据。共享夹具使用完整的 Chromium，默认以新的无头模式运行。如需打开窗口调试这些用例，可设置 `E2E_VISIBLE=1` 或传入 `--headed`。显式指定浏览器模式的测试文件使用各自的配置。

```bash
sf org login web --alias ultraforce
pnpm test:e2e
```

`pnpm test:e2e` builds the test extension and runs the full suite. See the [E2E test guide](tests/E2E_TEST_GUIDE.md) for test data and patterns.

`pnpm test:e2e` 会构建测试版扩展并运行完整测试套件。有关测试数据和用例写法，请参阅[端到端测试指南](tests/E2E_TEST_GUIDE.md)。

## Making Changes

**提交更改**

### Branch Strategy

**分支策略**

- `main` holds stable releases. / `main` 用于稳定版本。
- `develop` is the active development branch. / `develop` 是活跃开发分支。
- Create feature branches from `develop`. / 从 `develop` 创建功能分支。

### Workflow

**工作流程**

1. Fork the repository and create a branch from `develop`. / 复刻仓库并从 `develop` 创建分支。
2. Make your changes and add regression tests for fixes. / 完成修改并为修复添加回归测试。
3. Run the checks below. / 运行以下检查。

   ```bash
   pnpm lint
   pnpm format:check
   pnpm type-check
   pnpm test:run
   ```

4. Use [Conventional Commits](https://www.conventionalcommits.org/) with English followed by Simplified Chinese. / 使用[约定式提交](https://www.conventionalcommits.org/)，先写英文，再写简体中文。
   - `feat:` New feature / 新功能
   - `fix:` Bug fix / 缺陷修复
   - `refactor:` Code refactoring / 代码重构
   - `docs:` Documentation / 文档
   - `test:` Tests / 测试
5. Open a pull request against `develop`. / 向 `develop` 提交拉取请求。

### Logging

**日志**

Use the `logger` module in application code. In development and production, `logger.error()` emits the fixed label `[UltraForce] An operation failed.` and discards all caller arguments. `debug`, `info`, and `warn` are silent.

应用代码应使用 `logger` 模块。在开发版和生产版中，`logger.error()` 只输出固定提示 `[UltraForce] An operation failed.`，并丢弃调用方传入的所有参数。`debug`、`info` 和 `warn` 均无输出。

```typescript
import { logger } from '~lib/logger'

logger.error()
```

## Reporting Issues

**报告问题**

Include the following when opening a GitHub issue.

在 GitHub 上提交 issue 时，请提供以下信息。

- Steps to reproduce / 复现步骤
- Expected and actual behavior / 预期行为和实际行为
- Salesforce edition or domain type, if relevant / 相关的 Salesforce 版本或域名类型
- Browser version / 浏览器版本

## License

**许可证**

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).

参与贡献即表示您同意按 [MIT 许可证](LICENSE) 授权您的贡献。
