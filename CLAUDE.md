# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

**SecureFox** 是一个本地优先的密码管理器，采用 Rust Workspace 架构，包含核心库、CLI 工具、API 服务器和浏览器扩展。

### 架构特点

- **Rust Workspace**: 三成员结构 (`core`, `api`, `cli`) 共享依赖和版本
- **零知识加密**: 主密码永不离开设备，使用 AES-256-GCM-SIV + Argon2id
- **Git 同步**: 通过 `git2` 实现端到端加密的跨设备同步
- **双向通信**: 浏览器扩展通过本地 HTTP API (Axum) 与守护进程交互

## 常用命令

### Rust 后端开发

```bash
# 构建和安装（推荐用于日常开发）
make update          # 停止服务、构建发布版、安装、重启服务
make dev             # 快速更新（跳过服务停止）
make install         # 首次安装到 /usr/local/bin

# 测试和质量检查
make test            # 运行所有测试
make fmt             # 格式化代码
cargo clippy --all-targets --all-features -- -D warnings

# 服务管理（安装后）
securefox service start     # 启动 API 守护进程
securefox service stop      # 停止服务
securefox service status    # 查看状态
securefox service enable    # 安开机自启（macOS launchd）
```

### 浏览器扩展开发

```bash
cd extension
pnpm install
pnpm dev              # Chrome 开发模式（热重载）
pnpm dev:firefox      # Firefox 开发模式
pnpm build            # 构建生产版本
pnpm zip              # 打包为 .zip（用于发布）
```

**⚠️ 重要：代码修改后的验证流程**

每次修改 extension/ 目录下的代码后，**必须**运行以下命令验证：

```bash
cd extension
pnpm compile         # TypeScript 类型检查
pnpm build           # 构建验证
```

- `pnpm compile` 确保没有 TypeScript 类型错误
- `pnpm build` 确保扩展可以成功构建

**只有两个命令都成功通过后，代码修改才算完成。**

### 完整开发工作流

```bash
# 终端 1: 运行 API 服务器
cargo run --bin securefox -- serve --port 8787

# 终端 2: 运行浏览器扩展
cd extension && pnpm dev
```

## 核心代码架构

### Rust Workspace 结构

```
securefox/
├── core/           # 核心库（被其他 crate 共享）
│   ├── crypto.rs       # 加密引擎（Argon2id、AES-256-GCM-SIV）
│   ├── storage.rs      # Vault 加密存储
│   ├── models.rs       # 数据模型（Bitwarden 兼容格式）
│   ├── git_sync.rs     # Git 同步逻辑
│   ├── totp.rs         # TOTP 生成（RFC 6238）
│   ├── keychain.rs     # 系统密钥链集成
│   └── importers/      # Bitwarden 导入器
│
├── api/            # HTTP API 服务器
│   ├── lib.rs          # Axum 服务器设置
│   ├── handlers/       # API 端点处理
│   ├── auth.rs         # JWT 会话管理
│   └── state.rs        # 共享应用状态
│
└── cli/            # 命令行工具
    ├── main.rs         # clap CLI 入口
    └── commands/       # 子命令实现
```

**关键依赖关系**:
- `cli` 依赖 `core` 和 `api`（通过 feature flag）
- `api` 依赖 `core`
- `core` 是独立库，可选 features: `git`, `keychain`

### 浏览器扩展结构

```
extension/
├── entrypoints/
│   ├── background.ts   # Service Worker（扩展后台逻辑）
│   ├── content.ts      # Content Script（页面注入，自动填充）
│   └── popup/          # 弹出窗口入口
│
├── components/         # React 组件
│   ├── MainView.tsx
│   ├── EntryList.tsx
│   ├── AddItemModal.tsx
│   ├── LoginDetailView.tsx
│   └── SettingsView.tsx
│
├── store/              # Zustand 状态管理
├── hooks/              # 自定义 React Hooks
└── utils/              # 工具函数
```

**通信模式**:
- `background.ts` 通过 HTTP 与本地 API 通信 (`http://127.0.0.1:8787`)
- `content.ts` 通过 chrome.runtime.sendMessage 与 background 通信
- 状态使用 `@tanstack/react-query` 管理服务器数据

## 重要技术细节

### 加密流程 (core/src/crypto.rs)

1. **密钥派生**: 使用 Argon2id 或 PBKDF2 从主密码派生密钥
2. **Vault 加密**: AES-256-GCM-SIV（防重放攻击）
3. **内存安全**: 使用 `zeroize` 清除敏感数据

### Git 同步 (core/src/git_sync.rs)

- 使用 `git2` 库进行 Git 操作
- 支持通过 SSH 或 HTTPS 同步
- 自动处理合并冲突（JSON 三方合并）
- 加密数据存储在 Git 仓库中

### API 认证 (api/src/auth.rs)

- JWT Token 认证
- Token 存储在浏览器 `storage.session` 中
- 15 分钟过期时间
- 支持可选的密钥链集成（记住密码）

### Bitwarden 兼容性

- 数据模型与 Bitwarden 格式兼容
- 支持导入加密的 `.json` 导出文件
- 支持 folders、items（login/card/identity/note）

## Feature Flags

Rust crates 使用 feature flags 控制可选功能：

```toml
# core features
default = ["git", "keychain"]
git = ["dep:git2"]
keychain = ["dep:keyring"]
vendored-ssl = ["git2?/vendored-openssl"]

# cli features
default = ["serve", "git", "keychain"]
serve = ["dep:securefox-api"]
```

## 服务管理（macOS）

- 服务使用 launchd 管理
- Plist 文件: `~/Library/LaunchAgents/club.gclmit.securefox.plist`
- 日志位置: `/tmp/securefox.log`
- PID 文件: `~/.securefox/service.pid`

## 数据目录

```
~/.securefox/
├── vault.sf              # 加密的密码库
├── config.toml           # 用户配置
├── service.pid           # 服务 PID
└── backups/              # 自动备份
```

## 常见开发任务

### 添加新的 API 端点

1. 在 `api/src/handlers/` 中添加处理函数
2. 在 `api/src/lib.rs` 中注册路由
3. 在 `extension/entrypoints/background.ts` 中添加客户端调用

### 添加新的 CLI 命令

1. 在 `cli/src/commands/` 中创建新模块
2. 在 `cli/src/main.rs` 中使用 clap 定义子命令
3. 实现命令逻辑（调用 `core` 或 `api`）

### 修改数据模型

1. 在 `core/src/models.rs` 中更新结构体
2. 确保保持 Bitwarden 兼容性
3. 更新导入器/导出器（如需要）
4. 同步更新 TypeScript 接口（`extension/`）

## 安全注意事项

- 所有加密操作必须在 `core` crate 中完成
- 主密码和派生密钥永远不能写入日志
- 使用 `zeroize` 清除敏感内存数据
- API 仅监听 localhost（127.0.0.1）
- 敏感数据传输使用 HTTPS（仅用于 Git 远程）
