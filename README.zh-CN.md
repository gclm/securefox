# 🦊 SecureFox

<div align="center">

[![CI](https://github.com/gclm/securefox/workflows/CI/badge.svg)](https://github.com/gclm/securefox/actions)
[![Release](https://github.com/gclm/securefox/workflows/Release/badge.svg)](https://github.com/gclm/securefox/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**一个安全的本地优先密码管理器，支持 Git 同步和现代浏览器扩展**

[English](README.md) | 简体中文

[特性](#-特性) • [安装](#-安装) • [使用](#-使用) • [架构](#-架构) • [安全](#-安全) • [开发](#-开发)

</div>

---

## 🌟 特性

### 🔐 安全优先
- **零知识加密** - 您的主密码永远不会离开您的设备
- **行业标准加密** - AES-256-GCM-SIV 配合 Argon2id/PBKDF2
- **本地优先设计** - 所有数据都保存在您的机器上
- **端到端加密同步** - 可选的基于 Git 的同步

### 🎯 用户体验
- **🦊 现代浏览器扩展** - 使用 React、TypeScript 和 Tailwind CSS 构建的精美 UI
- **🖥️ 命令行界面** - 为高级用户提供功能完整的 CLI
- **🔄 Git 同步** - 使用任何 Git 仓库（GitHub、GitLab、自托管）
- **🔑 TOTP 支持** - 内置 2FA 代码生成（符合 RFC 6238）
- **📥 Bitwarden 导入** - 轻松从 Bitwarden 迁移
- **🚀 快速轻量** - 使用 Rust 编写以获得最佳性能

### 🛠️ 开发者友好
- **RESTful API** - 用于浏览器扩展通信的 HTTP 服务器
- **跨平台** - 可在 macOS、Linux 和 Windows 上运行
- **可扩展** - 模块化架构，关注点清晰分离
- **测试完善** - 全面的测试覆盖和 CI/CD

---

## 📦 安装

### 预编译二进制文件

从 [GitHub Releases](https://github.com/gclm/securefox/releases) 下载适合您平台的最新版本：

**macOS：**
```bash
# Intel (x86_64)
curl -L https://github.com/gclm/securefox/releases/latest/download/securefox-x86_64-apple-darwin.tar.gz | tar xz
sudo mv securefox /usr/local/bin/

# Apple Silicon (aarch64)
curl -L https://github.com/gclm/securefox/releases/latest/download/securefox-aarch64-apple-darwin.tar.gz | tar xz
sudo mv securefox /usr/local/bin/
```

**Linux：**
```bash
# x86_64
curl -L https://github.com/gclm/securefox/releases/latest/download/securefox-x86_64-unknown-linux-gnu.tar.gz | tar xz
sudo mv securefox /usr/local/bin/

# ARM64
curl -L https://github.com/gclm/securefox/releases/latest/download/securefox-aarch64-unknown-linux-gnu.tar.gz | tar xz
sudo mv securefox /usr/local/bin/
```

**Windows：**
从 releases 下载 `securefox-x86_64-pc-windows-msvc.zip` 并解压到您想要的位置。

### 浏览器扩展

1. 从 [GitHub Releases](https://github.com/gclm/securefox/releases) 下载扩展
   - **Chrome/Edge**：`securefox-extension-chrome.zip`
   - **Firefox**：`securefox-extension-firefox.zip`

2. 在浏览器中安装：
   - **Chrome/Edge**：导航到 `chrome://extensions/`，启用"开发者模式"，然后加载解压的扩展
   - **Firefox**：导航到 `about:debugging#/runtime/this-firefox`，点击"加载临时附加组件"，然后选择扩展

### 从源码构建

**前置要求：**
- Rust 1.70+（推荐使用 `rustup`）
- Node.js 20+ 和 pnpm
- Git

```bash
# 克隆仓库
git clone https://github.com/gclm/securefox.git
cd securefox

# 构建 CLI 和 API 服务器
cargo build --release --all-features

# 构建浏览器扩展
cd extension
pnpm install
pnpm build        # 用于 Chrome
pnpm build:firefox # 用于 Firefox

# 安装 CLI
cargo install --path cli
```

---

## 🚀 使用

### 快速开始

```bash
# 初始化新的保险库
securefox init

# 添加新的登录信息
securefox add github.com --username user@example.com

# 列出所有项目
securefox list

# 显示项目详情
securefox show github.com

# 生成强密码
securefox generate --length 32 --symbols

# 为浏览器扩展启动 API 服务器
securefox serve
```

### 命令参考

#### 保险库管理
```bash
# 初始化新保险库
securefox init [--vault <path>] [--kdf argon2|pbkdf2]

# 解锁保险库（开始会话）
securefox unlock [--remember]

# 锁定保险库（结束会话）
securefox lock

# 与 Git 远程同步
securefox sync [--pull] [--push]
```

#### 项目操作
```bash
# 添加新项目
securefox add <name> [--username <user>] [--generate] [--totp <secret>]

# 显示项目详情
securefox show <name> [--copy] [--totp]

# 编辑现有项目
securefox edit <name>

# 删除项目
securefox remove <name> [--force]

# 列出所有项目
securefox list [--folder <name>] [--search <term>] [--detailed]
```

#### 工具
```bash
# 生成密码
securefox generate [--length <n>] [--numbers] [--symbols] [--copy]

# 生成 TOTP 代码
securefox totp <item> [--copy]

# 从 Bitwarden 导入
securefox import <file> --format bitwarden

# 导出保险库
securefox export <file> --format json
```

#### 服务管理（macOS）
```bash
# 安装为系统服务
securefox service enable

# 检查服务状态
securefox service status

# 启动服务
securefox service start

# 停止服务
securefox service stop

# 卸载服务
securefox service disable
```

### 配置

创建 `~/.securefox/config.toml`：

```toml
[vault]
path = "~/.securefox"
kdf = "argon2"  # 或 "pbkdf2"

[api]
host = "127.0.0.1"
port = 8787
timeout = 300  # 秒

[sync]
enabled = true
remote = "git@github.com:username/securefox-vault.git"
auto_pull = true
auto_push = false
interval = 300  # 秒
```

---

## 🏗️ 架构

SecureFox 采用模块化架构构建：

```
securefox/
├── core/           # 核心库（加密、保险库管理）
│   ├── crypto/     # 加密原语
│   ├── models/     # 数据模型
│   ├── storage/    # 保险库存储
│   ├── importers/  # 从其他密码管理器导入
│   ├── git_sync/   # Git 同步
│   └── totp/       # TOTP 生成
├── cli/            # 命令行界面
│   ├── commands/   # CLI 命令
│   └── utils/      # 辅助工具
├── api/            # HTTP API 服务器
│   ├── routes/     # API 端点
│   └── middleware/ # 请求处理
└── extension/      # 浏览器扩展
    ├── entrypoints/ # 扩展入口点
    ├── components/  # React 组件
    ├── hooks/       # React hooks
    └── store/       # 状态管理
```

### 技术栈

**后端（Rust）：**
- `aes-gcm-siv` - 认证加密
- `argon2` / `pbkdf2` - 密钥派生
- `tokio` - 异步运行时
- `axum` - Web 框架
- `git2` - Git 集成（可选）
- `totp-lite` - TOTP 生成

**前端（TypeScript/React）：**
- `React 19` - UI 框架
- `WXT` - 浏览器扩展框架
- `TanStack Query` - 数据获取
- `Zustand` - 状态管理
- `Tailwind CSS` - 样式
- `Radix UI` - 可访问组件

---

## 🔒 安全

### 加密

SecureFox 使用行业标准加密：

| 组件 | 算法 | 用途 |
|-----------|-----------|---------|
| **密钥派生** | Argon2id 或 PBKDF2-HMAC-SHA256 | 从主密码派生加密密钥 |
| **加密** | AES-256-GCM-SIV | 使用认证加密加密保险库数据 |
| **TOTP** | HMAC-SHA1/SHA256 | 生成基于时间的一次性密码 |
| **随机** | OS CSPRNG | 生成安全随机值 |

### 威胁模型

**SecureFox 可防御：**
- ✅ 数据泄露（静态加密）
- ✅ 网络嗅探（E2E 加密同步）
- ✅ 恶意 Git 服务器（E2E 加密）
- ✅ 暴力攻击（Argon2id KDF）
- ✅ 内存转储（安全内存擦除）

**SecureFox 无法防御：**
- ❌ 键盘记录器（使用 2FA 和可信设备）
- ❌ 主密码被泄露（选择强密码）
- ❌ 对解锁设备的物理访问
- ❌ 浏览器/操作系统漏洞

### 最佳实践

1. **使用强主密码**（12+ 字符，大小写混合、数字、符号）
2. **启用 Argon2id KDF** 以获得最大安全性（稍慢）
3. **使用 SSH 密钥进行 Git 同步** 以确保安全同步
4. **不使用时锁定保险库**（超时后自动锁定）
5. **保留备份**（加密保险库可以安全备份）
6. **在从不受信任的来源同步前查看 Git 历史**

---

## 🧪 开发

### 前置要求

- Rust 1.70+ 配合 `rustup`
- Node.js 20+ 和 pnpm
- Git

### 设置

```bash
# 克隆仓库
git clone https://github.com/gclm/securefox.git
cd securefox

# 安装依赖
cargo build
cd extension && pnpm install

# 运行测试
cargo test --all-features
cargo clippy --all-targets --all-features -- -D warnings
cargo fmt --all -- --check
```

### 项目结构

```
├── core/           # 核心库（共享）
├── cli/            # CLI 二进制文件
├── api/            # API 服务器
├── extension/      # 浏览器扩展
├── docs/           # 文档
├── .github/        # CI/CD 工作流
└── issues/         # 项目跟踪
```

### 运行开发环境

**终端 1 - API 服务器：**
```bash
cargo run --bin securefox -- serve --host 127.0.0.1 --port 8787
```

**终端 2 - 浏览器扩展（Chrome）：**
```bash
cd extension
pnpm dev
```

**终端 3 - 浏览器扩展（Firefox）：**
```bash
cd extension
pnpm dev:firefox
```

### 运行测试

```bash
# 单元测试
cargo test

# 集成测试
cargo test --all-features

# 带覆盖率的测试
cargo tarpaulin --all-features --workspace --out Html

# 基准测试
cargo bench
```

### 代码质量

```bash
# 格式化代码
cargo fmt --all

# 运行 linter
cargo clippy --all-targets --all-features -- -D warnings

# 检查安全问题
cargo audit

# 更新依赖
cargo update
```

### 构建发布版

```bash
# 构建优化的二进制文件
cargo build --release --all-features

# 为特定目标构建
cargo build --release --target x86_64-apple-darwin

# 构建扩展
cd extension
pnpm build
pnpm zip
```

---

## 📚 文档

- [用户指南](docs/USER_GUIDE.md) - 全面的使用指南
- [API 文档](docs/API.md) - REST API 参考
- [开发指南](docs/DEVELOPMENT.md) - 贡献指南
- [安全策略](SECURITY.md) - 安全和漏洞报告
- [更新日志](CHANGELOG.md) - 发布历史

---

## 🤝 贡献

欢迎贡献！请先阅读我们的[贡献指南](CONTRIBUTING.md)。

### 贡献方式

- 🐛 通过 [Issues](https://github.com/gclm/securefox/issues) 报告错误和请求功能
- 💻 提交包含错误修复或新功能的拉取请求
- 📖 改进文档
- 🌍 翻译成其他语言
- ⭐ 如果您觉得项目有用，请为其加星

### 开发流程

1. Fork 仓库
2. 创建功能分支（`git checkout -b feature/amazing-feature`）
3. 提交您的更改（`git commit -m 'feat: add amazing feature'`）
4. 推送到分支（`git push origin feature/amazing-feature`）
5. 打开拉取请求

---

## 📝 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件。

---

## 🙏 致谢

- [Bitwarden](https://bitwarden.com/) - 灵感和导入格式
- [Rust Crypto](https://github.com/RustCrypto) - 加密原语
- [WXT](https://wxt.dev/) - 浏览器扩展框架
- [Radix UI](https://www.radix-ui.com/) - 可访问的 UI 组件

---

## 📧 联系方式

- **作者**：GCLM
- **邮箱**：gclm@gclmit.club
- **GitHub**：[@gclm](https://github.com/gclm)
- **仓库**：[github.com/gclm/securefox](https://github.com/gclm/securefox)

---

<div align="center">

**⭐ 如果您觉得这个项目有用，请给它加星！⭐**

用 ❤️ 和 🦀 制作，作者 GCLM

</div>
