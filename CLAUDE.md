# CLAUDE.md - Universal LPC Spritesheet Character Generator

## 项目概述

通用 LPC 精灵表角色生成器 - 基于 Web 的像素艺术角色精灵表生成工具，用于 2D 游戏开发。用户可通过选择不同身体部位、装备、武器、发型等组件组合生成完整的角色精灵表。

在线地址: https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/

## 技术栈

- **前端框架**: Mithril.js (轻量级虚拟 DOM 框架)
- **构建工具**: Vite 8.x
- **UI 框架**: Bulma 1.0.4
- **编程语言**: TypeScript (主要) / JavaScript
- **样式**: SCSS / CSS
- **打包依赖**: JSZip (导出精灵表为 ZIP)
- **代码规范**: ESLint + Prettier
- **单元测试**: Mocha + Chai + Sinon + Testem
- **视觉回归测试**: Playwright
- **部署**: Netlify

## 常用命令

```bash
# 安装依赖
npm install

# 开发模式 (默认 http://localhost:5173)
npm run dev

# 开发模式并自动打开浏览器
npm run serve:open

# 生产构建
npm run build

# 预览构建结果 (默认 http://localhost:4173)
npm run preview

# 代码检查
npm run lint

# 代码格式化
npm run format

# 单元测试
npm test

# 视觉回归测试
npm run test:visual
```

## 项目结构

```
Universal-LPC-Spritesheet-Character-Generator/
├── index.html                  # 入口 HTML
├── package.json                # 项目配置
├── vite.config.js              # Vite 构建配置
├── tsconfig.json               # TypeScript 配置
├── eslint.config.js            # ESLint 配置
├── playwright.config.js        # Playwright 测试配置
├── sources/                    # 主要源代码
│   ├── main.ts                 # 应用入口
│   ├── canvas/                 # Canvas 渲染引擎
│   │   ├── renderer.ts         # 核心渲染器
│   │   ├── palette-recolor.ts  # 调色板重着色 (CPU)
│   │   └── webgl-palette-recolor.ts  # WebGL GPU 加速重着色
│   ├── components/             # Mithril UI 组件
│   │   ├── App.ts              # 主应用组件
│   │   ├── FiltersPanel.ts     # 过滤面板
│   │   ├── preview/            # 动画预览
│   │   ├── selections/         # 部件选择界面
│   │   ├── filters/            # 过滤器
│   │   └── download/           # 下载功能
│   ├── state/                  # 状态管理
│   │   ├── catalog.ts          # 物品目录/注册表
│   │   ├── state.ts            # 应用状态管理
│   │   ├── hash.ts             # URL 哈希参数管理
│   │   └── palettes.ts         # 调色板状态
│   ├── styles/                 # 样式文件
│   └── utils/                  # 工具函数
├── sheet_definitions/          # 精灵表部件定义 (JSON)
├── spritesheets/               # 精灵图 PNG 资源
├── palette_definitions/        # 调色板定义
├── vite/                       # Vite 自定义插件
├── scripts/                    # 构建/工具脚本
├── tests/                      # 测试文件
├── styles/                     # 全局样式
├── lang/                       # 国际化翻译
└── public/                     # 静态资源
```

## 主要功能模块

### 1. 角色部件系统 (sheet_definitions/)

JSON 定义文件，按部位分类:

- body (身体), head (头部), hair (发型), eyes (眼睛), beards (胡须)
- torso (躯干/上装), legs (腿部/下装), feet (脚部/鞋子)
- arms (手臂/手套/护肩), hat (帽子), neck (颈部)
- backpack (背包), cape (披风), dress (裙子)
- shield (盾牌), quiver (箭袋), shadow (阴影), weapons (武器)

### 2. 调色板系统 (palette_definitions/)

颜色重映射系统，支持对身体、头发、眼睛、衣物、金属等颜色进行实时重着色。
包含 GPU 加速的 WebGL 着色器和 CPU 回退模式。

### 3. Canvas 渲染引擎 (sources/canvas/)

核心渲染逻辑，负责将各部件精灵图组合成完整角色精灵表。

### 4. 状态管理 (sources/state/)

- catalog.ts: 物品目录/注册表
- state.ts: 应用状态管理
- hash.ts: URL 哈希参数管理 (支持分享配置)
- palettes.ts: 调色板状态
- filters.ts: 过滤器状态

## 开发规范

### 代码风格

- 使用 TypeScript 进行类型检查
- 遵循 ESLint + Prettier 代码规范
- 提交前运行 `npm run lint` 和 `npm run format`

**重要：不要运行全局格式化命令（如 `npm run format`）**，这会修改大量无关文件，污染 git 提交历史。只对实际修改过的文件运行格式化：`npx prettier --write <file>`。如果没有实际的代码修改，不要仅仅因为代码格式化产生代码变更。

### 测试

- 单元测试: `npm test` (Mocha + Chai + Sinon)
- 视觉回归测试: `npm run test:visual` (Playwright)
- 确保所有测试通过后再提交代码

### 国际化

- 支持多语言，翻译文件位于 `lang/` 目录
- 新增文本需添加到翻译文件中
- 使用 `lang/i18n.ts` 中的 `t()` 函数进行文本翻译
- 翻译文件: `lang/zh.json` (中文), `lang/en.json` (英文)
- 当前默认语言: 中文 (zh)

## 许可证

项目中的美术资源采用多种开源许可: CC0、CC-BY、CC-BY-SA、OGA-BY、GPL。
使用生成器输出的精灵图时，必须按照各资源的许可要求进行署名。
完整署名信息见 `CREDITS.csv` 文件。

## 贡献指南

详见 `CONTRIBUTING.md` 文件。
