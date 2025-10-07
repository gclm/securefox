# SecureFox 使用指南

SecureFox 是一个本地优先的密码管理器，具有 Git 同步、浏览器扩展和 TOTP 支持。

## 目录

- [快速开始](#快速开始)
- [基础使用](#基础使用)
- [密码库管理](#密码库管理)
- [密码项管理](#密码项管理)
- [数据导入导出](#数据导入导出)
- [Git 同步](#git-同步)
- [工具命令](#工具命令)
- [后台服务](#后台服务)
- [浏览器扩展](#浏览器扩展)
- [安全性](#安全性)
- [故障排除](#故障排除)

---

## 快速开始

### 安装

#### 从源码编译

```bash
# 克隆仓库
git clone https://github.com/yourusername/securefox
cd securefox

# 编译并安装
make install
```

#### 使用 Makefile

```bash
# 编译发布版本
make release

# 安装到系统
make install

# 查看版本
securefox version
```

### 初始化密码库

```bash
# 创建新的密码库
securefox vault init

# 或指定 KDF 算法（pbkdf2 或 argon2）
securefox vault init --kdf argon2

# 带 Git 远程的初始化
securefox vault init --remote git@github.com:username/vault.git
```

首次运行会提示您设置主密码，这是保护所有数据的唯一密钥。

**⚠️ 重要提示：**
- 主密码无法找回，请务必牢记
- 建议使用强密码（至少 12 个字符，包含大小写字母、数字和符号）
- 可以使用密码短语，如 "correct-horse-battery-staple"

---

## 基础使用

### 解锁密码库

```bash
# 解锁密码库（会话有效期内）
securefox vault unlock

# 解锁并记住密码到系统钥匙串
securefox vault unlock --remember
```

### 锁定密码库

```bash
securefox vault lock
```

### 查看版本信息

```bash
# 简单版本
securefox --version

# 详细构建信息
securefox version
```

输出示例：
```
SecureFox
─────────────────────────────────────────
Version:      1.0.0
Git Branch:   main
Git Commit:   a1b2c3d
Build Time:   2025-01-08 10:30:00 UTC
Rust Version: 1.75.0
```

---

## 密码库管理

### Vault 命令结构

```bash
securefox vault <subcommand>
```

### 可用子命令

| 命令 | 说明 |
|------|------|
| `init` | 初始化新密码库 |
| `unlock` | 解锁密码库 |
| `lock` | 锁定密码库 |
| `sync` | Git 同步管理 |

### 密码库位置

默认位置：`~/.securefox/vault.sf`

自定义位置：
```bash
# 使用环境变量
export SECUREFOX_VAULT=/path/to/vault

# 或使用命令行参数
securefox --vault /path/to/vault vault unlock
```

---

## 密码项管理

### 添加密码项

#### 登录凭据

```bash
# 基本添加
securefox item add "GitHub"

# 指定用户名
securefox item add "GitHub" --username myusername

# 自动生成密码
securefox item add "GitHub" --username myusername --generate

# 添加 TOTP（2FA）
securefox item add "GitHub" \
  --username myusername \
  --generate \
  --totp "otpauth://totp/GitHub:user?secret=JBSWY3DPEHPK3PXP"
```

#### 其他类型

```bash
# 安全笔记
securefox item add "Bank PIN" --type note

# 信用卡
securefox item add "Visa Card" --type card

# 身份信息
securefox item add "Passport" --type identity
```

### 查看密码项

```bash
# 列出所有项目
securefox item list

# 按类型筛选
securefox item list --type login

# 搜索
securefox item list --search github

# 详细信息
securefox item list --detailed

# 查看特定项目
securefox item show "GitHub"

# 复制密码到剪贴板
securefox item show "GitHub" --copy

# 显示 TOTP 代码
securefox item show "GitHub" --totp
```

### 编辑密码项

```bash
securefox item edit "GitHub"
```

会打开交互式编辑器，可以修改：
- 用户名
- 密码
- TOTP 密钥
- 备注
- URL

### 删除密码项

```bash
# 带确认提示
securefox item remove "GitHub"

# 强制删除（无提示）
securefox item remove "GitHub" --force
```

---

## 数据导入导出

### 从 Bitwarden 导入

```bash
# 导出 Bitwarden 数据（在 Bitwarden 中）
# Tools -> Export Vault -> JSON

# 导入到 SecureFox
securefox data import bitwarden-export.json --format bitwarden
```

### 从 CSV 导入

```bash
securefox data import passwords.csv --format csv
```

CSV 格式：
```csv
name,username,password,url,notes
GitHub,user@example.com,password123,https://github.com,My notes
```

### 导出数据

```bash
# 导出为 Bitwarden 格式
securefox data export vault-backup.json --format bitwarden

# 导出为 CSV
securefox data export vault-backup.csv --format csv
```

**⚠️ 安全提示：**
- 导出的文件是未加密的
- 导出后请妥善保管或及时删除
- 建议在安全环境下进行导入导出操作

---

## Git 同步

详细的 Git 同步功能请参考 [AUTO_SYNC_CN.md](./AUTO_SYNC_CN.md)。

### 快速配置

```bash
# 1. 配置远程仓库
securefox vault sync config git@github.com:username/vault.git

# 2. 首次推送
securefox vault sync push

# 3. 启用自动同步
securefox vault sync enable --mode push-on-change
```

### 基本同步命令

```bash
# 推送到远程
securefox vault sync push

# 从远程拉取
securefox vault sync pull

# 查看同步状态
securefox vault sync status

# 查看自动同步配置
securefox vault sync show
```

### 同步模式

| 模式 | 说明 | 适用场景 |
|------|------|----------|
| `manual` | 手动同步 | 完全控制同步时机 |
| `auto-pull` | 定时拉取 | 多设备协作 |
| `push-on-change` | 变更即推送 | 单设备自动备份 |
| `full` | 双向同步 | 多设备频繁切换 |

---

## 工具命令

### 生成随机密码

```bash
# 默认密码（16位，包含字母和数字）
securefox tools generate

# 自定义长度
securefox tools generate --length 24

# 不包含数字
securefox tools generate --no-numbers

# 不包含符号
securefox tools generate --no-symbols

# 复制到剪贴板
securefox tools generate --copy
```

### 生成 TOTP 代码

```bash
# 为特定项目生成 TOTP
securefox tools totp "GitHub"

# 复制到剪贴板
securefox tools totp "GitHub" --copy
```

TOTP 代码格式：
```
TOTP: 123456 (expires in 25s)
```

---

## 后台服务

SecureFox 可以作为后台服务运行，为浏览器扩展提供 API。

### 服务管理

```bash
# 启动服务
securefox service start

# 自定义端口和超时
securefox service start --port 8787 --host 127.0.0.1 --timeout 900

# 停止服务
securefox service stop

# 重启服务
securefox service restart

# 查看状态
securefox service status
```

### 系统服务安装（macOS）

```bash
# 安装为 launchd 服务（自动启动）
securefox service install

# 卸载服务
securefox service uninstall
```

服务安装后会：
1. 复制二进制文件到 `/usr/local/bin/securefox`
2. 创建 launchd plist
3. 开机自动启动
4. 在后台持续运行

### 服务配置

服务默认配置：
- **端口**: 8787
- **主机**: 127.0.0.1（仅本地访问）
- **超时**: 900 秒（15 分钟）

配置文件位置：
- PID 文件: `~/.securefox/service.pid`
- 日志文件: `~/.securefox/service.log`
- 错误日志: `~/.securefox/service.err`

查看日志：
```bash
# 实时查看日志
tail -f ~/.securefox/service.log

# 查看错误
tail -f ~/.securefox/service.err
```

---

## 浏览器扩展

### 安装扩展

#### Chrome/Edge

1. 编译扩展：
```bash
cd extension
pnpm install
pnpm build
```

2. 加载扩展：
   - 打开 `chrome://extensions/`
   - 启用"开发者模式"
   - 点击"加载已解压的扩展程序"
   - 选择 `extension/.output/chrome-mv3` 目录

#### Firefox

```bash
cd extension
pnpm install
pnpm build:firefox
```

加载方式：
- 打开 `about:debugging#/runtime/this-firefox`
- 点击"临时载入附加组件"
- 选择 `extension/.output/firefox-mv3/manifest.json`

### 连接本地服务

1. 确保后台服务正在运行：
```bash
securefox service status
```

2. 打开扩展，首次使用会提示连接到本地服务

3. 输入主密码解锁

### 功能特性

- 🔍 **自动填充** - 检测登录表单并自动填充
- 🔑 **密码生成** - 右键菜单快速生成强密码
- 📋 **密码查看** - 搜索和查看所有密码项
- 🔐 **TOTP 支持** - 一键复制 2FA 代码
- 🎨 **现代 UI** - 基于 React 的流畅界面

---

## 安全性

### 加密算法

SecureFox 使用业界标准的加密技术：

| 组件 | 算法 | 说明 |
|------|------|------|
| KDF | PBKDF2-SHA256 / Argon2id | 密钥派生函数 |
| 加密 | AES-256-GCM-SIV | 认证加密 |
| TOTP | HMAC-SHA1/SHA256 | RFC 6238 标准 |

### 密钥派生参数

**PBKDF2**（默认）：
- 迭代次数: 100,000
- 盐值: 32 字节随机数
- 输出: 256 位密钥

**Argon2id**（推荐）：
- 内存: 64 MB
- 迭代: 3
- 并行度: 4
- 输出: 256 位密钥

### 零知识架构

- 主密码**永不**离开您的设备
- 所有加密/解密在本地完成
- 服务器（如果使用）只存储加密数据
- Git 仓库中也是加密数据

### 最佳安全实践

1. **使用强主密码**
   - 至少 12 个字符
   - 包含大小写、数字、符号
   - 避免常见单词和个人信息

2. **启用系统钥匙串**
```bash
securefox vault unlock --remember
```

3. **定期备份**
```bash
# 导出加密备份
cp ~/.securefox/vault.sf ~/Backups/vault-$(date +%Y%m%d).sf

# 或使用 Git 同步
securefox vault sync push
```

4. **锁定会话**
   - 离开电脑时锁定密码库
   - 设置合理的超时时间
   - 使用屏幕保护程序密码

5. **保护 Git 仓库**
   - 使用私有仓库
   - 启用 2FA
   - 定期轮换 SSH 密钥

---

## 故障排除

### 常见问题

#### 1. 忘记主密码

**无解**。SecureFox 使用零知识加密，主密码丢失意味着数据无法恢复。

**预防措施**：
- 使用密码管理器记住主密码（讽刺但有效）
- 写在纸上放在安全的地方
- 与信任的人分享（紧急情况）

#### 2. "Vault not found" 错误

```bash
# 检查密码库路径
ls -la ~/.securefox/vault.sf

# 或初始化新密码库
securefox vault init
```

#### 3. 服务无法启动

```bash
# 检查是否已在运行
securefox service status

# 查看错误日志
cat ~/.securefox/service.err

# 强制停止旧进程
killall securefox

# 清理 PID 文件
rm ~/.securefox/service.pid

# 重新启动
securefox service start
```

#### 4. Git 同步失败

```bash
# 检查远程配置
cd ~/.securefox
git remote -v

# 测试 SSH 连接
ssh -T git@github.com

# 手动同步测试
securefox vault sync pull
```

详细排查请参考 [AUTO_SYNC_CN.md](./AUTO_SYNC_CN.md#故障排除)。

#### 5. 浏览器扩展无法连接

1. 确认服务正在运行：
```bash
securefox service status
```

2. 检查端口是否被占用：
```bash
lsof -i :8787
```

3. 查看服务日志：
```bash
tail -f ~/.securefox/service.log
```

4. 尝试重启服务：
```bash
securefox service restart
```

#### 6. TOTP 代码不正确

- 确保系统时间准确（TOTP 依赖时间同步）
- 检查 TOTP 密钥是否正确
- 确认是 30 秒间隔（标准 TOTP）

```bash
# 检查系统时间
date

# 同步时间（macOS）
sudo sntp -sS time.apple.com
```

### 性能问题

#### 启动慢

```bash
# 清理旧的构建缓存
make clean

# 重新编译优化版本
make release
```

#### 同步慢

```bash
# 检查网络连接
ping github.com

# 使用压缩传输
git config --global core.compression 9

# 减少同步频率
securefox vault sync enable --mode full --interval 1800
```

### 获取帮助

```bash
# 查看命令帮助
securefox --help
securefox vault --help
securefox item add --help

# 启用详细日志
securefox --verbose vault unlock
```

### 重置一切

**⚠️ 警告：这将删除所有数据！**

```bash
# 停止服务
securefox service stop

# 删除密码库和配置
rm -rf ~/.securefox

# 卸载服务（如果已安装）
securefox service uninstall

# 重新开始
securefox vault init
```

---

## 环境变量

SecureFox 支持以下环境变量：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `SECUREFOX_VAULT` | 密码库路径 | `~/.securefox` |
| `SECUREFOX_VERBOSE` | 详细日志 | `false` |
| `SECUREFOX_BRANCH` | Git 分支 | `main` |
| `SECUREFOX_REMOTE` | Git 远程名 | `origin` |
| `GIT_AUTHOR_NAME` | Git 作者名 | `SecureFox` |
| `GIT_AUTHOR_EMAIL` | Git 作者邮箱 | 自动生成 |

使用示例：
```bash
# 使用自定义密码库路径
export SECUREFOX_VAULT=/path/to/custom/vault
securefox vault unlock

# 启用详细日志
export SECUREFOX_VERBOSE=1
securefox item add "Test"

# 自定义 Git 分支
export SECUREFOX_BRANCH=master
securefox vault sync push
```

---

## 命令速查表

### 密码库

```bash
securefox vault init                    # 初始化
securefox vault unlock                  # 解锁
securefox vault unlock --remember       # 解锁并记住
securefox vault lock                    # 锁定
```

### 密码项

```bash
securefox item add "Name"               # 添加
securefox item add "Name" --generate    # 添加并生成密码
securefox item list                     # 列出
securefox item list --search github     # 搜索
securefox item show "Name"              # 查看
securefox item show "Name" --copy       # 复制密码
securefox item edit "Name"              # 编辑
securefox item remove "Name"            # 删除
```

### 同步

```bash
securefox vault sync config <url>                        # 配置远程
securefox vault sync push                                # 推送
securefox vault sync pull                                # 拉取
securefox vault sync enable --mode push-on-change        # 启用自动同步
securefox vault sync show                                # 查看配置
securefox vault sync disable                             # 禁用
```

### 服务

```bash
securefox service start                 # 启动
securefox service stop                  # 停止
securefox service restart               # 重启
securefox service status                # 状态
securefox service install               # 安装系统服务
securefox service uninstall             # 卸载
```

### 工具

```bash
securefox tools generate                # 生成密码
securefox tools generate --length 32    # 指定长度
securefox tools generate --copy         # 复制到剪贴板
securefox tools totp "Name"             # 生成 TOTP
```

---

## 更多资源

- 📖 [开发文档](./DEVELOPMENT_CN.md) - 开发者指南
- 🔄 [Git 同步详解](./AUTO_SYNC_CN.md) - 自动同步功能
- 🏗️ [技术设计](./TECHNICAL_DESIGN.md) - 架构文档
- 🐛 [Issue Tracker](https://github.com/yourusername/securefox/issues) - 报告问题
- 💬 [讨论区](https://github.com/yourusername/securefox/discussions) - 社区讨论

---

## 许可证

MIT 或 Apache-2.0

## 贡献

欢迎贡献！请查看 [CONTRIBUTING.md](../CONTRIBUTING.md)。

---

**享受使用 SecureFox！🦊🔐**
