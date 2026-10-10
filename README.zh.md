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

## 🖥️ 两种官方运行形态对比：Web GUI 与 桌面端 (Desktop)

DeepSeek Harness 官方提供了两种图形界面（GUI）形态，本项目**对两者均提供了原生支持与严格验证**：

| 对比维度 | **Web GUI (浏览器端)** | **Desktop (官方桌面端)** |
|---|---|---|
| **官方术语** | `dsh web` (Web Profile) | `desktop` Profile (Electron 客户端) |
| **运行载体** | 本地 Node.js 服务器 + 现代浏览器 (Chrome/Edge) | 独立的 `DeepSeek Harness.exe` 桌面程序 |
| **默认端口/入口** | 默认端口 `3080` (或指定端口如 `19387`) | 原生 Electron 窗口 + 系统托盘 (Tray) |
| **Profile 机制** | 读取 `$DSH_HOME/profiles/web`，支持 CLI 动态增删 | **Electron 排他独占持有**，CLI 会拒绝外部修改 |
| **最佳使用场景** | 开发者脚本化管理、快捷后台常驻、多端口部署 | 普通用户日常使用、沉浸式桌面交互体验 |
| **插件界面表现** | 基于 Cordis 的共享 React 组件，外观与交互完全一致 | 基于 Cordis 的共享 React 组件，外观与交互完全一致 |

> 💡 **特别提醒**：官方 DSH CLI 对 `desktop` Profile 实施了严格的排他保护。如果在终端执行 `dsh plugin --profile desktop add ...` 会直接被官方拦截并提示 `profile "desktop" is managed exclusively by the Electron application`。因此，桌面端必须通过修改桌面端配置或通过桌面端内置应用进行安装！

---

## ⚡ 3 分钟极速上手

### 1. 环境准备
- 已安装 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（推荐 `0.2.0-rc.2` 或最新稳定版）；
- Node.js `>= 22.19.0`，已配置 `pnpm`；
- 一个可用的 Google 账号；
- （国内环境）已启动 Clash Verge（默认端口 `7897`）或经典 Clash（默认端口 `7890`）。

### 2. 安装插件

#### 形态一：Web GUI（浏览器端安装）
在终端执行以下命令将插件添加到 Web Profile：
```powershell
# 推荐新建干净 profile 或使用现有 web profile：
dsh --profile web-antigravity --from-default-profile web --no-open
dsh plugin --profile web-antigravity add link:D:/Projects/Active-Dev/dsh-antigravity-plus
dsh --profile web-antigravity
```

#### 形态二：Desktop 桌面端安装（避坑正解）
由于官方桌面端的 profile 受 Electron 排他管理，请按以下安全步骤安装：
1. 完全退出运行中的 DeepSeek Harness 桌面客户端；
2. 打开桌面端的 profile 配置（`%USERPROFILE%\.dsh\profiles\desktop\package.json`），在 `dependencies` 中添加：
   ```json
   "dsh-antigravity-plus": "link:D:/Projects/Active-Dev/dsh-antigravity-plus"
   ```
   并在 `dsh.profile.bundles` 数组中添加 `"dsh-antigravity-plus"`；
3. 在该目录下运行 `pnpm install`；
4. 重新启动桌面客户端即可。

---

## 🚀 进阶推荐：国内 Web GUI 一键启停管理脚本

国内使用 Web GUI 时，常常遇到“代理还没启动 DSH 就先跑起来导致报错”或“频繁开关终端黑窗口”的问题。推荐使用以下两套批处理脚本配合桌面快捷方式：

### 1. `启动-dsh-web.bat`（一键后台静默启动 + Clash健康检查 + 自动弹浏览器）
```bat
@echo off
chcp 65001 >nul
set "PORT=3080"
set "NODE_EXE=node.exe"
set "DSH_BIN=dsh"

rem --- 1. Clash 就绪检查门禁：等待代理端口(如7897/7890)启动 ---
powershell -NoProfile -Command "for ($i=0;$i -lt 30;$i++) { $c = [System.Net.Sockets.TcpClient]::new(); try { $t=$c.ConnectAsync('127.0.0.1', 7897); if ($t.Wait(300) -and $c.Connected) { exit 0 } } catch {} finally { $c.Dispose() }; Start-Sleep -Milliseconds 500 }; exit 1"
if %errorlevel% neq 0 (echo 警告: 代理未启动，请先打开 Clash! & pause & exit /b 1)

rem --- 2. 自动杀掉旧进程并静默后台拉起新服务 ---
powershell -NoProfile -Command "Start-Process -FilePath '%NODE_EXE%' -ArgumentList '%DSH_BIN%','web','--port','%PORT%','--no-open' -WindowStyle Hidden"

rem --- 3. 打开默认浏览器 ---
timeout /t 2 >nul
start http://127.0.0.1:%PORT%
```

### 2. `关闭-dsh-web.bat`（一键安全释放端口）
```bat
@echo off
powershell -NoProfile -Command "$c = Get-NetTCPConnection -LocalPort 3080 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if ($c) { Stop-Process -Id $c.OwningProcess -Force }"
```

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
