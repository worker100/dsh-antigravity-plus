# 代理环境说明

DSH Antigravity Plus 不检测用户所在地、VPN/TUN 状态或代理软件，也不扫描本机端口。插件只读取进程环境：优先 `HTTPS_PROXY` / `https_proxy`，再读取 `ALL_PROXY` / `all_proxy`；目标主机排除规则读取 `NO_PROXY` / `no_proxy`。当前私有 HTTPS 传输只支持 `http://` 代理 URL，SOCKS-only 端口不可用。

中国大陆网络如果不能直接访问服务，可在 Windows 当前用户环境中配置代理软件公开的 HTTP 或 mixed 端口。使用前确认代理软件已开启对应入站端口，不要把 SOCKS 端口误填为 HTTP 端口：

```powershell
[Environment]::SetEnvironmentVariable('HTTPS_PROXY', 'http://127.0.0.1:PORT', 'User')
[Environment]::SetEnvironmentVariable('HTTP_PROXY', 'http://127.0.0.1:PORT', 'User')
[Environment]::SetEnvironmentVariable('NO_PROXY', 'localhost,127.0.0.1,::1', 'User')
```

`PORT` 是示例占位符。按所用代理软件的界面确认 HTTP/mixed 端口，插件不会替用户猜端口。更改后完全退出 DSH Desktop（包括托盘）并重新启动。这样 DSH Host 才会继承当前用户环境变量。

验证时分别确认：当前用户环境变量值（避免把代理凭据贴到日志或公开 issue）、代理客户端对应 HTTP/mixed 监听、重启后 DSH Host 是否继承 `HTTPS_PROXY`。这些检查只能证明配置/环境，不等于账号登录、额度查询或模型请求成功。
