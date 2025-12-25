# UltraForce Plasmo 开发指南

## 快速开始

### 1. 开发环境设置
```bash
# 项目现在直接在根目录
npm install
npm run dev  # 启动开发服务器
```

### 2. 加载Chrome扩展
1. 打开Chrome浏览器
2. 访问 `chrome://extensions/`
3. 开启"开发者模式"（右上角）
4. 点击"加载已解压的扩展程序"
5. 选择目录：`build/chrome-mv3-dev/`

### 3. 测试功能
- **弹出窗口**: 点击扩展图标测试popup
- **选项页面**: 右键扩展图标 → "选项"
- **内容脚本**: 访问Salesforce页面，按Ctrl+K测试搜索

## 项目结构

```
1.0.35_0/                # 项目根目录
├── assets/              # 图标和静态资源
├── background.ts        # 后台服务工作进程
├── components/          # React组件
│   └── SearchModal.tsx
├── contents/            # 内容脚本
│   └── salesforce-search.tsx
├── lib/                # 工具库
│   └── salesforce-api.ts
├── popup.tsx           # 弹出窗口
├── options.tsx         # 选项页面
├── types/              # TypeScript类型定义
├── build/              # 构建输出
│   ├── chrome-mv3-dev/   # 开发版本
│   └── chrome-mv3-prod/  # 生产版本
└── backup/             # 旧代码备份
    ├── js/             # 原jQuery版本代码
    ├── css/            # 原样式文件
    └── ...             # 其他备份文件
```

## 开发命令

- `npm run dev` - 开发模式（热重载）
- `npm run build` - 生产构建
- `npm run package` - 打包为.zip文件

## 主要功能模块

### 1. Popup界面 (popup.tsx)
- 组织管理和切换
- 快捷键显示
- 深色主题设计

### 2. 选项页面 (options.tsx)
- Salesforce组织配置
- 搜索设置
- 导入/导出配置

### 3. 搜索模态框 (SearchModal.tsx)
- Raycast风格界面
- 实时搜索
- 键盘导航
- 毛玻璃效果

### 4. 内容脚本 (salesforce-search.tsx)
- Ctrl+K快捷键监听
- Salesforce域名检测
- 搜索模态框注入

### 5. API库 (salesforce-api.ts)
- SOQL查询构建
- 元数据搜索
- 会话管理

## 样式和主题

项目使用：
- **深色主题**: 现代深色界面
- **毛玻璃效果**: backdrop-filter和透明度
- **Raycast风格**: 简洁的搜索界面
- **响应式设计**: 适配不同屏幕尺寸

## 调试技巧

### Chrome开发者工具
1. **弹出窗口调试**: 右键扩展图标 → "检查弹出内容"
2. **选项页面调试**: 在选项页面按F12
3. **内容脚本调试**: 在Salesforce页面按F12，查看Console
4. **后台脚本调试**: chrome://extensions/ → 扩展详情 → "检查视图"

### 热重载
开发模式下，文件修改会自动重新构建，无需手动刷新扩展。

## 开发注意事项

1. **类型安全**: 充分利用TypeScript类型检查
2. **Plasmo约定**: 遵循Plasmo框架的文件命名和结构约定
3. **Chrome API**: 使用@types/chrome获得完整的Chrome API类型支持
4. **CSS-in-JS**: 组件使用styled-jsx进行样式封装
5. **热重载**: 开发时保持dev服务器运行以享受热重载

## 部署流程

### 开发版本
```bash
npm run dev
# 加载 build/chrome-mv3-dev/ 目录
```

### 生产版本
```bash
npm run build
# 加载 build/chrome-mv3-prod/ 目录
```

### 打包发布
```bash
npm run package
# 生成 build/chrome-mv3-prod.zip
```

## 相关链接

- [Plasmo文档](https://docs.plasmo.com/)
- [Chrome扩展开发文档](https://developer.chrome.com/docs/extensions/)
- [Manifest V3迁移指南](https://developer.chrome.com/docs/extensions/migrating/)

---

现在您可以专注在Plasmo项目中开发，所有旧代码已安全备份在backup目录中。
