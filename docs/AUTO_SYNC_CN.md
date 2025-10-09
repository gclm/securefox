# Git 自动同步功能使用指南

## 功能概述

SecureFox 支持自动将 vault 数据同步到 Git 远程仓库，提供多种同步模式适应不同使用场景。

## 同步模式

### 1. Manual（手动同步）
默认模式，只能通过命令手动同步。

```bash
# 手动推送
securefox vault sync push

# 手动拉取
securefox vault sync pull
```

### 2. Auto（自动同步）
定期自动拉取远程更新，本地变更时自动推送。

```bash
# 启用自动同步（默认间隔 600 秒）
securefox vault sync enable --mode auto

# 自定义同步间隔（300 秒）
securefox vault sync enable --mode auto --interval 300
```

**特点：**
- 定期从远程 pull 最新数据（按 interval 设置）
- vault 数据变更时自动 commit 和 push
- 适合多设备频繁切换使用

## 常用命令

### 配置远程仓库

```bash
securefox vault sync config git@github.com:username/vault.git
```

### 禁用自动同步

```bash
securefox vault sync disable
```

### 查看同步状态

```bash
securefox vault sync status
```

输出示例：
```
Sync Status
───────────────────────────────────

Git Configuration
Remote URL:  git@gitee.com:username/vault.git
Git Status:  Configured

Auto-Sync Configuration
Status:      Enabled
Mode:        Auto
             Pull interval: 600 seconds
             Automatic pull at intervals + push on vault changes
```

## 工作原理

### Auto 模式

**定期拉取（Pull）**：
1. 后台服务启动同步守护任务
2. 按配置的 interval 间隔定时检查
3. 检查远程是否有更新
4. 如有更新，自动 pull 并 merge

**变更推送（Push）**：
1. 当您添加、编辑或删除 vault 数据时
2. VaultStorage 保存文件后自动触发
3. 检查是否有变更
4. 如有变更，自动 commit 和 push

### 智能检测
- 只在有实际变更时才 commit
- 只在远程有新提交时才 pull
- 避免无意义的网络操作
- Push 和 Pull 相互独立，互不影响

## 最佳实践

### 单设备使用
```bash
# 推荐：手动同步（默认）
securefox vault sync push
# 或启用自动同步，间隔较长
securefox vault sync enable --mode auto --interval 1800
```

### 双设备切换
```bash
# 推荐：自动同步，间隔 5-10 分钟
securefox vault sync enable --mode auto --interval 600
```

### 多设备频繁切换
```bash
# 推荐：自动同步，间隔 3-5 分钟
securefox vault sync enable --mode auto --interval 300
```

## 注意事项

1. **首次配置**
   - 确保已设置 git remote
   - 确保 SSH 密钥已配置
   - 建议先手动 push/pull 测试连接

2. **冲突处理**
   - 自动同步会尝试 merge
   - 如遇冲突，可能需要手动解决
   - 建议设置合理的同步间隔避免冲突

3. **网络要求**
   - 自动同步需要网络连接
   - 同步失败不会影响 vault 保存
   - 建议在稳定网络环境使用

4. **性能考虑**
   - Auto 模式会在每次保存时执行 push 操作
   - 频繁修改可能增加网络负担
   - 可通过调整 interval 降低 pull 频率

## 故障排除

### 同步失败
```bash
# 检查远程配置
securefox vault sync status

# 手动测试连接
securefox vault sync pull
```

### SSH 认证问题
```bash
# 检查 SSH 密钥
ls -la ~/.ssh/id_*

# 测试 SSH 连接
ssh -T git@github.com
```

### 查看日志
```bash
# 服务日志
tail -f ~/.securefox/service.log
```

## 配置存储

同步配置存储在 `~/.securefox/config` 文件中，包含：
- Git 远程仓库 URL
- 自动同步配置（启用状态、模式、间隔）

无需密码即可查看配置：
```bash
securefox vault sync status
```

## 环境变量

可通过环境变量自定义配置：

```bash
# 自定义分支（默认：main）
export SECUREFOX_BRANCH=master

# 自定义远程名（默认：origin）
export SECUREFOX_REMOTE=backup
```

## 忽略文件

Git 仓库初始化时会自动创建 `.gitignore` 文件，默认忽略：
- `service.err` - 服务错误日志
- `service.pid` - 服务进程 ID
- `service.log` - 服务运行日志
- `backups/` - 备份目录
- `.DS_Store`、`Thumbs.db` - 系统文件
