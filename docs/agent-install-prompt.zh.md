# Agent 安装与回退提示词（DSH Antigravity Plus）

你要在用户指定的 DeepSeek Harness（DSH）profile 中安装或升级 `dsh-antigravity-plus`。请先读取本仓库 README 和本提示词，按实际运行证据操作；不得假定 profile 在 `%USERPROFILE%\.dsh`，不得把某个机器的盘符或代理端口写死。

## 必须遵守

- DSH Antigravity Plus 使用非官方 Antigravity 私有接口，接口变化可能导致不可用；不要声称这是 Google 官方插件。
- 不检查或推断国家/地区、VPN/TUN 状态，不扫描本机端口，不猜代理地址。没有代理设置 UI。
- 代理行为：私有 HTTPS 请求读取 `HTTPS_PROXY` / `https_proxy`，再读 `ALL_PROXY` / `all_proxy`；遵守 `NO_PROXY` / `no_proxy`；仅支持 HTTP proxy URL。中国大陆网络无法直连时，指导用户配置代理软件显示的 HTTP/mixed 端口，不要使用 SOCKS-only 端口。
- 不读取、复制、输出、提交或删除账号 Token、OAuth 文件、浏览器凭据或完整认证请求。不得清理账号数据目录。
- 不擅自发布 npm 包、合并 PR、推送未获授权的分支或改变用户代理/系统设置。

## 安装或切换步骤

1. 通过正在运行的 DSH Desktop 命令行参数、进程路径、已安装 CLI 和 profile manifest 确认实际 DSH home/profile。只报告路径，不展示凭据。
2. 记录 profile 的依赖和活动 bundle 基线，确认旧 auth 与 Plus 的安装来源、版本和当前活动者。
3. 对 Desktop profile 使用应用内 **Plugins** 管理页面；Electron 应用独占管理 `desktop` profile，独立 CLI 不负责管理它。先在应用内页面检查可用安装来源，再操作。CLI 管理的 Web/headless profile 才使用对应安装的 DSH CLI。
4. 操作前记录 profile 的依赖、锁文件和活动 bundle 基线，并在 DSH home 的备份目录保存配置清单和 SHA-256；只备份配置，不备份账号 Token 文件。Desktop 需要由应用插件管理器写入时，不要并行手改其清单。
5. 从本地 Plus checkout 或应用管理器支持的来源安装 Plus；来源不被当前应用支持时停止并报告，不猜包名或绕过 profile 所有权限制。启用 Plus、停用旧 auth bundle，并保留旧 auth 包依赖作为回退入口。
6. 不得删除 `%LOCALAPPDATA%\dsh-antigravity-auth\auth.json` 或对应数据目录；Plus 优先使用已存在的旧路径；若旧路径不存在，则复用已有 Plus 路径，不搬移、复制或删除凭据。
7. 检查 Plus 是否加载、账号列表是否仍可读取、额度是否能刷新。只有在用户明确授权真实请求时，才发出一个最小文本请求；不要把加载成功、端口可达或静态检查称为端到端成功。
8. 失败时通过同一个官方插件管理页面关闭 Plus 并恢复旧 auth bundle；若应用无法启动，再完全退出 Desktop 并依据备份恢复原 profile 清单，启动后验证原账号列表。保留脱敏失败证据和回滚结果。

## 代理环境说明

如需指导配置，先让用户在代理客户端确认 HTTP/mixed 入站端口，再给出 Windows 用户级环境变量示例。关键变量为 `HTTPS_PROXY=http://127.0.0.1:端口`；可同时设置 `HTTP_PROXY` 和 `NO_PROXY=localhost,127.0.0.1,::1`。变量变更后要完整重启 DSH Desktop。绝不把本机端口值、代理凭据或个人代理服务信息写进公开仓库。

## 验收记录

记录实际 profile 路径、旧/新 bundle ID、包版本和 commit、备份目录/哈希、启动结果、账号数量（只记数量，不记邮箱）、额度刷新结果、真实请求是否获得授权及结果、未验证边界。任何失败按上面步骤回退并报告确切失败点。
