# dsh-antigravity-plus (Antigravity+)

[![npm version](https://img.shields.io/npm/v/dsh-antigravity-plus.svg?style=flat-square)](https://www.npmjs.com/package/dsh-antigravity-plus)
[![license](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](LICENSE)
[![DSH Compatibility](https://img.shields.io/badge/DSH-0.2.0--rc.2-emerald.svg?style=flat-square)](https://github.com/deepseek-ai/deepseek-harness)

[English](README.md) | **简体中文**

> **✨ 增强型 Antigravity 全能力套件**：专为 [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness) 官方桌面端与 Web 端打造。集成 **智能代理自适应引擎 (Smart Proxy)**、**多账号配额自愈轮换 (Quota Failover)** 与 **全模态原生工具箱**。

---

## 🌟 核心亮点与产品优势

### 1. 🚀 智能代理自适应引擎（国内开箱即用，海外原生直连）
- **自动嗅探本地常见代理客户端**：免手动配置繁琐的系统环境变量！智能探测本地运行的 **Clash / Clash Verge / Mihomo (`7890`/`7897`)**、**v2rayN (`10809`)**、**Surge (`6152`)** 等端口，发现即用。
- **UI 可视化代理管理**：在设置页面即可一键切换「自动检测 / 直接连接 / 自定义代理地址」，小白用户 0 门槛。
- **海外与 TUN 模式直连**：海外用户或国内开启 TUN 虚拟网卡的用户自动直连，无任何延迟开销。
- **精准故障诊断**：当断网或节点不可用时，给出清晰中文引导排查，拒绝将网络超时误报为“Token 失效”。

### 2. 🔄 多账号配额自愈轮换（连续对话不中断）
- **无感故障转移 (Quota Failover)**：当主账号触发 `429` 或配额耗尽（且当前轮次尚未输出内容时），系统自动无感切换至下一个已绑定账号重试，保障重度使用不中断。
- **一键极速切换**：支持在 UI 设置卡片中点击切换，或在终端输入 `/anti switch <账号>` 即时切换。
- **安全隔离持久化**：凭证仅保存在本地 Host 属主安全目录（Windows ACL / POSIX 0600），绝不向客户端暴露 Token。
- **平滑向下兼容**：自动兼容导入旧版 `dsh-antigravity-auth` 凭证，升级无需重新登录 Google。

### 3. 🎨 全模态原生模型与工具套件
- **顶级模型全面支持**：Gemini 3.8 Flash（低/中/高思考档位）、Gemini 3.1 Pro、Claude 3.7 Sonnet、Claude Opus 等。
- **深度联网搜索 (`web_search`)**：无缝注入 Antigravity 真实 Grounding 线路，返回去重验证来源。
- **AI 绘画与图库 (`generate_image` / `list_images`)**：支持提示词与多张参考图生成，持久化图库存储。
- **视频智能理解 (`analyze_video`)**：原生支持本地工作区 MP4 视频的多模态帧采样与内容分析。

### 4. 📊 优雅的用量仪表盘
- **5 小时与每周额度监控**：配备 Emerald 翡翠绿流光进度条，绿/橙/红三档直观预警。
- **人性化倒计时**：剩余时间自动转换为 `3天 22h 43m`（不足一天为小时/分钟）。

---

## 📸 实机界面截图

以下截图来自本机 DSH `0.2.0-rc.2` 官方桌面端与 Web 端：

| Web 端设置与用量卡片 | 桌面端用量仪表盘 |
|:---:|:---:|
| ![Web端截图](docs/screenshots/antigravity-web.png) | ![桌面端截图](docs/screenshots/antigravity-desktop.png) |

---

## ⚡ 3 分钟极速上手

### 1. 环境准备
- 已安装 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（推荐 `0.2.0-rc.2` 或最新稳定版）；
- Node.js `>= 22.19.0`，已配置 `pnpm`；
- 一个可用的 Google 账号。

### 2. 安装插件

#### 方式 A：Web 端安装
在终端执行以下命令将插件添加到 Web Profile：
```powershell
# 如果是全新配置推荐新建 profile：
dsh --profile web-antigravity --from-default-profile web --no-open
dsh plugin --profile web-antigravity add link:D:/Projects/Active-Dev/dsh-antigravity-plus
dsh --profile web-antigravity
```

#### 方式 B：桌面端（Desktop）安装
1. 退出运行中的 DeepSeek Harness 桌面客户端；
2. 打开桌面端的 profile 配置（`%USERPROFILE%\.dsh\profiles\desktop\package.json`），在 `dependencies` 中添加：
   ```json
   "dsh-antigravity-plus": "link:D:/Projects/Active-Dev/dsh-antigravity-plus"
   ```
   并在 `dsh.profile.bundles` 数组中添加 `"dsh-antigravity-plus"`；
3. 在该目录下运行 `pnpm install`；
4. 重新打开 DeepSeek Harness 桌面端即可。

### 3. 一键登录授权
- **在界面登录**：打开 DSH 设置 -> 点击左侧「Antigravity」-> 在卡片中点击「开始 Antigravity 登录」，浏览器会自动弹出完成 Google 授权。
- **在对话框/终端登录**：输入快捷斜杠命令：
  ```text
  /anti login
  ```

---

## ⌨️ 常用终端命令 (`/anti`)

插件注册了超轻量级的 `/anti` 斜杠命令（与 `/antigravity-auth` 完全等效）：

| 命令 | 说明 |
|---|---|
| `/anti` 或 `/anti status` | 查看当前账号状态、生效模型与能力列表 |
| `/anti login` | 启动 Google OAuth 授权流程并打开默认浏览器 |
| `/anti list` | 查看所有已绑定的 Google 账号列表 |
| `/anti switch <账号>` | 快速切换生效的主账号 |
| `/anti proxy` | 查看当前智能代理引擎的检测状态与命中端口 |
| `/anti logout` | 登出当前账号并清除本地内存缓存 |
| `/anti cancel` | 取消正在进行中的授权 |

---

## ❓ 国内网络与代理排坑 FAQ

### Q1: 启动后提示连接 Google 超时，怎么办？
> **解答**：这是国内用户最常见的问题。
> 1. 请确认你的代理软件（Clash Verge、Mihomo Party、v2rayN）已启动；
> 2. 插件默认会自动探测本地 `127.0.0.1:7890`（Clash）与 `127.0.0.1:10809`（v2rayN）；
> 3. 如果使用的是非常规端口，可以在 DSH 设置页面的「网络代理设置」卡片中选择「手动指定」，填入你的实际代理地址（如 `http://127.0.0.1:7897`），点击保存即可立即生效。

### Q2: 授权登录后提示“未找到项目 / project-unavailable”？
> **解答**：请确保你的 Google 账号开通了相应服务的权限，且在弹出的网页端点击了“允许全部权限”。

### Q3: 多个 Google 账号怎么添加？
> **解答**：在 DSH 设置页面的「已绑定账号列表」右上角点击「+ 添加新账号」，或者在终端执行 `/anti login` 登录另一个账号即可。额度用尽时会自动轮换备用账号！

---

## 🔒 安全与隐私声明

- **零敏感信息泄漏**：Token、授权码、Cookie、密钥等秘密**绝对保存在本地 Host 内存与加密安全文件**，永远不会传给浏览器客户端、设置前端、会话日志或上下文文本。
- **PKCE S256 授权**：采用业界最高规格的 OAuth 2.0 PKCE 流程，回调监听器仅限本机 `127.0.0.1:51121` 环回接口。
- **实验性声明**：本项目为非官方逆向适配器，仅供个人学习与开发测试。请遵守 Google 服务条款，勿用于生产环境。

---

## 🙏 致谢与参考项目 (Acknowledgments)

本项目 standing on the shoulders of giants，特向以下杰出项目致以最崇高的敬意：

- **[dsh-antigravity-auth](https://github.com/suntianc/dsh-antigravity-auth)**：提供了基础的 DSH 插件结构探索、单账号认证链路与公约规范。
- **[@cortexkit/antigravity-auth](https://github.com/cortexkit/antigravity-auth)**：社区核心逆向协议库，为私有 Cloud Code 与模型映射提供了关键依据。
- **[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)**：卓越的 Agent Harness 基础设施底座。

---

## 📄 开源许可证

本项目基于 [MIT License](LICENSE) 许可协议开源。
