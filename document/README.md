# UltraForce 项目结构说明

本仓库包含了 UltraForce for Salesforce Chrome 扩展的完整代码，项目已经重新整理为清晰的目录结构。

## 项目目录结构

```
ultraforce/
├── README.md                    # 本文件 - 项目说明
├── .gitignore                   # Git忽略规则
├── doc/                         # 项目文档
│   ├── CLAUDE.md               # Claude Code 使用指南
│   ├── ultraforce-modern-vibespecs.md  # VibeSpecs项目规划
│   ├── modern-architecture-plan.md   # 现代化架构计划
│   ├── Bug_Fixes.md            # Bug修复记录
│   ├── Salesforce_Domain_Updates.md  # Salesforce域名更新
│   └── ...                     # 其他文档文件
├── ultraforce-legacy/            # 传统版本 (v1.0.35)
│   ├── manifest.json           # Chrome扩展配置 (Manifest V3)
│   ├── index.html              # 弹窗主页面
│   ├── css/                    # 样式文件
│   ├── js/                     # JavaScript文件 (AngularJS)
│   ├── img/                    # 图标和图片资源
│   ├── reference/              # 第三方库文件
│   ├── view/                   # HTML页面
│   └── test_*.html             # 测试页面
└── ultraforce-v2/                # 现代化版本 (v2.0.0)
    ├── package.json            # NPM依赖配置
    ├── vite.config.ts          # Vite构建配置
    ├── tsconfig.json           # TypeScript配置
    ├── tailwind.config.js      # Tailwind CSS配置
    ├── README.md               # 现代化版本说明
    ├── src/                    # 源代码目录
    │   ├── manifest.json       # Chrome扩展配置
    │   ├── popup/              # 弹窗页面 (React)
    │   ├── options/            # 选项页面 (React)
    │   ├── background/         # 后台脚本 (Service Worker)
    │   ├── content/            # 内容脚本
    │   ├── components/         # 共享组件
    │   ├── stores/             # 状态管理 (Zustand)
    │   ├── types/              # TypeScript类型定义
    │   ├── utils/              # 工具函数
    │   └── assets/             # 静态资源
    └── node_modules/           # NPM依赖 (被gitignore)
```

## 版本对比

| 特性 | Legacy版本 (v1.0.35) | 现代化版本 (v2.0.0) |
|------|---------------------|-------------------|
| **前端框架** | AngularJS 1.x | React 18 + TypeScript |
| **构建工具** | 无 (直接运行) | Vite |
| **样式方案** | 原生CSS + Bootstrap | Tailwind CSS |
| **状态管理** | Angular Services | Zustand |
| **代码质量** | 无工具 | ESLint + Prettier + Husky |
| **测试框架** | 无 | Vitest + Testing Library |
| **扩展版本** | Manifest V3 | Manifest V3 |
| **开发体验** | 传统开发 | 现代化工具链 |

## 快速开始

### Legacy版本开发
```bash
# 无需构建，直接加载到Chrome
# 在Chrome扩展程序页面加载 ultraforce-legacy 文件夹
```

### 现代化版本开发
```bash
# 进入现代化版本目录
cd ultraforce-v2

# 安装依赖
npm install

# 开发模式
npm run dev

# 构建生产版本
npm run build

# 运行测试
npm run test

# 代码检查
npm run lint
```

## 开发指南

### 选择开发版本
- **维护现有功能**: 在 `ultraforce-legacy/` 中修改
- **新功能开发**: 在 `ultraforce-v2/` 中开发
- **未来发展**: 逐步迁移到 `ultraforce-v2/`

### 文档查看
- **项目规划**: 查看 `doc/ultraforce-modern-vibespecs.md`
- **架构说明**: 查看 `doc/modern-architecture-plan.md`
- **开发指南**: 查看 `doc/CLAUDE.md`

### 部署方式
1. **Legacy版本**: 直接将 `ultraforce-legacy/` 文件夹加载到Chrome
2. **现代化版本**: 构建后将 `ultraforce-v2/dist/` 文件夹加载到Chrome

## 技术栈

### Legacy版本技术栈
- **前端**: AngularJS 1.x + jQuery
- **样式**: Bootstrap + 自定义CSS
- **构建**: 无 (直接运行)
- **第三方库**: ACE Editor, JSZip, etc.

### 现代化版本技术栈
- **前端**: React 18 + TypeScript
- **构建**: Vite + SWC
- **样式**: Tailwind CSS + Shadcn/ui
- **状态**: Zustand + React Query
- **测试**: Vitest + Testing Library
- **代码质量**: ESLint + Prettier + Husky

## 许可证

本项目遵循原始许可证条款。

## 贡献指南

1. 阅读项目文档
2. 选择合适的版本进行开发
3. 遵循代码规范
4. 提交代码前运行测试
5. 创建有意义的提交信息

---

*最后更新: 2025年7月22日*
