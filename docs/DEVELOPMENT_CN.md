# SecureFox 开发指南

## 快速开始

### 首次安装

```bash
# 克隆并构建
git clone <your-repo>
cd securefox

# 构建并安装
make install
```

### 日常开发

```bash
# 代码修改后快速更新
make update

# 或用于快速迭代（跳过服务停止）
make dev
```

## Makefile 命令

### 构建命令

| 命令 | 说明 |
|---------|-------------|
| `make build` | 构建调试版本 |
| `make release` | 构建优化的发布版本 |
| `make check` | 检查代码而不构建 |
| `make test` | 运行测试 |
| `make fmt` | 格式化代码 |

### 安装命令

| 命令 | 说明 |
|---------|-------------|
| `make install` | 构建并安装到 `/usr/local/bin`（需要 sudo） |
| `make uninstall` | 从 `/usr/local/bin` 移除 |
| `make update` | **更新本地安装**（停止服务，构建，安装） |
| `make upgrade` | `update` 的别名 |

### 开发命令

| 命令 | 说明 |
|---------|-------------|
| `make dev` | 快速开发更新（跳过服务停止） |
| `make version` | 显示已安装的版本信息 |
| `make clean` | 清理构建产物 |
| `make run` | 在调试模式下从源码运行 |

## 典型工作流程

### 1. 初始安装

```bash
make install
```

这将会：
- 构建发布版本
- 复制到 `/usr/local/bin/securefox`
- 设置可执行权限

### 2. 代码修改后更新

```bash
# 完整更新（推荐）
make update
```

这将会：
- 构建发布版本
- 停止运行的服务（如果有）
- 安装新的二进制文件
- 显示版本信息
- 提醒您重启服务

或者快速迭代：

```bash
# 快速更新（用于快速开发）
make dev
```

这会跳过服务停止步骤以加快更新速度。

### 3. 测试修改

```bash
# 选项 1：从源码运行（调试模式）
make run

# 选项 2：构建并测试
make build
./target/debug/securefox version

# 选项 3：完整发布测试
make release
./target/release/securefox version
```

### 4. 服务管理

更新后：

```bash
# 重启服务
securefox service restart

# 或停止后启动
securefox service stop
securefox service start

# 检查状态
securefox service status
```

## 常见任务

### 提交前格式化和检查

```bash
make fmt
make check
make test
```

### 清理并重新构建

```bash
make clean
make install
```

### 验证安装

```bash
make version
# 或
securefox version
```

## 服务安装

`securefox service install` 命令将会：
1. 自动复制二进制文件到 `/usr/local/bin`
2. 创建 launchd plist 用于自动启动
3. 无需单独运行 `make install`！

```bash
# 先构建
make release

# 然后作为服务安装（包含二进制文件安装）
./target/release/securefox service install
```

## 目录结构

```
securefox/
├── Makefile          # 构建和安装命令
├── core/             # 核心库
├── api/              # API 服务器
├── cli/              # CLI 应用程序
└── target/
    ├── debug/        # 调试构建
    └── release/      # 发布构建
```

## 技巧

1. **对于大部分开发工作使用 `make update`** - 它会为您处理一切
2. **用 `make dev` 进行快速迭代** - 更快但不停止服务
3. **提交前始终运行 `make fmt`** - 保持代码格式化
4. **使用 `securefox version` 验证更新** - 检查 git hash 和构建时间

## 故障排除

### 安装后找不到命令

```bash
# 检查是否已安装
ls -la /usr/local/bin/securefox

# 检查 PATH
echo $PATH | grep /usr/local/bin
```

### 服务无法停止

```bash
# 强制停止
killall securefox

# 或检查 PID 并杀死
cat ~/.securefox/service.pid
kill <PID>
```

### 需要重新安装一切

```bash
make uninstall
make clean
make install
```
