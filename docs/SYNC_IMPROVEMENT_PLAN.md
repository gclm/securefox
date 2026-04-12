# SecureFox 同步改进方案

> 目标：让新电脑上的同步和初始化流程变得简单，同时为插件增加完整的同步能力。

## 当前问题

| 场景 | 现状 | 痛点 |
|------|------|------|
| 新电脑首次使用 | 必须先跑 CLI 才能同步 vault | 用户记不住命令 |
| 插件打开 | 直接进入登录页，未登录无法操作 | 没有 vault 就无法登录，无法进入设置 |
| 同步操作 | 完全依赖 CLI | 日常同步不够方便 |
| 拉取失败 | 无重试机制，需手动重新拉取 | 网络不稳定时体验差 |
| 同步状态 | 无可见的同步状态 | 不知道同步是否成功 |

## 前置要求提示

**插件端所有同步操作的前提：用户必须使用 SSH 协议的 Git 远程地址**（如 `git@github.com:user/vault.git`），且已在本地配置好 SSH 密钥（`~/.ssh/id_ed25519` 或 `ssh-agent`）。

原因：
- HTTPS 协议需要交互式输入用户名/密码或 Personal Access Token，浏览器扩展无法提供
- SSH 密钥认证无需交互，适合后台静默同步

### 用户引导提示

当用户尝试配置同步时，如果未检测到 SSH 密钥，应显示：

```
⚠️ 请先配置 SSH 密钥

SecureFox 使用 SSH 进行 Git 同步。请按以下步骤配置：

1. 生成 SSH 密钥（如已有可跳过）：
   ssh-keygen -t ed25519 -C "your_email@example.com"

2. 将公钥添加到你的 Git 托管平台：
   cat ~/.ssh/id_ed25519.pub
   → 复制到 GitHub Settings → SSH and GPG keys → New SSH key

3. 测试连接：
   ssh -T git@github.com

4. 完成后再尝试同步配置。
```

---

## 整体架构

### 三个状态层级

插件打开后检测 API 状态，按以下优先级显示对应页面：

```
1. 未初始化（~/.securefox/vault.sf 不存在）
   → 显示 SetupView（首次设置引导页）

2. 已初始化但未解锁
   → 显示 UnlockForm + 同步按钮

3. 已解锁
   → 显示 MainView（现有主页面）
```

### 能力对齐

| 能力 | CLI | 插件 |
|------|-----|------|
| 克隆远程 vault | `securefox sync clone --remote <url>` | ✅ 首次设置页 |
| 初始化新 vault | `securefox init --remote <url>` | ❌（仅 CLI） |
| 双向同步 | `securefox sync` | ✅ 同步按钮 |
| 配置远程地址 | `securefox sync remote <url>` | ✅ 设置页 |
| 查看同步状态 | `securefox sync status` | ✅ 状态指示器 |
| 启用/禁用自动同步 | `securefox sync enable/disable` | ✅ 开关 |

---

## Phase 1: 核心同步改进（后端）

### 1.1 新增 `GitSync::clone()`

```rust
pub fn clone<P: AsRef<Path>>(remote_url: &str, local_path: P) -> Result<CloneResult, SyncError>
```

- 类似 `git clone`，从远程仓库克隆到本地
- 自动创建 `.securefox` 目录和 config 文件
- 验证 `vault.sf` 是否存在
- 返回克隆结果（成功/失败 + 错误分类）

### 1.2 新增 `GitSync::pull_with_retry()`

```rust
pub fn pull_with_retry(&self, retry_config: &RetryConfig) -> Result<bool, SyncError>
```

- 指数退避重试（默认 3 次，1s → 2s → 4s）
- 自动识别错误类型：
  - `SyncError::Network` — 网络错误，可重试
  - `SyncError::Auth` — 认证错误，不可重试（SSH 密钥未配置）
  - `SyncError::Conflict` — 合并冲突
  - `SyncError::Config` — 配置错误（无远程地址等）

### 1.3 改进 `smart_sync()`

- 先拉后推，带回滚
- 返回结构化结果 `SyncResult { pulled, pushed, error }`
- 拉取失败不阻断推送

### 1.4 修复自动同步错误静默吞掉

- `storage.rs` 中 `let _ = git_sync.auto_commit_push(...)` 改为 `tracing::warn!`
- `api/src/state.rs` 同理

---

## Phase 2: API 端点实现

### 2.1 实现真实同步端点

| 端点 | 方法 | 认证 | 说明 |
|------|------|------|------|
| `/api/sync/push` | POST | 需要 | 触发 smart_sync（先拉后推） |
| `/api/sync/pull` | POST | 需要 | 拉取远程变更（带重试） |
| `/api/sync/clone` | POST | 不需要 | 克隆远程 vault（新电脑专用） |
| `/api/sync/status` | GET | 不需要 | 返回同步配置和状态 |

### 2.2 新增请求/响应模型

```rust
// Sync status
struct SyncStatusResponse {
    configured: bool,
    remote_url: Option<String>,
    sync_enabled: bool,
    sync_mode: Option<String>,    // "manual" | "auto"
    has_local_changes: Option<bool>,
    has_remote_updates: Option<bool>,
    last_error: Option<String>,
}

// Clone
struct CloneRequest {
    remote_url: String,
}

struct CloneResponse {
    success: bool,
    message: String,
    vault_path: String,
}
```

### 2.3 响应格式增强

```json
{
  "success": true,
  "message": "Synced: pulled remote changes and pushed local changes",
  "items_synced": 0,
  "pulled": true,
  "pushed": true,
  "error": null
}
```

---

## Phase 3: 浏览器插件同步 UI

### 3.1 插件状态检测逻辑（App.tsx）

