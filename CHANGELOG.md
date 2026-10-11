# Changelog

All notable changes to `dsh-antigravity-plus` will be documented in this file.

## [Unreleased]

### Fixed
- Corrected the HTTPS CONNECT proxy tunnel handoff so early tunnel bytes are restored and the socket is resumed before TLS wrapping.
- Clarified automatic proxy route precedence and removed the unsupported manual proxy settings card from the documented feature set.

## [0.2.0] - 2026-10-10

### Added
- **Smart Proxy Engine**: Automatic detection for common local proxy client inbounds (Clash/Mihomo 7890/7897, v2rayN/Xray 10809, Surge 6152), environment variable fallback, direct connection mode, and user-friendly bilingual connection diagnostics.
- **Multi-Account Quota Failover**: Bounded automatic failover to alternative accounts on quota exhaustion (429 / RESOURCE_EXHAUSTED) before any token generation is emitted.
- **Quick Terminal Commands**: Introduced `/anti` slash command with instant subcommands (`status`, `login`, `switch`, `list`, `proxy`), while maintaining full backwards compatibility with `/antigravity-auth`.
- **Omni-Modal Tool Suite**: Fully registered `google-antigravity` LLM adapter (Gemini 3.8/Claude 3.7), grounded `web_search`, session-persistent `generate_image` & `list_images`, and local workspace MP4 `analyze_video`.
- **DSH 0.2.0-rc.2 Alignment**: Strict compatibility with DSH 0.2.0-rc.2, Cordis 4.0.4, and Schemastery 3.18.4 across Web and Desktop profiles.
