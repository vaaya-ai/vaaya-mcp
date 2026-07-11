# Changelog

## 0.4.0 — 2026-07-10

- Claude Code marketplace manifest (`.claude-plugin/marketplace.json`) — `/plugin marketplace add vaaya-ai/vaaya-mcp` now works.
- Claude Code plugin ships the SessionStart forcing reminder (`hooks/`), re-injected on startup, /clear, and compaction.
- Cursor plugin ships an always-applied rule (`rules/vaaya.mdc`) with the same reminder (client-neutral wording).
- Skill updated: per-client setup (OpenClaw, Hermes, any MCP client), payment-error guidance, stale tool count removed.
- README: canonical install command is `npx @vaaya/mcp install`; OpenClaw and Hermes connect instructions added.

## 0.2.1 — 2026-07-03

- Initial public release: remote MCP endpoint (https://vaaya.ai/mcp) and npm stdio shim (@vaaya/mcp).