```
启动时检测:
  1. 调用 GET /api/status → 检查 vault 是否存在
  2. vault 不存在 → 显示 SetupView
  3. vault 存在但未解锁 → 显示 UnlockForm + 同步按钮
  4. 已解锁 → 显示 MainView
```

### 3.2 SetupView（首次设置页）

```
┌─────────────────────────────────┐
│                                 │
│        [SecureFox Logo]         │
│                                 │
│     欢迎使用 SecureFox           │
│     从远程同步你的密码库          │
│                                 │
│     ┌─────────────────────┐     │
│     │ git@github:...      │     │
│     └─────────────────────┘     │
│                                 │
│        [ 同步密码库 ]           │
│                                 │
│     ─────── 或 ───────           │
│                                 │
│     使用命令行创建新密码库        │
│     $ securefox init            │
│       --remote <git-url>        │
│                                 │
│     [ 跳过，直接解锁 ]           │
│                                 │
└─────────────────────────────────┘
```

**交互流程：**

1. 输入 Git SSH URL（如 `git@github.com:user/vault.git`）
2. 点击「同步密码库」→ 调用 `POST /api/sync/clone`
3. 克隆成功 → 自动跳转到 UnlockForm
4. 克隆失败 → 显示错误原因（网络/认证/配置）
5. 点击「跳过，直接解锁」→ 如果本地已有 vault，进入 UnlockForm
6. 「使用命令行」区域提示前提条件（SSH 配置）

### 3.3 设置页增加「同步配置」区块

```
┌─ 同步设置 ──────────────────────────────┐
│                                         │
│ 📦 远程仓库: git@github.com:xxx/vault   │
│                                         │
│ [ 🔄 立即同步 ]   [ ✏️ 更换远程 ]       │
│                                         │
│ ─────────────────────────────────────── │
│                                         │
│ 自动同步  [开/关]                        │
│ 同步间隔: [10 分钟 ▼]                    │
│                                         │
│ 状态: 2 分钟前同步成功                   │
│ 错误: 无                                 │
│                                         │
└─────────────────────────────────────────┘
```

### 3.4 同步状态指示器

- 在主页面顶部显示同步状态（小圆点 + 时间）
- 🟢 绿色：最近 5 分钟内同步过
- 🟡 黄色：5 分钟前 ~ 1 小时前
- 🔴 红色：同步失败 / 超过 1 小时

### 3.5 错误提示

同步失败时显示可操作的错误信息：

| 错误类型 | 用户可见提示 | 建议操作 |
|----------|-------------|---------|
| `Network` | "网络连接失败，请检查网络后重试" | 自动重试按钮 |
| `Auth` | "认证失败，请确认 SSH 密钥已配置" | 查看 SSH 配置指南 |
| `Config` | "未配置远程仓库地址" | 输入 Git URL |
| `Conflict` | "检测到合并冲突，已自动采用远程版本" | 查看详情 |

---

## Phase 4: CLI 简化

### 4.1 命令重命名

| 旧命令 | 新命令 | 说明 |
|--------|--------|------|
| `securefox sync config <url>` | `securefox sync remote <url>` | 配置远程地址，更直观 |

### 4.2 简化后的完整命令列表

```
securefox sync                    # 双向同步（默认先拉后推）
securefox sync remote <url>       # 配置远程 Git 地址
securefox sync clone --remote <url>   # 从远程克隆 vault（新电脑）
securefox sync status             # 查看同步状态
securefox sync enable             # 启用自动同步
securefox sync disable            # 禁用自动同步
```

### 4.3 新电脑推荐流程（CLI 路径）

```bash
# 1. 从远程克隆 vault
securefox sync clone --remote git@github.com:user/vault.git

# 2. 解锁 vault
securefox unlock

# 3. 启动服务
securefox service start
```

### 4.4 新电脑推荐流程（插件路径）

1. 打开浏览器扩展
2. 在 SetupView 中输入 Git SSH URL
3. 点击「同步密码库」
4. 输入主密码解锁
5. 完成

---

## 技术实现要点

### 文件变更清单

```
core/src/git_sync.rs          # 新增 clone(), pull_with_retry(), SyncError
core/src/storage.rs           # 修复自动同步错误处理
core/src/config.rs            # 新增 with_vault_dir()
api/src/handlers/mod.rs       # 实现真实同步端点
api/src/models.rs             # 新增同步请求/响应模型
api/src/lib.rs                # 注册新路由
api/src/state.rs              # 修复自动同步错误处理
cli/src/main.rs               # 新增 clone 子命令
cli/src/commands/sync_clone.rs # 克隆命令实现
cli/src/commands/mod.rs       # 注册新模块
extension/types/index.ts      # 新增同步类型定义
extension/utils/constants.ts  # 新增同步端点常量
extension/lib/api/sync.ts     # 新增同步 API 调用
extension/entrypoints/popup/App.tsx  # 状态检测逻辑
extension/components/SetupView.tsx   # 首次设置页（新文件）
extension/components/SettingsView.tsx # 增加同步配置区块
extension/components/SyncStatusBadge.tsx # 同步状态指示器（新文件）
```

### 错误分类体系

```rust
pub enum SyncError {
    Network(String),    // 网络错误（可重试）
    Auth(String),       // 认证错误（不可重试，需配置 SSH）
    Conflict(String),   // 合并冲突
    Config(String),     // 配置错误
    Other(String),      // 其他错误
}
```

---

## 实施计划

| 阶段 | 内容 | 状态 |
|------|------|------|
| Phase 1 | 核心同步改进 | 已完成 |
| Phase 2 | API 端点实现 | 已完成 |
| Phase 3 | 插件同步 UI | 进行中 |
| Phase 4 | CLI 简化 | 进行中 |
