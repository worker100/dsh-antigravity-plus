# DSH Antigravity Plus

DeepSeek Harness（DSH）的 Antigravity 账号与能力插件。本仓库以当前桌面端稳定使用的 `dsh-antigravity-auth` 实现为基础，统一使用项目名 **DSH Antigravity Plus**。当前版本为尚未发布的 `0.2.0-rc.1` 候选版，尚未发布到 npm。

> **非官方接入：** 插件使用 Antigravity 私有接口。Google 不支持第三方登录工具，使用可能带来账号和可用性风险；接口变化也可能导致功能中断。

## 功能

- Google OAuth 登录、本地登出和明确确认后的 Google 授权撤销。
- 多账号保存、手动添加、切换和移除；不会在后台自动轮换账号。
- Antigravity 模型路由和账号模型可用性刷新。
- 展示并手动刷新 5 小时与周额度。
- 在能力门控和服务端支持的范围内，提供可选的网页搜索、图片生成/编辑和视频理解能力。
- 凭据由 DSH Host 处理；浏览器设置页不会收到 Token 值。

桌面端设置页和账号存储实现来自稳定 auth 版本。这里将包名、bundle、界面与命令统一为 Plus。为方便恢复稳定旧插件，插件优先使用已存在的 `dsh-antigravity-auth` 账号目录；若该目录不存在，则复用已存在的 `dsh-antigravity-plus` 账号目录。切换时不搬移、复制或删除凭据。

## 网络代理

插件**不会**判断地区或 VPN 状态、扫描本机端口、猜测代理地址，也没有单独的代理配置页面。插件的私有 HTTPS 通道读取 `HTTPS_PROXY` / `https_proxy`，其次读取 `ALL_PROXY` / `all_proxy`，并遵守 `NO_PROXY` / `no_proxy`。该通道要求 HTTP 代理 URL，不支持仅提供 SOCKS 的地址。

如果中国大陆网络无法直连服务，可将代理软件提供的 **HTTP 或 mixed 端口**写入 Windows **当前用户**环境变量。下面用 `PORT` 作为示例，请替换成代理软件显示的 HTTP/mixed 端口：

```powershell
[Environment]::SetEnvironmentVariable('HTTPS_PROXY', 'http://127.0.0.1:PORT', 'User')
[Environment]::SetEnvironmentVariable('HTTP_PROXY', 'http://127.0.0.1:PORT', 'User')
[Environment]::SetEnvironmentVariable('NO_PROXY', 'localhost,127.0.0.1,::1', 'User')
```

`HTTPS_PROXY` 是本插件私有请求使用的关键变量；`HTTP_PROXY` 也可供 DSH 其他网络请求使用。插件不会从 Clash、VPN、TUN 或其他软件推断端口。修改持久环境变量后，需完全退出 DSH Desktop（包括系统托盘进程）再启动，Host 才会继承新环境。DSH 通用环境加载方式见[官方 app-boot 说明](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/boot/app-boot/README.md)。

## 从源码安装

使用目标 profile 对应的 DSH CLI。修改 Desktop profile 前先完全退出桌面端。克隆本仓库并安装依赖，再使用已安装 CLI 的 `plugin add link:<路径>` 命令链接到目标 profile。重启后确认此集成只有 **Antigravity Plus** 一个活动 bundle。不要删除旧账号数据目录。

Agent 执行 profile 发现、备份、切换和回退时，可使用[可复用的 Agent 安装提示词](docs/agent-install-prompt.zh.md)。

## 命令

支持 DSH 命令运行时的界面可使用：

```text
/antigravity-plus                 # 查看状态
/antigravity-plus login           # 启动 Google OAuth
/antigravity-plus cancel          # 取消待处理的登录
/antigravity-plus logout          # 清除本地账号状态
```

## 开发

需要 Node.js `^22.19.0 || >=24.0.0` 和 pnpm `11.7.0`。

```sh
pnpm install --frozen-lockfile
pnpm check
```

`pnpm check` 会运行 lint、类型检查、单元测试、构建、包检查和 publint。真实服务请求单独执行，需要明确授权和已登录账号。

## 许可证

MIT，详见 [LICENSE](LICENSE)。
