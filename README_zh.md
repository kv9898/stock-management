# 库存管理系统

基于 Tauri、React、Rust 和 TypeScript 构建的现代化桌面应用程序，用于管理库存、跟踪库存价值、管理借还货和监控产品过期日期。

## 🚀 技术栈

- **前端**: React + TypeScript + Vite
- **后端**: Rust + Tauri
- **数据库**: Turso (LibSQL) - Serverless SQLite
- **样式**: CSS Modules
- **图标**: Lucide React

## 📋 功能特性

- **库存管理**: 跟踪库存数量、过期日期和产品详情
- **价值仪表板**: 实时财务概览，按类别显示库存价值
- **过期监控**: 自动提醒即将过期和已过期产品
- **产品目录**: 管理产品信息和定价
- **借出跟踪**: 跟踪借出/归还交易（净借出价值）
- **响应式界面**: 简洁现代的界面，支持实时更新

## 🛠️ 配置说明

### 数据库设置 (Turso)

应用程序使用 **Turso** (LibSQL) 作为数据库后端。设置步骤：

1. **创建 Turso 数据库**:
   访问 [https://app.turso.tech/](https://app.turso.tech/) 创建一个新数据库（免费！）

   记下创建后提供的数据库 URL 和令牌，配置时需要用到

2. **配置应用设置**:
   打开库存管理应用。首次启动时，系统会提示输入 Turso 数据库 URL 和令牌。这些信息将保存在本地存储 (AppConfig) 中供以后使用

3. **创建数据表**:
   在交互式控制台中运行 `db.py` 脚本（因为使用了 `async`）。该脚本将从存储中读取数据库 URL 和令牌，并用它们在数据库中创建必要的表。主要依赖 `libsql_client` 包

   您也可以使用其他 libsql 客户端，手动运行 `db.py` 中的 SQL 命令

## 🔧 开发指南

### 前置要求

- **Python** 及 `libsql_client` 包和交互式控制台：用于运行数据库设置脚本
- **Bun** (开发用)：JavaScript/TypeScript 前端的依赖管理器
- **Rust 工具链** (开发用)：用于构建 Tauri 后端

1. **克隆并安装依赖**:

   ```bash
   git clone https://github.com/kv9898/stock-management.git
   bun install
   ```

2. **运行开发环境**:

   ```bash
   bun tauri dev
   ```

   如果您使用基于 VS Code 的编辑器/IDE，这一步也可以使用提供的调试配置。

3. **构建生产版本**:

   ```bash
   bun tauri build
   ```

   这将在 src-tauri/target/release 目录中为您的平台创建独立可执行文件

   如果需要打包安装程序，可以在构建命令后附加目标安装程序格式（如 nsis、wsi、dmg）。例如，对于 Windows：

   ```bash
    bun tauri build --bundles nsis
   ```

   这将在 src-tauri/target/release/bundle 目录中创建安装程序。请注意，每个平台的安装包格式可能不同。

## 📁 项目结构

```
src/
├── components/          # 可复用的 UI 组件
├── panes/              # 主应用面板
│   ├── Dashboard/      # 产品总价仪表板
│   ├── ViewStock/      # 库存管理
│   ├── AddStock/       # 添加新库存
│   ├── Product/        # 产品目录
│   └── Settings/       # 配置
├── types/              # TypeScript 类型定义
├── App.css             # 全局样式
├── App.tsx             # 主应用组件
├── main.tsx            # React 入口点（App 的包装）
├── tabs.css            # 导航侧边栏样式
├── tabs.tsx            # 控制面板之间的导航
├── theme.ts            # MUI 主题配置
└── vite-env.d.ts       # Vite 环境类型

src-tauri/
├── capabilities/       # Tauri 功能（如权限）
├── icons/              # 应用图标，由 `tauri icon` 生成
├── src/
│   ├── config.rs       # 配置管理
│   ├── dashboard.rs    # 仪表板价值计算
│   ├── db.rs           # 数据库操作（和 SQL 辅助函数）
│   ├── lib.rs          # 注册所有模块/后端命令
│   ├── loan.rs         # 借出管理
│   ├── main.rs         # Tauri 入口点（请勿编辑）
│   ├── product.rs      # 产品管理
│   ├── stock.rs        # 库存管理
│   └── summary.rs      # 查看库存计算
├── target/             # 编译输出目录
│   ├── debug/          # 调试版本（请勿直接运行）
│   └── release/        # 发布版本（无依赖可执行文件）
│        └── bundle     # 安装程序包（如 nsis、wsi、dmg）
├── .gitignore          # Git 忽略规则 （自动生成）
├── build.rs            # 自动生成的 Tauri 构建脚本（请勿编辑）
├── Cargo.lock          # Rust 依赖锁定文件
├── Cargo.toml          # Rust 依赖和项目元数据
└── tauri.conf.json     # Tauri 配置文件
```
