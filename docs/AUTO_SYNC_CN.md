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

### 2. AutoPull（定时拉取）
按设定间隔自动从远程拉取更新，适合多设备协作。

```bash
# 启用定时拉取（每5分钟）
securefox vault sync enable --mode auto-pull --interval 300
```

**特点：**
- 定时从远程 pull 最新数据
- 本地修改仍需手动 push
- 适合主要在一个设备工作，偶尔在其他设备查看

### 3. PushOnChange（变更即推送）
数据修改后立即推送到远程，确保及时备份。

```bash
# 启用变更即推送
securefox vault sync enable --mode push-on-change
```

**特点：**
- vault 保存时自动 commit 和 push
- 远程更新需手动 pull
- 适合单设备使用，注重备份

### 4. Full（完整双向同步）
定时执行双向同步，自动处理 pull 和 push。

```bash
# 启用完整同步（每10分钟）
securefox vault sync enable --mode full --interval 600
```

**特点：**
- 定时 pull 远程更新
- 检测到本地变更自动 push
- 适合多设备频繁切换使用

## 常用命令

### 配置远程仓库

```bash
securefox vault sync config git@github.com:username/vault.git
```

### 查看同步配置

```bash
securefox vault sync show
```

输出示例：
```
Auto-Sync Configuration
─────────────────────────
Status: Enabled
Mode:   Push-On-Change
        Push changes immediately after vault updates
```

### 禁用自动同步

```bash
securefox vault sync disable
```

### 查看同步状态

```bash
securefox vault sync status
```

## 工作原理

### PushOnChange 模式
1. 当您添加、编辑或删除 vault 数据时
2. VaultStorage 保存文件后自动触发
3. 检查是否有变更
4. 如有变更，自动 commit 和 push

### AutoPull / Full 模式
1. 后台服务启动同步守护任务
2. 按配置的间隔定时检查
3. AutoPull：仅 pull 远程更新
4. Full：先 pull，再检查本地变更并 push

### 智能检测
- 只在有实际变更时才 commit
- 只在远程有新提交时才 pull
- 避免无意义的网络操作

## 最佳实践

### 单设备使用
```bash
# 推荐：变更即推送
securefox vault sync enable --mode push-on-change
```

### 双设备切换
```bash
# 推荐：完整同步，间隔5-10分钟
securefox vault sync enable --mode full --interval 600
```

### 多人协作
```bash
# 推荐：定时拉取 + 手动推送
securefox vault sync enable --mode auto-pull --interval 300
# 修改后手动：
securefox vault sync push
```

### 仅备份需求
```bash
# 推荐：变更即推送
securefox vault sync enable --mode push-on-change
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
   - PushOnChange 会在每次保存时执行网络操作
   - 频繁修改可能增加网络负担
   - 可考虑使用 Full 模式降低同步频率

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

## 环境变量

可通过环境变量自定义配置：

```bash
# 自定义分支（默认：main）
export SECUREFOX_BRANCH=master

# 自定义远程名（默认：origin）
export SECUREFOX_REMOTE=backup
```
