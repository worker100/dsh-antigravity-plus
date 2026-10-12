# DSH Antigravity Plus

Antigravity account and capability plugin for DeepSeek Harness (DSH). This repository packages the stable `dsh-antigravity-auth` implementation under the project name **DSH Antigravity Plus**. The package is currently an unreleased `0.2.0-rc.1` candidate; no npm release has been published.

> **Unofficial integration:** this plugin uses private Antigravity endpoints. Google does not support third-party login tools; use it only if you accept the account and availability risks. Endpoint changes can interrupt service.

## Features

- Google OAuth login, local logout, and explicit Google grant revocation.
- Multiple saved accounts with manual add, switch, and removal. The plugin does not rotate accounts in the background.
- Antigravity model routing and account model availability refresh.
- Five-hour and weekly quota display with manual refresh.
- Optional grounded web search, image generation/editing, and video understanding capabilities, subject to their capability gates and provider support.
- Host-side credential handling. Token values are not sent to the browser settings UI.

The Desktop settings panel and account store come from the stable auth implementation. The Plus name is applied to the package, bundle, UI, and commands. The plugin prefers an existing `dsh-antigravity-auth` account store so the stable plugin can be restored without moving credentials. If that store is absent, it reuses an existing `dsh-antigravity-plus` store. It never copies or deletes either store.

## Network proxy

The plugin does **not** detect country or VPN status, scan local ports, guess a proxy address, or show a proxy configuration panel. Its private HTTPS transport reads `HTTPS_PROXY` / `https_proxy`, then `ALL_PROXY` / `all_proxy`; it honors `NO_PROXY` / `no_proxy`. The configured proxy must use an HTTP proxy URL. A SOCKS-only URL is not supported by this transport.

If a mainland China network cannot reach the provider directly, configure the HTTP or mixed port exposed by your proxy application in the Windows **user** environment. Example PowerShell commands (replace the example port with the HTTP/mixed port shown by your proxy app):

```powershell
[Environment]::SetEnvironmentVariable('HTTPS_PROXY', 'http://127.0.0.1:PORT', 'User')
[Environment]::SetEnvironmentVariable('HTTP_PROXY', 'http://127.0.0.1:PORT', 'User')
[Environment]::SetEnvironmentVariable('NO_PROXY', 'localhost,127.0.0.1,::1', 'User')
```

`HTTPS_PROXY` is the important variable for this plugin's private requests. `HTTP_PROXY` helps other DSH requests. The plugin does not infer a port from Clash, VPN, TUN, or other software. After changing persistent variables, fully exit DSH Desktop, including its tray process, then start it again so the Host inherits the new environment. See the [DSH app-boot environment guide](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/boot/app-boot/README.md) for DSH's general environment loading behavior.

## Install from a source checkout

For Desktop, install and switch bundles through the application's **Plugins** page. The Electron app owns its `desktop` profile; the standalone CLI does not manage that profile. For CLI-managed Web or headless profiles, use the DSH CLI documented for that installation. See the [official Desktop guide](https://github.com/deepseek-ai/deepseek-harness/blob/master/apps/desktop/README.md) and [plugin manager guide](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/boot/plugin-manager/README.md). Before switching an existing installation, preserve the legacy auth dependency and account data directory until the Plus bundle has passed acceptance.

See [the reusable Agent installation prompt](docs/agent-install-prompt.zh.md) for profile discovery, backup, switch, and rollback instructions in Chinese.

## Commands

On DSH surfaces with the command runtime:

```text
/antigravity-plus                 # status
/antigravity-plus login           # start Google OAuth
/antigravity-plus cancel          # cancel pending login
/antigravity-plus logout          # clear local account state
```

## Development

Requires Node.js `^22.19.0 || >=24.0.0` and pnpm `11.7.0`.

```sh
pnpm install --frozen-lockfile
pnpm check
```

`pnpm check` runs lint, type checking, unit tests, build, package smoke checks, and publint. Live provider requests are separate and require explicit authorization and a signed-in account.

## License

MIT. See [LICENSE](LICENSE).
